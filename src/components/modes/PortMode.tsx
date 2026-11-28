// src/components/modes/PortMode.tsx
//
// Lab I/O (replaces Port Control) — a no-code hardware bench: drive each servo,
// watch every sensor the board has, fire each output. For students (PWM, analog vs
// digital) and for teachers checking a robot before class.
//
// Servo sliders keep Port Control's behaviour: live SET_PORT throttled ~20 Hz on
// drag (forced send on release), release snaps back to 0 = stop (firmware detaches
// the servo at 0, so no stop-point trim is needed), Digit1/2/5 drive that port
// forward (SHIFT = reverse). Sensors are polled one request at a time
// (see labIoSensors.ts).

import { useCallback, useEffect, useRef, useState } from 'react';
import ControlLayout from '../control/ControlLayout';
import { useDrive } from '../../hooks/useDrive';
import { useConnection } from '../../hooks/useConnection';
import { onTelemetry } from '../../app/connection';
import PortBoard, { fillBg } from './PortBoard';
import { NUM_PWM_PORTS } from '../../domain/ports';
import { AUX_PORTS, CYCLE_MS, cycleBatch, makeSensorReader, sensorKey, type SensorReply } from './labIoSensors';
import styles from '../../styles/ModeControls.module.css';

const THROTTLE_MS = 50; // ~20 Hz
const SERVOS = [
  { port: 1, label: 'Roda kiri' },
  { port: 2, label: 'Roda kanan' },
  { port: 5, label: 'Servo tambahan' },
];
const CLAP_SHOW_MS = 1500;

export default function PortMode() {
  return (
    <ControlLayout title="Lab I/O">
      <LabIo />
    </ControlLayout>
  );
}

function useLabSensors() {
  const { transport } = useConnection();
  const [values, setValues] = useState<Record<string, SensorReply>>({});
  const [noAnswer, setNoAnswer] = useState(false);
  const [clapAt, setClapAt] = useState(0);

  useEffect(() => {
    if (!transport) return;
    let alive = true;
    let misses = 0;
    const read = makeSensorReader((line) => transport.sendLine(line), onTelemetry);
    (async () => {
      for (let n = 0; alive; n++) {
        const t0 = Date.now();
        for (const req of cycleBatch(n)) {
          if (!alive) return;
          const v = await read(req);
          if (!alive) return;
          misses = v === undefined ? misses + 1 : 0;
          setNoAnswer(misses >= 3);
          if (v === undefined) continue; // keep the last good value on a miss
          if (req.sensor === 'mic_clap' && v === 1) setClapAt(Date.now());
          setValues((prev) => ({ ...prev, [sensorKey(req)]: v }));
        }
        await new Promise((r) => setTimeout(r, Math.max(0, CYCLE_MS - (Date.now() - t0))));
      }
    })();
    return () => {
      alive = false;
      setNoAnswer(false);
    };
  }, [transport]);

  return { values, noAnswer, clapping: Date.now() - clapAt < CLAP_SHOW_MS };
}

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

const show = (v: SensorReply, fmt: (n: number) => string = String) =>
  v === undefined ? '…' : v === null ? 'Tidak ada' : fmt(v);

