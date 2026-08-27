// src/categories/ai.ts
//
// AI (#EC2D8F) — Computer Vision blocks (PROMPT E). Reporters resolve through the
// SAME sandbox as sensor reporters: the generator emits
//   getSensorValue(JSON.stringify({command:'GET_AI_DATA', params:{...}}))
// and the sink answers it from cvStore's latest cached inference. Statements stream
// AI_CAMERA / AI_SET_MODEL. No model runs on the robot; AI programs are host-executed.

import * as Blockly from 'blockly/core';
import { defineOnce } from './_defineOnce';
import { javascriptGenerator, Order } from 'blockly/javascript';
import { CV_MODELS } from '../ai/registry';
import { cvStore } from '../ai/cvStore';

const ANY = 'any';

function prettify(label: string): string {
  return label.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Dynamic LABEL field --------------------------------------------------
// A dropdown of the current model's labels + "apa saja". It ACCEPTS any value
// (so templates and an old-label reference survive a model change) and degrades
// to just "apa saja" when no model is loaded.
class FieldLabelDropdown extends Blockly.FieldDropdown {
  constructor(value?: string) {
    super(FieldLabelDropdown.options as unknown as Blockly.MenuGeneratorFunction);
    if (value) this.setValue(value);
  }
  static options(): Blockly.MenuOption[] {
    const labels = cvStore.getState().labels ?? [];
    const opts: Blockly.MenuOption[] = labels.map((l) => [prettify(l), l]);
    opts.push(['apa saja', ANY]);
    return opts;
  }
  // Accept ANY string, even one not currently in the menu (old labels / templates).
  protected override doClassValidation_(newValue?: unknown): string | null {
    return newValue == null ? null : String(newValue);
  }
  override getText(): string {
    const v = this.getValue();
    return v === ANY ? 'apa saja' : prettify(String(v ?? ''));
  }
  static override fromJson(options: Record<string, unknown>): FieldLabelDropdown {
    return new FieldLabelDropdown(options?.label as string | undefined);
  }
}
Blockly.fieldRegistry.register('field_label_dropdown', FieldLabelDropdown);

const modelOptions = (): Blockly.MenuOption[] =>
  CV_MODELS.map((m) => [m.name, m.id] as Blockly.MenuOption);

// --- Block definitions ----------------------------------------------------
defineOnce([
  {
    type: 'ai_camera_on',
    message0: 'AI: %1 kamera',
    args0: [
      {
        type: 'field_dropdown',
        name: 'STATE',
        options: [
          ['nyalakan', 'on'],
          ['matikan', 'off'],
        ],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'ai_blocks',
    inputsInline: true,
    tooltip: 'Menyalakan / mematikan kamera AI di browser.',
  },
  {
    type: 'ai_use_model',
    message0: 'AI: pakai model %1',
    args0: [{ type: 'field_dropdown', name: 'MODEL', options: modelOptions() }],
    previousStatement: null,
    nextStatement: null,
    style: 'ai_blocks',
    inputsInline: true,
    tooltip: 'Memilih model Computer Vision yang dipakai.',
  },
  {
    type: 'ai_wait_until_seen',
    message0: 'AI: tunggu sampai %1 terlihat',
    args0: [{ type: 'field_label_dropdown', name: 'LABEL', label: ANY }],
    previousStatement: null,
    nextStatement: null,
    style: 'ai_blocks',
    inputsInline: true,
    tooltip: 'Jeda program sampai objek terlihat kamera.',
  },
  {
    type: 'ai_confidence',
    message0: '%% keyakinan %1',
    args0: [{ type: 'field_label_dropdown', name: 'LABEL', label: ANY }],
    output: 'Number',
    style: 'ai_blocks',
    inputsInline: true,
    tooltip: 'Seberapa yakin (0-100) kamera melihat objek ini.',
  },
  {
    type: 'ai_bbox',
    message0: 'Bounding Box %1 dari %2',
    args0: [
      {
        type: 'field_dropdown',
        name: 'PART',
        options: [
          ['Center X', 'x'],
          ['Center Y', 'y'],
          ['Width', 'w'],
          ['Height', 'h'],
        ],
      },
      { type: 'field_label_dropdown', name: 'LABEL', label: ANY },
    ],
    output: 'Number',
    style: 'ai_blocks',
    inputsInline: true,
    tooltip: 'Posisi/ukuran kotak objek (0-100 dari lebar/tinggi frame).',
  },
  {
    type: 'ai_object_count',
    message0: 'jumlah %1 terlihat',
    args0: [{ type: 'field_label_dropdown', name: 'LABEL', label: ANY }],
    output: 'Number',
    style: 'ai_blocks',
    inputsInline: true,
    tooltip: 'Berapa banyak objek ini yang terlihat.',
  },
  {
    type: 'ai_detected',
    message0: '%1 terdeteksi?',
    args0: [{ type: 'field_label_dropdown', name: 'LABEL', label: ANY }],
    output: 'Boolean',
    style: 'ai_blocks',
    inputsInline: true,
    tooltip: 'Benar jika objek ini terlihat kamera.',
  },
]);

// --- Generators -----------------------------------------------------------
function aiReporter(
  metric: string,
  extra: (block: Blockly.Block) => Record<string, unknown> = () => ({}),
) {
  return function (block: Blockly.Block): [string, number] {
    const params = { metric, label: block.getFieldValue('LABEL') || ANY, ...extra(block) };
    const json = JSON.stringify({ command: 'GET_AI_DATA', params });
    return [`getSensorValue(${JSON.stringify(json)})`, Order.FUNCTION_CALL];
  };
}

javascriptGenerator.forBlock['ai_confidence'] = aiReporter('confidence');
javascriptGenerator.forBlock['ai_object_count'] = aiReporter('count');
javascriptGenerator.forBlock['ai_bbox'] = aiReporter('bbox', (b) => ({
  part: b.getFieldValue('PART'),
}));

javascriptGenerator.forBlock['ai_detected'] = function (block): [string, number] {
  const json = JSON.stringify({
    command: 'GET_AI_DATA',
    params: { metric: 'detected', label: block.getFieldValue('LABEL') || ANY },
  });
  return [`(getSensorValue(${JSON.stringify(json)}) === 1)`, Order.EQUALITY];
};

javascriptGenerator.forBlock['ai_camera_on'] = function (block) {
  return (
    JSON.stringify({
      command: 'AI_CAMERA',
      params: { on: block.getFieldValue('STATE') === 'on' },
    }) + ';'
  );
};

javascriptGenerator.forBlock['ai_use_model'] = function (block) {
  return (
    JSON.stringify({ command: 'AI_SET_MODEL', params: { model: block.getFieldValue('MODEL') } }) +
    ';'
  );
};

javascriptGenerator.forBlock['ai_wait_until_seen'] = function (block) {
  const json = JSON.stringify({
    command: 'GET_AI_DATA',
    params: { metric: 'detected', label: block.getFieldValue('LABEL') || ANY },
  });
  const condition = `(getSensorValue(${JSON.stringify(json)}) === 1)`;
  return JSON.stringify({ command: 'WAIT_UNTIL', params: { condition } }) + ';';
};

// --- Migration: keep the OLD stub blocks loadable, behaving as the new ones so
// projects saved before PROMPT E don't break. Not shown in the toolbox.
defineOnce([
  {
    type: 'ai_object_detected',
    message0: 'AI: object %1 detected?',
    args0: [{ type: 'field_input', name: 'LABEL', text: 'ball' }],
    output: 'Boolean',
    style: 'ai_blocks',
    inputsInline: true,
    tooltip: 'Blok lama — kini setara dengan “terdeteksi?”.',
  },
  {
    type: 'ai_capture_frame',
    message0: 'AI: capture frame',
    previousStatement: null,
    nextStatement: null,
    style: 'ai_blocks',
    tooltip: 'Blok lama — tidak melakukan apa-apa.',
  },
]);
javascriptGenerator.forBlock['ai_object_detected'] = function (block): [string, number] {
  const json = JSON.stringify({
    command: 'GET_AI_DATA',
    params: { metric: 'detected', label: block.getFieldValue('LABEL') || ANY },
  });
  return [`(getSensorValue(${JSON.stringify(json)}) === 1)`, Order.EQUALITY];
};
javascriptGenerator.forBlock['ai_capture_frame'] = function () {
  return '';
};

export const aiCategory = {
  kind: 'category',
  name: 'AI',
  categorystyle: 'ai_category',
  cssconfig: { icon: 'icon-ai' },
  contents: [
    { kind: 'label', text: 'AI Kamera' },
    { kind: 'block', type: 'ai_camera_on' },
    { kind: 'block', type: 'ai_use_model' },
    { kind: 'label', text: 'Lihat' },
    { kind: 'block', type: 'ai_detected' },
    { kind: 'block', type: 'ai_confidence' },
    { kind: 'block', type: 'ai_object_count' },
    { kind: 'block', type: 'ai_bbox' },
    { kind: 'block', type: 'ai_wait_until_seen' },
  ],
};
