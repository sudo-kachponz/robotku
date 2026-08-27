// src/pages/cek.tsx
//
// Diagnostic page at /cek/ — mobile-first, Bahasa Indonesia, no heavy imports.
// Penguji di Surabaya buka halaman ini, tekan dua tombol uji, lalu tekan
// "Salin Hasil" dan tempel ke WhatsApp. Dari teks itu bisa diketahui: HTTPS
// jalan/tidak, browser didukung/tidak, dan error mentahnya apa.
//
// Target: < 60 kB First Load JS (no Blockly, three.js, tfjs).

import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import styles from '../styles/Cek.module.css';

/* ─── types ─── */
interface StatusItem {
  label: string;
  ok: boolean | null; // null = info-only
  detail: string;
}

interface TestResult {
  ok: boolean;
  text: string;
}

/* ─── helpers (browser-only, inline to avoid importing heavy modules) ─── */

/** Readable browser name from userAgent. */
function parseBrowser(): string {
  if (typeof navigator === 'undefined') return 'SSR';
  const ua = navigator.userAgent;

  // Order matters: Edge includes "Chrome", Chrome includes "Safari", etc.
  const edgeMatch = ua.match(/Edg(?:e|A|iOS)?\/(\d+)/);
  if (edgeMatch) return `Edge ${edgeMatch[1]}`;

  const operaMatch = ua.match(/OPR\/(\d+)/);
  if (operaMatch) return `Opera ${operaMatch[1]}`;

  const samsungMatch = ua.match(/SamsungBrowser\/(\d+)/);
  if (samsungMatch) return `Samsung Internet ${samsungMatch[1]}`;

  const chromeMatch = ua.match(/Chrome\/(\d+)/);
  if (chromeMatch) return `Chrome ${chromeMatch[1]}`;

  const safariMatch = ua.match(/Version\/(\d+(\.\d+)?).*Safari/);
  if (safariMatch) return `Safari ${safariMatch[1]}`;

  const firefoxMatch = ua.match(/Firefox\/(\d+)/);
  if (firefoxMatch) return `Firefox ${firefoxMatch[1]}`;

  return ua.slice(0, 60);
}

function parsePlatform(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  return navigator.platform || '';
}

/* NUS service UUID — same one used in the Robotku BLE transport. */
const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';

