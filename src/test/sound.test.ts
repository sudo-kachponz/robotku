// src/test/sound.test.ts
// Parity test suite for Sound & Audio blocks.

import { describe, it, expect } from 'vitest';
import { buildBlock, buildAndRun } from './harness';

describe('Parity: Sound & Audio', () => {
  it('audio_play_tone_sec generates PLAY_TONE and triggers buzzer pulse', async () => {
    const cmds = buildBlock({
      type: 'audio_play_tone_sec',
      fields: { NOTE: 'A4' },
      inputs: { DURATION: 0.1 },
    });
    expect(cmds[0]).toMatchObject({
      command: 'PLAY_TONE',
      params: { note: 'A4' },
    });

    const { state } = await buildAndRun([
      { type: 'audio_play_tone_sec', fields: { NOTE: 'A4' }, inputs: { DURATION: 0.1 } },
    ]);
    expect(state.buzzerHz).toBe(440);
  });

  it('audio_sound_effect generates PLAY_SOUND_EFFECT', async () => {
    const cmds = buildBlock({
      type: 'audio_sound_effect',
      fields: { EFFECT: 'short_beep' },
    });
    expect(cmds[0]).toMatchObject({
      command: 'PLAY_SOUND_EFFECT',
      params: { effect: 'short_beep' },
    });

    const { state } = await buildAndRun([
      { type: 'audio_sound_effect', fields: { EFFECT: 'short_beep' } },
    ]);
    expect(state.buzzerHz).toBeGreaterThan(0);
  });

  it('audio_set_volume generates SET_VOLUME and updates state volume', async () => {
    const cmds = buildBlock({
      type: 'audio_set_volume',
      fields: { VALUE: '80' },
    });
    expect(cmds[0]).toMatchObject({
      command: 'SET_VOLUME',
      params: { value: 80 },
    });

    const { state } = await buildAndRun([
      { type: 'audio_set_volume', fields: { VALUE: '80' } },
    ]);
    expect(state.volume).toBe(80);
  });

  it('audio_record generates RECORD_AUDIO and stores clip length', async () => {
    const cmds = buildBlock({
      type: 'audio_record',
      fields: { SLOT: '1' },
      inputs: { DURATION: 0.2 },
    });
    expect(cmds[0]).toMatchObject({
      command: 'RECORD_AUDIO',
      params: { slot: 1 },
    });

    const { state } = await buildAndRun([
      { type: 'audio_record', fields: { SLOT: '1' }, inputs: { DURATION: 0.2 } },
    ]);
    expect(state.clips[0]).toBeGreaterThan(0);
  });

  it('audio_play_recording generates PLAY_RECORDING and plays back a recorded slot', async () => {
    const cmds = buildBlock({ type: 'audio_play_recording', fields: { SLOT: '2', WAIT: 'false' } });
    expect(cmds[0]).toMatchObject({
      command: 'PLAY_RECORDING',
      params: { slot: 2 },
    });

    // Record into slot 2 first, then play it back → the buzzer pulses on playback.
    const { state } = await buildAndRun([
      { type: 'audio_record', fields: { SLOT: '2' }, inputs: { DURATION: 0.1 } },
      { type: 'audio_play_recording', fields: { SLOT: '2', WAIT: 'false' } },
    ]);
    expect(state.buzzerHz).toBeGreaterThan(0);
  });

  it('audio_play_tone_beat honours the BPM math: 2 beats @120bpm == 1000 ms', async () => {
    const cmds = buildBlock({
      type: 'audio_play_tone_beat',
      fields: { NOTE: 'C4', WAIT: 'true' },
      inputs: { BEATS: 2 },
    });
    expect(cmds[0]).toMatchObject({
      command: 'PLAY_TONE',
      params: { note: 'C4', beats: 2 },
    });

    // At the default 120 BPM, 2 beats = 1000 ms. Run at 4× so the wait is ~250 ms.
    const start = performance.now();
    await buildAndRun(
      [{ type: 'audio_play_tone_beat', fields: { NOTE: 'C4', WAIT: 'true' }, inputs: { BEATS: 2 } }],
      { speed: 4 },
    );
    const elapsed = performance.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(180); // ~1000ms / 4×, with slack
  });

  it('audio_set_bpm generates SET_BPM and updates state bpm', async () => {
    const cmds = buildBlock({ type: 'audio_set_bpm', fields: { BPM: '200' } });
    expect(cmds[0]).toMatchObject({ command: 'SET_BPM', params: { bpm: 200 } });

    const { state } = await buildAndRun([{ type: 'audio_set_bpm', fields: { BPM: '200' } }]);
    expect(state.bpm).toBe(200);
  });

  it('audio_stop_sounds generates STOP_SOUNDS and silences the buzzer', async () => {
    const cmds = buildBlock({ type: 'audio_stop_sounds' });
    expect(cmds[0]).toMatchObject({ command: 'STOP_SOUNDS' });

    const { state } = await buildAndRun([
      { type: 'audio_sound_effect', fields: { EFFECT: 'buzz' } },
      { type: 'audio_stop_sounds' },
    ]);
    expect(state.buzzerHz).toBe(0);
  });
});
