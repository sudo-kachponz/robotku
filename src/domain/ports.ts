// src/domain/ports.ts
//
// The ONE port-mapping table. Movement blocks name motor ports M1..M4, Sensor
// blocks name bus ports G1..G8, and the virtual robot keeps 8 signed port slots
// (index 0..7). This maps every block-facing name to a 0-based slot so nothing in
// the runtime uses magic 0/1 indices. Imported by SimSink, TransportSink and the
// UI (SimStage / PortMode) so the strip labels tell the truth.

/** Motor ports M1..M4 occupy the first four slots (1..4 → index 0..3). */
/** Sensor/bus ports G1..G8 occupy all eight slots (1..8 → index 0..7). */
export function portIndex(name: string | number | null | undefined): number | null {
  if (name == null) return null;
  if (typeof name === 'number') {
    return name >= 1 && name <= 8 ? name - 1 : null;
  }
  const m = /^([MG])\s*([0-9]+)$/i.exec(name.trim());
  if (m) {
    const n = parseInt(m[2], 10);
    if (m[1].toUpperCase() === 'M') return n >= 1 && n <= 4 ? n - 1 : null;
    return n >= 1 && n <= 8 ? n - 1 : null;
  }
  const n = parseInt(name, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 8) return n - 1;
  return null;
}

/** Human label for the strip: "1/M1", "2/M2", … "8/G8". */
export function portLabel(index0: number): string {
  const port = index0 + 1;
  return index0 < 4 ? `${port}/M${port}` : `${port}/G${port}`;
}

export const NUM_PORTS = 8;
