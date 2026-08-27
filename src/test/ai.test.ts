// src/test/ai.test.ts
//
// AI blocks (PROMPT E) — the contract we CAN verify headlessly: generators emit the
// right GET_AI_DATA / AI_CAMERA / AI_SET_MODEL JSON, the sinks route GET_AI_DATA to
// cvStore, cvStore returns safe defaults when the camera is off (so an AI program
// still runs), and the old ai_object_detected block migrates to the new behaviour.
// (Live inference needs a camera + models and is exercised in the app.)

import { describe, it, expect } from 'vitest';
import { buildBlock, buildProgram, buildAndRun, stripBids, type BlockSpec } from './harness';
import { SimSink } from '../runtime/SimSink';
import { cvStore } from '../ai/cvStore';

const jsonOf = (specs: BlockSpec[]) => JSON.stringify(stripBids(buildProgram(specs)));

describe('AI: statement generators', () => {
  it('ai_camera_on emits AI_CAMERA with the on/off flag', () => {
    expect(buildBlock({ type: 'ai_camera_on', fields: { STATE: 'on' } })[0]).toMatchObject({
      command: 'AI_CAMERA',
      params: { on: true },
    });
    expect(buildBlock({ type: 'ai_camera_on', fields: { STATE: 'off' } })[0]).toMatchObject({
      command: 'AI_CAMERA',
      params: { on: false },
    });
  });

  it('ai_use_model emits AI_SET_MODEL with the chosen model id', () => {
    expect(buildBlock({ type: 'ai_use_model', fields: { MODEL: 'balloon' } })[0]).toMatchObject({
      command: 'AI_SET_MODEL',
      params: { model: 'balloon' },
    });
  });

  it('ai_wait_until_seen emits WAIT_UNTIL over a GET_AI_DATA detected condition', () => {
    const cmd = buildBlock({ type: 'ai_wait_until_seen', fields: { LABEL: 'balloon' } })[0];
    expect(cmd.command).toBe('WAIT_UNTIL');
    expect(cmd.params.condition).toContain('GET_AI_DATA');
    expect(cmd.params.condition).toContain('detected');
    expect(cmd.params.condition).toContain('balloon');
  });
});

describe('AI: reporter generators (inside a condition)', () => {
  const ifReporter = (cond: BlockSpec): BlockSpec[] => [
    {
      type: 'controls_if',
      inputs: { IF0: cond },
      statements: {
        DO0: [{ type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.2 } }],
      },
    },
  ];

  it('ai_detected emits a GET_AI_DATA detected reporter', () => {
    const json = jsonOf(ifReporter({ type: 'ai_detected', fields: { LABEL: 'open_palm' } }));
    expect(json).toContain('GET_AI_DATA');
    expect(json).toContain('detected');
    expect(json).toContain('open_palm');
  });

  it('ai_confidence emits a confidence reporter', () => {
    const json = jsonOf(
      ifReporter({
        type: 'logic_compare',
        fields: { OP: 'GT' },
        inputs: { A: { type: 'ai_confidence', fields: { LABEL: 'open_palm' } }, B: 60 },
      }),
    );
    expect(json).toContain('confidence');
    expect(json).toContain('open_palm');
  });

  it('ai_bbox carries the selected part', () => {
    const json = jsonOf(
      ifReporter({
        type: 'logic_compare',
        fields: { OP: 'GT' },
        inputs: { A: { type: 'ai_bbox', fields: { PART: 'x', LABEL: 'balloon' } }, B: 50 },
      }),
    );
    expect(json).toContain('bbox');
    expect(json).toContain('part'); // (JSON-escaped inside the condition string)
  });

  it('ai_object_count emits a count reporter', () => {
    const json = jsonOf(
      ifReporter({
        type: 'logic_compare',
        fields: { OP: 'GT' },
        inputs: { A: { type: 'ai_object_count', fields: { LABEL: 'balloon' } }, B: 0 },
      }),
    );
    expect(json).toContain('count');
  });
});

describe('AI: safe defaults when the camera is off', () => {
  it('SimSink routes GET_AI_DATA to cvStore and returns a number', () => {
    const sink = new SimSink();
    const detected = sink.getSensorValue(
      JSON.stringify({
        command: 'GET_AI_DATA',
        params: { metric: 'detected', label: 'open_palm' },
      }),
    );
    const conf = sink.getSensorValue(
      JSON.stringify({
        command: 'GET_AI_DATA',
        params: { metric: 'confidence', label: 'open_palm' },
      }),
    );
    expect(detected).toBe(0); // nothing seen
    expect(conf).toBe(0);
  });

  it('cvStore getters are safe with no camera', () => {
    expect(cvStore.getConfidence('open_palm')).toBe(0);
    expect(cvStore.getObjectCount('balloon')).toBe(0);
    expect(cvStore.getBox('balloon')).toBeNull();
    expect(cvStore.isDetected('open_palm')).toBe(false);
  });

  it('an AI program runs to completion (branch simply never fires) without crashing', async () => {
    // if confidence(open_palm) > 60 then Forward — with AI off, confidence is 0.
    const { state } = await buildAndRun([
      {
        type: 'controls_if',
        inputs: {
          IF0: {
            type: 'logic_compare',
            fields: { OP: 'GT' },
            inputs: { A: { type: 'ai_confidence', fields: { LABEL: 'open_palm' } }, B: 60 },
          },
        },
        statements: {
          DO0: [{ type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.2 } }],
        },
      },
    ]);
    expect(state.y).toBe(0); // never moved — AI saw nothing
  });

  it('ai_camera_on runs without throwing when there is no camera (jsdom)', async () => {
    await expect(
      buildAndRun([{ type: 'ai_camera_on', fields: { STATE: 'on' } }]),
    ).resolves.toBeTruthy();
  });
});

describe('AI: migration of old blocks', () => {
  it('ai_object_detected still loads and behaves like ai_detected', () => {
    const json = JSON.stringify(
      stripBids(
        buildProgram([
          {
            type: 'controls_if',
            inputs: { IF0: { type: 'ai_object_detected', fields: { LABEL: 'ball' } } },
            statements: {
              DO0: [
                { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.2 } },
              ],
            },
          },
        ]),
      ),
    );
    expect(json).toContain('GET_AI_DATA');
    expect(json).toContain('detected');
    expect(json).toContain('ball');
  });
});
