// src/runtime/telemetryCache.ts
//
// A tiny module-level cache of the LATEST sensor value seen in inbound TELEMETRY
// frames, keyed by sensor(+port). TransportSink reads it synchronously so the
// condition sandbox never blocks. BlockCoding feeds it from the single
// onTelemetry() subscription (which also drives the Serial Monitor).

const cache = new Map<string, number>();

function key(sensor: string, port?: string | number | null): string {
  return port == null || port === '' ? sensor : `${sensor}:${port}`;
}

/**
 * Best-effort ingest of one telemetry frame. Firmware schema is not pinned, so
 * we accept any of the plausible shapes:
 *   {command:'TELEMETRY', params:{sensor, port?, value}}
 *   {sensor, port?, value}
 *   {command:'GET_SENSOR_DATA', params:{sensor, port?}, value}
 */
export function ingestTelemetry(msg: unknown): void {
  if (!msg || typeof msg !== 'object') return;
  const m = msg as Record<string, unknown>;
  const body = (m.params && typeof m.params === 'object' ? m.params : m) as Record<string, unknown>;
  const sensor = body.sensor ?? m.sensor;
  if (typeof sensor !== 'string') return;
  const rawValue = body.value ?? m.value;
  const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isFinite(value)) return;
  const port = (body.port ?? m.port) as string | number | null | undefined;
  cache.set(key(sensor, port), value);
}

/** Latest cached value for a sensor(+port), or null if none has arrived yet. */
export function getCachedSensor(sensor: string, port?: string | number | null): number | null {
  const exact = cache.get(key(sensor, port));
  if (exact != null) return exact;
  const bare = cache.get(sensor);
  return bare != null ? bare : null;
}

export function clearTelemetryCache(): void {
  cache.clear();
}
