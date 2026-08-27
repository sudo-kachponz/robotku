// src/domain/settings.ts
//
// DOMAIN — RobotSettings model + defaults. Pure data + pure functions; no React,
// no transport, no persistence. Task 5 (Settings page) persists overrides in
// IndexedDB; modes read the effective settings to translate UI intent → SET_PORT.

export type Speed = 'Fast' | 'Medium' | 'Slow';

/** Per-port tuning: speed cap + direction invert (the "DEFAULT" toggle). */
export interface PortConfig {
  speed: Speed;
  invert: boolean;
}

export interface PortMapping {
  base: { left: number[]; right: number[]; arms: number[] };
  tank: { left: number[]; right: number[]; turret: number[] };
  joystick: { left: number[]; right: number[]; customY: number[]; customX: number[] };
}

export interface RobotSettings {
  mapping: PortMapping;
  /** Ports 1..8 → tuning. */
  ports: Record<number, PortConfig>;
}

/** Speed enum → scalar applied to SET_PORT magnitude. */
export function speedScale(speed: Speed): number {
  switch (speed) {
    case 'Fast':
      return 1;
    case 'Medium':
      return 0.66;
    case 'Slow':
      return 0.4;
  }
}

/** Apply a port's speed cap + invert to a raw -100..100 intent. */
export function applyPortTuning(value: number, cfg: PortConfig | undefined): number {
  if (!cfg) return value;
  const scaled = value * speedScale(cfg.speed);
  return cfg.invert ? -scaled : scaled;
}

export const DEFAULT_SETTINGS: RobotSettings = {
  mapping: {
    base: { left: [1, 3], right: [2, 4], arms: [5, 6] },
    tank: { left: [1, 3], right: [2, 4], turret: [5] },
    joystick: { left: [1, 3], right: [2, 4], customY: [5], customX: [6] },
  },
  ports: Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => [i + 1, { speed: 'Fast', invert: false } as PortConfig]),
  ),
};

/** Deep-ish clone so callers can edit without mutating the default. */
export function cloneSettings(s: RobotSettings): RobotSettings {
  return {
    mapping: {
      base: {
        left: [...s.mapping.base.left],
        right: [...s.mapping.base.right],
        arms: [...s.mapping.base.arms],
      },
      tank: {
        left: [...s.mapping.tank.left],
        right: [...s.mapping.tank.right],
        turret: [...s.mapping.tank.turret],
      },
      joystick: {
        left: [...s.mapping.joystick.left],
        right: [...s.mapping.joystick.right],
        customY: [...s.mapping.joystick.customY],
        customX: [...s.mapping.joystick.customX],
      },
    },
    ports: Object.fromEntries(Object.entries(s.ports).map(([k, v]) => [k, { ...v }])),
  };
}
