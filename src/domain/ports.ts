// src/domain/ports.ts
//
// Port-name -> slot mapping for the Robotku Controller V3: 5 PWM (drive/servo)
// ports P1..P5 and 5 I2C (module) ports I1..I5. Replaces the old fake 8-slot
// M1..M4 / G1..G8 model — this board has no motor driver and no generic bus (see
// sim.md / hardware.ts). Legacy names from saved projects are migrated to P/I
// with a one-time console warning so old classroom projects still open.

import { PWM_PORTS, I2C_PORTS, type PortKind } from './hardware';

export const NUM_PWM_PORTS = PWM_PORTS.length; // 5
export const NUM_I2C_PORTS = I2C_PORTS.length; // 5
// Back-compat alias: "ports" in the drive runtime means the PWM ports.
export const NUM_PORTS = NUM_PWM_PORTS;

let warnedLegacy = false;
function warnLegacyOnce(from: string, to: string): void {
  if (warnedLegacy) return;
  warnedLegacy = true;
  console.warn(
    `[ports] Legacy port name "${from}" migrated to "${to}". This board has ` +
      `5 PWM (P1..P5) + 5 I2C (I1..I5) ports, not M1..M4 / G1..G8.`,
  );
}

/**
 * PWM/drive port -> 0-based slot (0..4). Accepts 'P1'..'P5', a bare 1..5, and
 * legacy 'M1'..'M4' (migrated with a warning). Returns null for anything else
 * (including old G6..G8, which have no equivalent on this board).
 */
export function portIndex(name: string | number | null | undefined): number | null {
  if (name == null) return null;
  if (typeof name === 'number') {
    return name >= 1 && name <= NUM_PWM_PORTS ? name - 1 : null;
  }
  const s = name.trim();
  const p = /^P\s*([1-9])$/i.exec(s);
  if (p) {
    const n = parseInt(p[1], 10);
    return n <= NUM_PWM_PORTS ? n - 1 : null;
  }
  const m = /^M\s*([1-9])$/i.exec(s); // legacy motor port
  if (m) {
    const n = parseInt(m[1], 10);
    if (n <= NUM_PWM_PORTS) {
      warnLegacyOnce(`M${n}`, `P${n}`);
      return n - 1;
    }
    return null;
  }
  const n = parseInt(s, 10);
  if (Number.isFinite(n) && n >= 1 && n <= NUM_PWM_PORTS) return n - 1;
  return null;
}

/**
 * I2C/module port -> 0-based slot (0..4). Accepts 'I1'..'I5' and legacy
 * 'G1'..'G5' (migrated). 'G6'..'G8' return null — no equivalent on this board.
 */
export function i2cIndex(name: string | number | null | undefined): number | null {
  if (name == null) return null;
  const s = String(name).trim();
  const i = /^I\s*([1-9])$/i.exec(s);
  if (i) {
    const n = parseInt(i[1], 10);
    return n <= NUM_I2C_PORTS ? n - 1 : null;
  }
  const g = /^G\s*([1-9])$/i.exec(s); // legacy bus port
  if (g) {
    const n = parseInt(g[1], 10);
    if (n <= NUM_I2C_PORTS) {
      warnLegacyOnce(`G${n}`, `I${n}`);
      return n - 1;
    }
    return null;
  }
  return null;
}

/** Strip label: 'P1 · PWM' (kind 'pwm', default) or 'I1 · I2C' (kind 'i2c'). */
export function portLabel(index0: number, kind: PortKind = 'pwm'): string {
  const n = index0 + 1;
  return kind === 'pwm' ? `P${n} · PWM` : `I${n} · I2C`;
}
