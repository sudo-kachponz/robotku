// src/runtime/FanOutSink.ts
//
// Forwards a RobotSink to N sinks at once. Used for "mirror mode": when a board is
// connected AND the 2D panel is open, Run streams to the TransportSink and feeds
// the same commands to the SimSink so the on-screen robot shadows the real one.
// getSensorValue resolves from the FIRST sink that returns non-null (transport
// first, sim as fallback).

import type { RobotSink } from './ProgramRunner';

export class FanOutSink implements RobotSink {
  private sinks: RobotSink[];

  constructor(sinks: RobotSink[]) {
    this.sinks = sinks;
  }

  async exec(cmd: { command: string; params: any }): Promise<void> {
    await Promise.all(this.sinks.map((s) => s.exec(cmd)));
  }

  getSensorValue(json: string): number | null {
    for (const s of this.sinks) {
      const v = s.getSensorValue(json);
      if (v != null) return v;
    }
    return null;
  }

  stopAll(): void {
    for (const s of this.sinks) s.stopAll();
  }
}
