// src/categories/audio.ts
//
// AUDIO (#F97316) — a.md Audio category: Microphone, Tune, Volume, Tempo.

import * as Blockly from 'blockly/core';
import { defineOnce } from './_defineOnce';
import { javascriptGenerator } from 'blockly/javascript';
import { astroidV2 } from '../robotProfiles';
import { numArg, type NumOrExpr } from './_args';

const WAIT_OPTIONS: [string, string][] = [
  ['until done', 'true'],
  ['and continue', 'false'],
];
const NOTE_OPTIONS: [string, string][] = [
  ['C4', 'C4'],
  ['D4', 'D4'],
  ['E4', 'E4'],
  ['F4', 'F4'],
  ['G4', 'G4'],
  ['A4', 'A4'],
  ['B4', 'B4'],
  ['C5', 'C5'],
];

defineOnce([
  // --- Microphone ---
  {
    type: 'audio_record',
    message0: 'Record Audio in Slot %1 for %2 sec %3',
    args0: [
      { type: 'field_number', name: 'SLOT', value: 1, min: 1, max: 8, precision: 1 },
      { type: 'input_value', name: 'DURATION', check: 'Number' },
      {
        type: 'field_dropdown',
        name: 'WAIT',
        options: [
          ['and continue when done', 'false'],
          ['until done', 'true'],
        ],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'audio_blocks',
    inputsInline: true,
  },
  {
    type: 'audio_play_recording',
    message0: 'Play Recording in Slot %1 %2',
    args0: [
      { type: 'field_number', name: 'SLOT', value: 1, min: 1, max: 8, precision: 1 },
      { type: 'field_dropdown', name: 'WAIT', options: WAIT_OPTIONS },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'audio_blocks',
    inputsInline: true,
  },
  // --- Tune ---
  {
    type: 'audio_sound_effect',
    message0: 'Play Sound Effect %1 %2',
    args0: [
      {
        type: 'field_dropdown',
        name: 'EFFECT',
        options: [
          ['Short Beep', 'short_beep'],
          ['Long Beep', 'long_beep'],
          ['Chirp', 'chirp'],
          ['Buzz', 'buzz'],
          ['Ding', 'ding'],
        ],
      },
      { type: 'field_dropdown', name: 'WAIT', options: WAIT_OPTIONS },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'audio_blocks',
    inputsInline: true,
  },
  {
    type: 'audio_play_tone_sec',
    message0: 'Play tone %1 for %2 sec %3',
    args0: [
      { type: 'field_dropdown', name: 'NOTE', options: NOTE_OPTIONS },
      { type: 'input_value', name: 'DURATION', check: 'Number' },
      { type: 'field_dropdown', name: 'WAIT', options: WAIT_OPTIONS },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'audio_blocks',
    inputsInline: true,
  },
  {
    type: 'audio_play_tone_beat',
    message0: 'Play tone %1 for %2 beat %3',
    args0: [
      { type: 'field_dropdown', name: 'NOTE', options: NOTE_OPTIONS },
      { type: 'input_value', name: 'BEATS', check: 'Number' },
      { type: 'field_dropdown', name: 'WAIT', options: WAIT_OPTIONS },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'audio_blocks',
    inputsInline: true,
  },
  // --- Volume ---
  {
    type: 'audio_set_volume',
    message0: 'Set Volume to %1 %%',
    args0: [{ type: 'field_slider', name: 'VALUE', value: 80, min: 0, max: 100 }],
    previousStatement: null,
    nextStatement: null,
    style: 'audio_blocks',
    inputsInline: true,
  },
  {
    type: 'audio_stop_sounds',
    message0: 'Stop All Sounds',
    previousStatement: null,
    nextStatement: null,
    style: 'audio_blocks',
  },
  // --- Tempo ---
  {
    type: 'audio_set_bpm',
    message0: 'Set BPM to %1',
    args0: [{ type: 'field_number', name: 'BPM', value: 120, min: 20, max: 300 }],
    previousStatement: null,
    nextStatement: null,
    style: 'audio_blocks',
    inputsInline: true,
  },
]);

const num = (
  block: Blockly.Block,
  gen: typeof javascriptGenerator,
  name: string,
  dflt = 1,
): NumOrExpr => numArg(block, gen, name, dflt);
const wait = (block: Blockly.Block) => block.getFieldValue('WAIT') === 'true';

javascriptGenerator.forBlock['audio_record'] = function (block, gen) {
  return (
    JSON.stringify({
      command: astroidV2.commands.recordAudio,
      params: {
        slot: parseInt(block.getFieldValue('SLOT'), 10),
        secs: num(block, gen, 'DURATION'),
        wait: wait(block),
      },
    }) + ';'
  );
};
javascriptGenerator.forBlock['audio_play_recording'] = function (block) {
  return (
    JSON.stringify({
      command: astroidV2.commands.playRecording,
      params: { slot: parseInt(block.getFieldValue('SLOT'), 10), wait: wait(block) },
    }) + ';'
  );
};
javascriptGenerator.forBlock['audio_sound_effect'] = function (block) {
  return (
    JSON.stringify({
      command: astroidV2.commands.playSoundEffect,
      params: { effect: block.getFieldValue('EFFECT'), wait: wait(block) },
    }) + ';'
  );
};
javascriptGenerator.forBlock['audio_play_tone_sec'] = function (block, gen) {
  return (
    JSON.stringify({
      command: astroidV2.commands.playTone,
      params: {
        note: block.getFieldValue('NOTE'),
        secs: num(block, gen, 'DURATION'),
        wait: wait(block),
      },
    }) + ';'
  );
};
javascriptGenerator.forBlock['audio_play_tone_beat'] = function (block, gen) {
  return (
    JSON.stringify({
      command: astroidV2.commands.playTone,
      params: {
        note: block.getFieldValue('NOTE'),
        beats: num(block, gen, 'BEATS'),
        wait: wait(block),
      },
    }) + ';'
  );
};
javascriptGenerator.forBlock['audio_set_volume'] = function (block) {
  return (
    JSON.stringify({
      command: astroidV2.commands.setVolume,
      params: { value: parseInt(block.getFieldValue('VALUE'), 10) },
    }) + ';'
  );
};
javascriptGenerator.forBlock['audio_stop_sounds'] = function () {
  return JSON.stringify({ command: astroidV2.commands.stopSounds, params: {} }) + ';';
};
javascriptGenerator.forBlock['audio_set_bpm'] = function (block) {
  return (
    JSON.stringify({
      command: astroidV2.commands.setBpm,
      params: { bpm: parseInt(block.getFieldValue('BPM'), 10) },
    }) + ';'
  );
};

const durShadow = { DURATION: { shadow: { type: 'math_number', fields: { NUM: 1 } } } };
const beatShadow = { BEATS: { shadow: { type: 'math_number', fields: { NUM: 1 } } } };

export const audioCategory = {
  kind: 'category',
  name: 'Audio',
  categorystyle: 'audio_category',
  cssconfig: { icon: 'icon-audio' },
  contents: [
    { kind: 'label', text: 'Audio' },
    { kind: 'label', text: 'Microphone' },
    { kind: 'block', type: 'audio_record', inputs: durShadow },
    { kind: 'block', type: 'audio_play_recording' },
    { kind: 'label', text: 'Tune' },
    { kind: 'block', type: 'audio_sound_effect' },
    { kind: 'block', type: 'audio_play_tone_sec', inputs: durShadow },
    { kind: 'block', type: 'audio_play_tone_beat', inputs: beatShadow },
    { kind: 'label', text: 'Volume' },
    { kind: 'block', type: 'audio_set_volume' },
    { kind: 'block', type: 'audio_stop_sounds' },
    { kind: 'label', text: 'Tempo' },
    { kind: 'block', type: 'audio_set_bpm' },
  ],
};