export function LabIo() {
  const { setPort, sendCommand } = useDrive();
  const { connState } = useConnection();
  const connected = connState === 'connected';
  const { values, noAnswer, clapping } = useLabSensors();

  // ---- Servo -------------------------------------------------------------
  const [servo, setServo] = useState<number[]>(() => Array(NUM_PWM_PORTS).fill(0));
  const lastSent = useRef<number[]>(Array(NUM_PWM_PORTS).fill(0));

  const setValue = useCallback(
    (port: number, value: number, force = false) => {
      setServo((prev) => {
        const next = [...prev];
        next[port - 1] = value;
        return next;
      });
      const now = performance.now();
      if (force || now - lastSent.current[port - 1] >= THROTTLE_MS) {
        lastSent.current[port - 1] = now;
        setPort(port, value);
      }
    },
    [setPort],
  );

  // Digit1/2/5: drive that servo forward (+100); SHIFT = reverse (-100).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const m = /^Digit([125])$/.exec(e.code);
      if (!m || e.repeat) return;
      e.preventDefault();
      setValue(Number(m[1]), e.shiftKey ? -100 : 100, true);
    };
    const up = (e: KeyboardEvent) => {
      const m = /^Digit([125])$/.exec(e.code);
      if (!m) return;
      e.preventDefault();
      setValue(Number(m[1]), 0, true); // release → stop
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setValue]);

  // ---- Output ------------------------------------------------------------
  const [led, setLed] = useState(0); // 0..3
  const [color, setColor] = useState('#22c55e');
  const [pixels, setPixels] = useState<(string | null)[]>([null, null, null, null]);
  const [hz, setHz] = useState(523);
  const [text, setText] = useState('Halo!');

  const lightLed = () => {
    sendCommand('NEOPIXEL_SET', { index: led, ...hexToRgb(color) });
    setPixels((prev) => prev.map((c, i) => (i === led ? color : c)));
  };

  const distance = values.ultrasonic;

  return (
    <div className={styles.labLayout}>
      <header className={styles.labHead}>
        <h1 className={styles.labTitle}>Lab I/O</h1>
        <p className={styles.labSub}>Coba setiap bagian robot satu per satu — tanpa coding.</p>
        {!connected && <p className={styles.labNotice}>Sambungkan robot dulu untuk mencoba Lab I/O.</p>}
        {connected && noAnswer && (
          <p className={styles.labNotice} role="alert">
            Robot tidak menjawab. Cek kabel atau Bluetooth, lalu coba lagi.
          </p>
        )}
      </header>

      <div className={styles.portBoardCol}>
        <PortBoard active={servo.map((v) => v !== 0)} pixelColors={pixels} />
      </div>

      <section className={styles.labCard} aria-labelledby="lab-servo">
        <h2 id="lab-servo" className={styles.labCardTitle}>Gerakkan servo</h2>
        <div className={styles.portHeader}>
          <span />
          <div className={styles.portHeaderLabels}>
            <span>Mundur</span>
            <span>Berhenti</span>
            <span>Maju</span>
          </div>
        </div>
        {SERVOS.map(({ port, label }) => {
          const v = servo[port - 1];
          return (
            <div key={port} className={styles.labServoRow}>
              <span className={styles.portNum}>{`P${port}`}</span>
              <div>
                <div className={styles.labLabel}>{label}</div>
                <div className={styles.portTrackWrap}>
                  <input
                    className={styles.portSlider}
                    type="range"
                    min={-100}
                    max={100}
                    value={v}
                    aria-label={`P${port} ${label} (kiri = mundur, kanan = maju)`}
                    style={{ background: fillBg(v) }}
                    onChange={(e) => setValue(port, Number(e.target.value))}
                    onPointerUp={() => setValue(port, 0, true)}
                    onKeyUp={() => setValue(port, 0, true)}
                  />
                  <span className={styles.portDetent} aria-hidden="true" />
                </div>
              </div>
            </div>
          );
        })}
        <p className={styles.labInfo}>
          ⓘ Servo bergerak karena sinyal PWM: lebar pulsa menentukan arah dan kecepatan. 1,5 ms = berhenti.
        </p>
      </section>

      <section className={styles.labCard} aria-labelledby="lab-sensor">
        <h2 id="lab-sensor" className={styles.labCardTitle}>Baca sensor</h2>
        <dl className={styles.labSensors}>
          <dt>Sentuh</dt>
          <dd>
            <strong>{show(values.button1, (n) => (n ? 'Disentuh' : 'Tidak'))}</strong>
            <small>Sentuh pad TOUCH 1 di board</small>
          </dd>
          <dt>Mikrofon</dt>
          <dd>
            <strong>
              {show(values.mic_level)}
              {clapping && ' · Tepuk!'}
            </strong>
            <small>Bicara atau tepuk tangan dekat robot</small>
          </dd>
          <dt>Jarak</dt>
          <dd>
            <strong>{show(distance, (n) => (n < 0 ? 'Belum terpasang' : `${n} cm`))}</strong>
            <small>Pasang sensor HC-SR04 di header Distance_Sensor</small>
          </dd>
          <dt>Analog</dt>
          <dd>
            <span className={styles.labPins}>
              {AUX_PORTS.map((p) => (
                <span key={p}>{`${p} ${show(values[`analog:${p}`])}`}</span>
              ))}
            </span>
            <small>Nilai 0–4095 dari pin G1–G6 (misal potensiometer atau sensor cahaya)</small>
          </dd>
          <dt>Digital</dt>
          <dd>
            <span className={styles.labPins}>
              {AUX_PORTS.map((p) => (
                <span key={p}>{`${p} ${show(values[`digital:${p}`])}`}</span>
              ))}
            </span>
            <small>0 atau 1 (misal tombol)</small>
          </dd>
        </dl>
        <p className={styles.labInfo}>ⓘ Analog = banyak nilai (seperti volume); digital = hanya nyala/mati.</p>
      </section>

      <section className={styles.labCard} aria-labelledby="lab-output">
        <h2 id="lab-output" className={styles.labCardTitle}>Nyalakan output</h2>
        <div className={styles.labOutRow}>
          <span className={styles.labLabel}>Pilih lampu 1–4 lalu warnanya</span>
          <div className={styles.labControls}>
            <select aria-label="Lampu" value={led} onChange={(e) => setLed(Number(e.target.value))}>
              {[0, 1, 2, 3].map((i) => (
                <option key={i} value={i}>{`LED ${i + 1}`}</option>
              ))}
            </select>
            <input type="color" aria-label="Warna lampu" value={color} onChange={(e) => setColor(e.target.value)} />
            <button type="button" className={styles.labBtn} onClick={lightLed}>
              Nyalakan
            </button>
          </div>
        </div>
        <div className={styles.labOutRow}>
          <span className={styles.labLabel}>Bunyikan buzzer</span>
          <div className={styles.labControls}>
            <button
              type="button"
              className={styles.labBtn}
              onClick={() => sendCommand('PLAY_TONE', { frequency: 880, duration_ms: 200, target: 'buzzer' })}
            >
              Buzzer
            </button>
          </div>
        </div>
        <div className={styles.labOutRow}>
          <span className={styles.labLabel}>Mainkan nada (Hz)</span>
          <div className={styles.labControls}>
            <input
              type="number"
              aria-label="Frekuensi nada (Hz)"
              min={100}
              max={4000}
              value={hz}
              onChange={(e) => setHz(Number(e.target.value))}
            />
            <button
              type="button"
              className={styles.labBtn}
              onClick={() => sendCommand('SPEAKER_TONE', { freq: Math.min(4000, Math.max(100, hz || 0)), duration_ms: 500 })}
            >
              Mainkan
            </button>
          </div>
        </div>
        <div className={styles.labOutRow}>
          <span className={styles.labLabel}>Tulis teks di layar</span>
          <div className={styles.labControls}>
            <input
              type="text"
              aria-label="Teks OLED"
              maxLength={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="button" className={styles.labBtn} onClick={() => sendCommand('DISPLAY_TEXT', { text })}>
              Tulis
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
