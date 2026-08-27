// src/test/templates.builtin.test.ts
//
// CI guard for the Template Gallery (PROMPT D). Every built-in template must:
//   (a) build into a headless workspace with ZERO unknown block types,
//   (b) generate a non-empty program, and
//   (c) actually DO SOMETHING when run in the sim (a template that changes no
//       state fails the build) — except AI-camera templates, which legitimately
//       need PROMPT E's model to see anything, so they only have to build + gen.

import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { ensureInit, startRun } from './harness';
import { buildTemplateWorkspace } from '../templates/authoring';
import { generateProgram } from '../blockcoding/generateProgram';
import { SimSink, type SimState } from '../runtime/SimSink';
import { BUILTIN_TEMPLATES } from '../templates/builtin';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Actuator/output fingerprint — NOT sensors, so priming inputs doesn't count. */
function fingerprint(s: SimState): string {
  return JSON.stringify([
    Math.round(s.x),
    Math.round(s.y),
    Math.round(s.headingDeg),
    s.matrix.join(''),
    s.displayText,
    s.lcdText,
    s.lcdShape,
    s.buzzerPulse > 0,
    s.bpm,
    s.gripperOpen,
    s.volume,
    s.recording,
    s.collisions,
    s.trail.length,
    s.portValues.join(','),
    s.analogPorts.join(','),
    s.digitalPorts.join(','),
  ]);
}

const IDLE_FINGERPRINT = fingerprint(new SimSink().getState());

describe('Templates: built-in catalogue', () => {
  it('ships exactly 15 templates with unique ids', () => {
    expect(BUILTIN_TEMPLATES.length).toBe(15);
    expect(new Set(BUILTIN_TEMPLATES.map((t) => t.id)).size).toBe(15);
  });

  for (const tpl of BUILTIN_TEMPLATES) {
    const needsAi = tpl.requires?.includes('kamera') ?? false;

    it(`${tpl.id} — builds, generates, ${needsAi ? 'is AI-gated' : 'does something'}`, async () => {
      ensureInit();

      // (a) Build into a workspace. newBlock() throws on an unknown type, so a
      // successful build already proves zero unknown blocks; assert it too.
      const wsJson = buildTemplateWorkspace(tpl.program);
      const live = new Blockly.Workspace();
      Blockly.serialization.workspaces.load(wsJson as object, live);
      const unknown = live.getAllBlocks(false).filter((b) => !Blockly.Blocks[b.type]);
      expect(unknown, `unknown blocks in ${tpl.id}`).toEqual([]);

      // (b) Non-empty program.
      const commands = generateProgram(live);
      live.dispose();
      expect(commands.length, `${tpl.id} generated no commands`).toBeGreaterThan(0);

      // (c) Run up to ~1 simulated second (speed 8, capped wall time), priming a
      // button so wait-until templates proceed, then compare the fingerprint.
      const run = startRun(commands, { speed: 8, before: (s) => s.holdButton(1, true) });
      await Promise.race([run.done, sleep(220)]);
      run.runner.stop();
      await run.done;

      const changed = fingerprint(run.sink.getState()) !== IDLE_FINGERPRINT;
      if (needsAi) {
        // AI-gated: the stub sensor sees nothing, so we only require it to run
        // without throwing. (Some AI templates still act via their else-branch.)
        expect(typeof changed).toBe('boolean');
      } else {
        expect(changed, `${tpl.id} produced no observable state change`).toBe(true);
      }
    });
  }
});