/* ─── component ─── */
export default function CekPage() {
  const [items, setItems] = useState<StatusItem[]>([]);
  const [versionSha, setVersionSha] = useState('');
  const [versionDate, setVersionDate] = useState('');
  const [usbResult, setUsbResult] = useState<TestResult | null>(null);
  const [bleResult, setBleResult] = useState<TestResult | null>(null);
  const [copied, setCopied] = useState(false);

  /* Run diagnostics once on mount (client-only). */
  useEffect(() => {
    const secure = window.isSecureContext;
    const browser = parseBrowser();
    const platform = parsePlatform();
    const hasSerial = 'serial' in navigator;
    const hasBle = 'bluetooth' in navigator;
    const hasCamera = Boolean(navigator.mediaDevices?.getUserMedia);

    const list: StatusItem[] = [];

    // 1. Secure context
    list.push({
      label: 'Halaman aman (HTTPS)?',
      ok: secure,
      detail: secure ? 'Secure context — aktif.' : 'Halaman ini bukan HTTPS. Web Bluetooth dan Serial tidak akan tersedia.',
    });

    // 2. Browser & version
    list.push({
      label: 'Browser & platform',
      ok: null,
      detail: `${browser} di ${platform}`,
    });

    // 3. Web Serial
    if (hasSerial) {
      list.push({ label: 'Web Serial tersedia?', ok: true, detail: 'navigator.serial ada.' });
    } else {
      const reason = !secure
        ? 'Tidak tersedia — halaman belum HTTPS.'
        : /Firefox/.test(navigator.userAgent)
          ? 'Tidak tersedia — Firefox tidak mendukung Web Serial. Pakai Chrome atau Edge.'
          : /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
            ? 'Tidak tersedia — Safari tidak mendukung Web Serial. Pakai Chrome.'
            : 'Tidak tersedia di browser ini. Pakai Chrome atau Edge desktop.';
      list.push({ label: 'Web Serial tersedia?', ok: false, detail: reason });
    }

    // 4. Web Bluetooth
    if (hasBle) {
      list.push({ label: 'Web Bluetooth tersedia?', ok: true, detail: 'navigator.bluetooth ada.' });
    } else {
      const reason = !secure
        ? 'Tidak tersedia — halaman belum HTTPS.'
        : /iPhone|iPad|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
          ? 'Tidak tersedia — Safari di iPhone/iPad tidak mendukungnya. Pakai Chrome di Android, atau laptop.'
          : /Firefox/.test(navigator.userAgent)
            ? 'Tidak tersedia — Firefox tidak mendukung Web Bluetooth. Pakai Chrome atau Edge.'
            : 'Tidak tersedia di browser ini. Pakai Chrome atau Edge.';
      list.push({ label: 'Web Bluetooth tersedia?', ok: false, detail: reason });
    }

    // 5. Camera
    list.push({
      label: 'Kamera tersedia?',
      ok: hasCamera,
      detail: hasCamera ? 'mediaDevices.getUserMedia ada.' : 'Tidak tersedia (mungkin halaman belum HTTPS, atau browser terlalu lama).',
    });

    setItems(list);

    // 6. Version
    fetch('/version.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        if (v) {
          setVersionSha(v.sha || '?');
          setVersionDate(v.builtAt ? new Date(v.builtAt).toLocaleString('id-ID') : '?');
        }
      })
      .catch(() => {
        /* no-op — version just stays empty */
      });
  }, []);

  /* ─── USB test ─── */
  const testUsb = useCallback(async () => {
    setUsbResult(null);
    try {
      const port = await navigator.serial.requestPort();
      setUsbResult({ ok: true, text: `Berhasil memilih port serial.${port ? '' : ''}` });
    } catch (err: unknown) {
      const e = err as Error;
      setUsbResult({
        ok: false,
        text: `${e.name}: ${e.message}`,
      });
    }
  }, []);

  /* ─── Bluetooth test ─── */
  const testBle = useCallback(async () => {
    setBleResult(null);
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [NUS_SERVICE] }],
        optionalServices: [NUS_SERVICE],
      });
      let msg = `Perangkat ditemukan: ${device.name || '(tanpa nama)'}`;
      // Try GATT connect
      try {
        const server = await device.gatt!.connect();
        msg += ` — GATT tersambung.`;
        server.disconnect();
      } catch (gattErr: unknown) {
        const ge = gattErr as Error;
        msg += ` — GATT gagal: ${ge.name}: ${ge.message}`;
      }
      setBleResult({ ok: true, text: msg });
    } catch (err: unknown) {
      const e = err as Error;
      setBleResult({
        ok: false,
        text: `${e.name}: ${e.message}`,
      });
    }
  }, []);

  /* ─── Copy to clipboard ─── */
  const copyResults = useCallback(async () => {
    const now = new Date().toLocaleString('id-ID');
    const lines = [
      `── Diagnostik Robotku ──`,
      `Waktu: ${now}`,
      `URL: ${typeof location !== 'undefined' ? location.href : ''}`,
      `Versi: ${versionSha || '?'} (build ${versionDate || '?'})`,
      ``,
      ...items.map(
        (it) =>
          `${it.ok === true ? '✅' : it.ok === false ? '❌' : 'ℹ️'} ${it.label} ${it.detail}`,
      ),
    ];
    if (usbResult) {
      lines.push(``, `USB: ${usbResult.ok ? '✅' : '❌'} ${usbResult.text}`);
    }
    if (bleResult) {
      lines.push(``, `Bluetooth: ${bleResult.ok ? '✅' : '❌'} ${bleResult.text}`);
    }

    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback for older browsers / non-secure context
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }, [items, versionSha, versionDate, usbResult, bleResult]);

  const serialAvail = typeof navigator !== 'undefined' && 'serial' in navigator;
  const bleAvail = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  return (
    <>
      <Head>
        <title>Cek Perangkat — Robotku Playground</title>
        <meta name="description" content="Halaman diagnostik Robotku — cek kesiapan browser untuk Web Serial dan Web Bluetooth." />
      </Head>

      <div className={styles.page}>
        {/* Header */}
        <header className={styles.header}>
          <img
            src="/brand/Robotku-Mascot-Logo-Horizontal.webp"
            alt="Robotku"
            className={styles.logo}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <h1 className={styles.headerTitle}>Cek Perangkat</h1>
        </header>

        <div className={styles.container}>
          {/* ─── A. Status Cards ─── */}
          <h2 className={styles.sectionTitle}>Status Browser</h2>
          <div className={styles.card}>
            {items.map((it, i) => (
              <div key={i} className={styles.row}>
                <div
                  className={`${styles.icon} ${
                    it.ok === true ? styles.iconPass : it.ok === false ? styles.iconFail : styles.iconInfo
                  }`}
                >
                  {it.ok === true ? '✓' : it.ok === false ? '✗' : 'i'}
                </div>
                <div className={styles.rowText}>
                  <div className={styles.rowLabel}>{it.label}</div>
                  <div
                    className={`${styles.rowDetail} ${it.ok === false ? styles.rowDetailFail : ''}`}
                  >
                    {it.detail}
                  </div>
                </div>
              </div>
            ))}

            {/* Version row */}
            {versionSha && (
              <div className={styles.row}>
                <div className={`${styles.icon} ${styles.iconInfo}`}>i</div>
                <div className={styles.rowText}>
                  <div className={styles.rowLabel}>Versi aplikasi</div>
                  <div className={styles.rowDetail}>
                    {versionSha} — build {versionDate}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── B. Test Buttons ─── */}
          <h2 className={styles.sectionTitle}>Uji Koneksi</h2>
          <div className={styles.btnGroup}>
            <button
              className={`${styles.testBtn} ${styles.testBtnUsb}`}
              onClick={testUsb}
              disabled={!serialAvail}
            >
              🔌 Coba Sambung USB
            </button>
            {!serialAvail && (
              <div className={`${styles.rowDetail} ${styles.rowDetailFail}`} style={{ marginTop: -4, paddingLeft: 4 }}>
                Web Serial tidak tersedia di browser ini.
              </div>
            )}
            {usbResult && (
              <div className={`${styles.testResult} ${usbResult.ok ? styles.testResultOk : styles.testResultFail}`}>
                {usbResult.ok ? '✅' : '❌'} {usbResult.text}
              </div>
            )}

            <button
              className={`${styles.testBtn} ${styles.testBtnBle}`}
              onClick={testBle}
              disabled={!bleAvail}
            >
              📡 Coba Sambung Bluetooth
            </button>
            {!bleAvail && (
              <div className={`${styles.rowDetail} ${styles.rowDetailFail}`} style={{ marginTop: -4, paddingLeft: 4 }}>
                Web Bluetooth tidak tersedia di browser ini.
              </div>
            )}
            {bleResult && (
              <div className={`${styles.testResult} ${bleResult.ok ? styles.testResultOk : styles.testResultFail}`}>
                {bleResult.ok ? '✅' : '❌'} {bleResult.text}
              </div>
            )}
          </div>

          {/* ─── C. Copy Results ─── */}
          <button className={styles.copyBtn} onClick={copyResults}>
            📋 Salin Hasil
          </button>
          {copied && (
            <div className={styles.copiedMsg}>✓ Tersalin — tempel ke WhatsApp!</div>
          )}

          {/* ─── Note ─── */}
          <div className={styles.note}>
            Halaman ini membuktikan <strong>browser siap</strong> — bukan berarti robot sudah menjawab.
            Untuk tes robot sungguhan, pastikan firmware sudah di-flash dan lolos TAHAP A di Serial Monitor,
            lalu buka <strong>/control/modes/joystick/</strong>.
          </div>
        </div>
      </div>
    </>
  );
}
