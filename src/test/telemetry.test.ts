// src/test/telemetry.test.ts
// Regression for the single-callback telemetry bug (R2 4a): onTelemetry now backs
// a Set, so multiple subscribers coexist and each gets a real unsubscribe.

import { describe, it, expect } from 'vitest';
import { onTelemetry, dispatchTelemetry } from '../app/connection';

describe('onTelemetry', () => {
  it('delivers to every subscriber and unsubscribes cleanly', () => {
    const a: unknown[] = [];
    const b: unknown[] = [];
    const unsubA = onTelemetry((m) => a.push(m));
    const unsubB = onTelemetry((m) => b.push(m));

    dispatchTelemetry('frame-1');
    expect(a).toEqual(['frame-1']);
    expect(b).toEqual(['frame-1']); // second subscriber no longer replaces the first

    unsubA();
    dispatchTelemetry('frame-2');
    expect(a).toEqual(['frame-1']); // stopped receiving
    expect(b).toEqual(['frame-1', 'frame-2']); // still works

    unsubB();
    dispatchTelemetry('frame-3');
    expect(b).toEqual(['frame-1', 'frame-2']); // fully unsubscribed
  });
});
