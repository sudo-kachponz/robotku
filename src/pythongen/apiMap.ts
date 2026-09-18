// src/pythongen/apiMap.ts
//
// SINGLE SOURCE OF TRUTH for the Robotku Python dialect: block type <-> Python
// function <-> device opcode <-> docs. Used by the Python generator (this dir),
// the compiler (compile.ts, Phase 3), autocomplete, and docs.
//
// Dialect = FAITHFUL & round-trippable (see docs/PYTHON-MODE.md §4): keyword args
// with defaults = block field defaults, enums stay strings, notes stay names,
// colours stay hex, durations are seconds. This guarantees
//   blocks -> commands  ==  blocks -> python -> commands  (parity, C1/C2).
//
// Standard Blockly blocks (logic_*, math_*, text*, variables_*, procedures_*,
// controls_if) are generated NATIVELY by blockly/python and are intentionally
// absent here — except controls_repeat_ext, overridden to `for _ in range(...)`.

import type * as Blockly from 'blockly';
import { pythonGenerator, Order } from 'blockly/python';

type Gen = typeof pythonGenerator;
type PyOut = string | [string, number];

export interface ApiEntry {
  block: string;
  category: string;
  kind: 'statement' | 'reporter' | 'structure';
  /** Device opcode, META_* opcode, or undefined for pure-expression reporters. */
  opcode?: string;
  /** docs/PYTHON-MODE docs id (Phase 8). */
  docs?: string;
  /** Blocks -> Python. Statements return 'line\n'; reporters return [expr, order]. */
  py: (b: Blockly.Block, g: Gen) => PyOut;
}

// --- helpers ---
const q = (s: unknown): string => JSON.stringify(String(s ?? '')); // python str literal
const int = (b: Blockly.Block, name: string, d = 0): number =>
  parseInt(b.getFieldValue(name), 10) || d;
const fld = (b: Blockly.Block, name: string): string => String(b.getFieldValue(name) ?? '');
const dur = (b: Blockly.Block, g: Gen): string => g.valueToCode(b, 'DURATION', Order.ATOMIC) || '1';
const stmt =
  (fn: (b: Blockly.Block, g: Gen) => string) =>
  (b: Blockly.Block, g: Gen): PyOut =>
    fn(b, g) + '\n';
const rep =
  (fn: (b: Blockly.Block) => string) =>
  (b: Blockly.Block): PyOut =>
    [fn(b), Order.FUNCTION_CALL];
// AI label: "any" -> empty arg so `ai.detected()` reads clean.
const label = (b: Blockly.Block): string => {
  const l = fld(b, 'LABEL');
  return l && l !== 'any' ? q(l) : '';
};

export const API: ApiEntry[] = [
  // ---------------- Movement (motors.ts) ----------------
  { block: 'move_forward', category: 'Movement', kind: 'statement', opcode: 'MOVE_TIMED', docs: 'movement/forward',
    py: stmt((b, g) => `robot.forward(${dur(b, g)}, speed=${q(fld(b, 'SPEED'))})`) },
  { block: 'move_reverse', category: 'Movement', kind: 'statement', opcode: 'MOVE_TIMED', docs: 'movement/reverse',
    py: stmt((b, g) => `robot.reverse(${dur(b, g)}, speed=${q(fld(b, 'SPEED'))})`) },
  { block: 'move_left', category: 'Movement', kind: 'statement', opcode: 'TURN_TIMED', docs: 'movement/turn',
    py: stmt((b, g) => `robot.turn("left", ${dur(b, g)}, speed=${q(fld(b, 'SPEED'))})`) },
  { block: 'move_right', category: 'Movement', kind: 'statement', opcode: 'TURN_TIMED', docs: 'movement/turn',
    py: stmt((b, g) => `robot.turn("right", ${dur(b, g)}, speed=${q(fld(b, 'SPEED'))})`) },
  { block: 'move_steer', category: 'Movement', kind: 'statement', opcode: 'STEER_TIMED', docs: 'movement/steer',
    py: stmt((b, g) => `robot.steer(${dur(b, g)}, steering=${int(b, 'STEERING')}, speed=${q(fld(b, 'SPEED'))})`) },
  { block: 'move_claw', category: 'Movement', kind: 'statement', opcode: 'CLAW_TIMED', docs: 'movement/claw',
    py: stmt((b, g) => `robot.claw(${dur(b, g)}, speed=${q(fld(b, 'SPEED'))}, direction=${q(fld(b, 'DIRECTION'))}, port=${q(fld(b, 'PORT'))})`) },
  { block: 'move_stop', category: 'Movement', kind: 'statement', opcode: 'STOP', docs: 'movement/stop',
    py: stmt((b) => `robot.stop(${int(b, 'WHEELS', 2)})`) },
  { block: 'move_stop_all', category: 'Movement', kind: 'statement', opcode: 'STOP_ALL', docs: 'movement/stop-all',
    py: () => 'robot.stop_all()\n' },
  { block: 'servo_single', category: 'Movement', kind: 'statement', opcode: 'SET_PORT', docs: 'movement/servo',
    py: stmt((b, g) => `robot.servo(${q(fld(b, 'PORT'))}, ${int(b, 'SPEED')}, ${dur(b, g)})`) },

  // ---------------- Timing (events.ts) ----------------
  { block: 'program_start', category: 'Timing', kind: 'structure', docs: 'timing/start', py: () => '' },
  { block: 'timing_wait', category: 'Timing', kind: 'statement', opcode: 'WAIT', docs: 'timing/wait',
    py: stmt((b, g) => `wait(${dur(b, g)})`) },
  { block: 'timing_wait_until', category: 'Timing', kind: 'statement', opcode: 'WAIT_UNTIL', docs: 'timing/wait-until',
    py: stmt((b, g) => `wait_until(${g.valueToCode(b, 'CONDITION', Order.NONE) || 'False'})`) },

  // ---------------- Program Flow (control.ts) — real Python indentation ----------------
  { block: 'controls_forever', category: 'Program Flow', kind: 'structure', opcode: 'META_START_INFINITE_LOOP', docs: 'flow/forever',
    py: (b, g) => 'while True:\n' + (g.statementToCode(b, 'DO') || g.INDENT + 'pass\n') },
  { block: 'controls_while', category: 'Program Flow', kind: 'structure', opcode: 'META_START_INFINITE_LOOP', docs: 'flow/while',
    py: (b, g) =>
      'while ' + (g.valueToCode(b, 'CONDITION', Order.NONE) || 'False') + ':\n' +
      (g.statementToCode(b, 'DO') || g.INDENT + 'pass\n') },
  { block: 'controls_repeat_ext', category: 'Program Flow', kind: 'structure', opcode: 'META_START_LOOP', docs: 'flow/repeat',
    py: (b, g) =>
      'for _ in range(' + (g.valueToCode(b, 'TIMES', Order.ATOMIC) || '10') + '):\n' +
      (g.statementToCode(b, 'DO') || g.INDENT + 'pass\n') },
  { block: 'controls_break', category: 'Program Flow', kind: 'statement', opcode: 'META_BREAK_LOOP', docs: 'flow/break', py: () => 'break\n' },
  { block: 'controls_continue', category: 'Program Flow', kind: 'statement', opcode: 'META_CONTINUE_LOOP', docs: 'flow/continue', py: () => 'continue\n' },

  // ---------------- Display (looks.ts) ----------------
  { block: 'display_matrix', category: 'Display', kind: 'statement', opcode: 'DISPLAY_MATRIX', docs: 'display/matrix',
    py: stmt((b, g) => `display.matrix(${q(fld(b, 'PATTERN'))}, ${dur(b, g)})`) },
  { block: 'display_text', category: 'Display', kind: 'statement', opcode: 'DISPLAY_TEXT', docs: 'display/text',
    py: stmt((b) => `display.text(${q(fld(b, 'TEXT'))})`) },
  { block: 'display_kaomoji', category: 'Display', kind: 'statement', opcode: 'DISPLAY_TEXT', docs: 'display/face',
    py: stmt((b) => `display.face(${q(fld(b, 'FACE'))})`) },
  { block: 'display_set_brightness', category: 'Display', kind: 'statement', opcode: 'SET_LED_BRIGHTNESS', docs: 'display/brightness',
    py: stmt((b) => `display.brightness(${int(b, 'VALUE')})`) },
  { block: 'display_clear_matrix', category: 'Display', kind: 'statement', opcode: 'CLEAR_MATRIX', docs: 'display/clear',
    py: () => 'display.clear()\n' },
  { block: 'set_led_color', category: 'Display', kind: 'statement', opcode: 'SET_LED_COLOR', docs: 'display/led-color',
    py: stmt((b, g) => `led.color(${q(fld(b, 'COLOR'))}, ${dur(b, g)})`) },
  { block: 'lcd_shape', category: 'Display', kind: 'statement', opcode: 'LCD_SHAPE', docs: 'display/lcd-shape',
    py: stmt((b, g) => `lcd.shape(${q(fld(b, 'SHAPE'))}, ${dur(b, g)})`) },
  { block: 'lcd_text', category: 'Display', kind: 'statement', opcode: 'LCD_TEXT', docs: 'display/lcd-text',
    py: stmt((b, g) => `lcd.text(${q(fld(b, 'TEXT'))}, ${dur(b, g)})`) },
  { block: 'lcd_clear', category: 'Display', kind: 'statement', opcode: 'LCD_CLEAR', docs: 'display/lcd-clear',
    py: () => 'lcd.clear()\n' },

  // ---------------- Audio (audio.ts) ----------------
  { block: 'audio_record', category: 'Audio', kind: 'statement', opcode: 'RECORD_AUDIO', docs: 'audio/record',
    py: stmt((b, g) => `audio.record(slot=${int(b, 'SLOT', 1)}, sec=${dur(b, g)}, wait=${q(fld(b, 'WAIT'))})`) },
  { block: 'audio_play_recording', category: 'Audio', kind: 'statement', opcode: 'PLAY_RECORDING', docs: 'audio/play-recording',
    py: stmt((b) => `audio.play_recording(slot=${int(b, 'SLOT', 1)}, wait=${q(fld(b, 'WAIT'))})`) },
  { block: 'audio_sound_effect', category: 'Audio', kind: 'statement', opcode: 'PLAY_SOUND_EFFECT', docs: 'audio/sound-effect',
    py: stmt((b) => `audio.sound_effect(${q(fld(b, 'EFFECT'))}, wait=${q(fld(b, 'WAIT'))})`) },
  { block: 'audio_play_tone_sec', category: 'Audio', kind: 'statement', opcode: 'PLAY_TONE', docs: 'audio/tone',
    py: stmt((b, g) => `audio.tone(${q(fld(b, 'NOTE'))}, ${dur(b, g)}, wait=${q(fld(b, 'WAIT'))})`) },
  { block: 'audio_play_tone_beat', category: 'Audio', kind: 'statement', opcode: 'PLAY_TONE', docs: 'audio/tone-beat',
    py: stmt((b, g) => `audio.tone_beat(${q(fld(b, 'NOTE'))}, ${g.valueToCode(b, 'BEATS', Order.ATOMIC) || '1'}, wait=${q(fld(b, 'WAIT'))})`) },
  { block: 'audio_play_melody', category: 'Audio', kind: 'statement', opcode: 'PLAY_TONE', docs: 'audio/melody',
    py: stmt((b) => `audio.melody(${q(fld(b, 'SONG'))})`) },
  { block: 'audio_set_volume', category: 'Audio', kind: 'statement', opcode: 'SET_VOLUME', docs: 'audio/volume',
    py: stmt((b) => `audio.volume(${int(b, 'VALUE')})`) },
  { block: 'audio_stop_sounds', category: 'Audio', kind: 'statement', opcode: 'STOP_SOUNDS', docs: 'audio/stop',
    py: () => 'audio.stop()\n' },
  { block: 'audio_set_bpm', category: 'Audio', kind: 'statement', opcode: 'SET_BPM', docs: 'audio/bpm',
    py: stmt((b) => `audio.bpm(${int(b, 'BPM', 120)})`) },

  // ---------------- Sensors & Data (sensors.ts) ----------------
  { block: 'sensor_button1', category: 'Sensors & Data', kind: 'reporter', opcode: 'GET_SENSOR_DATA', docs: 'sensors/button', py: rep(() => 'sensors.button1()') },
  { block: 'sensor_button2', category: 'Sensors & Data', kind: 'reporter', opcode: 'GET_SENSOR_DATA', docs: 'sensors/button', py: rep(() => 'sensors.button2()') },
  { block: 'sensor_is_recording', category: 'Sensors & Data', kind: 'reporter', opcode: 'GET_SENSOR_DATA', docs: 'sensors/is-recording', py: rep(() => 'sensors.is_recording()') },
  { block: 'sensor_get_analog', category: 'Sensors & Data', kind: 'reporter', opcode: 'GET_SENSOR_DATA', docs: 'sensors/analog', py: rep((b) => `sensors.analog(${q(fld(b, 'PORT'))})`) },
  { block: 'sensor_get_digital', category: 'Sensors & Data', kind: 'reporter', opcode: 'GET_SENSOR_DATA', docs: 'sensors/digital', py: rep((b) => `sensors.digital(${q(fld(b, 'PORT'))})`) },
  { block: 'sensor_ultrasonic', category: 'Sensors & Data', kind: 'reporter', opcode: 'GET_SENSOR_DATA', docs: 'sensors/ultrasonic', py: rep((b) => `sensors.ultrasonic(port=${q(fld(b, 'PORT'))}, unit=${q(fld(b, 'UNIT'))})`) },
  { block: 'sensor_temperature', category: 'Sensors & Data', kind: 'reporter', opcode: 'GET_SENSOR_DATA', docs: 'sensors/temperature', py: rep((b) => `sensors.temperature(port=${q(fld(b, 'PORT'))})`) },
  { block: 'sensor_humidity', category: 'Sensors & Data', kind: 'reporter', opcode: 'GET_SENSOR_DATA', docs: 'sensors/humidity', py: rep((b) => `sensors.humidity(port=${q(fld(b, 'PORT'))})`) },
  { block: 'sensor_light', category: 'Sensors & Data', kind: 'reporter', opcode: 'GET_SENSOR_DATA', docs: 'sensors/light', py: rep((b) => `sensors.light(port=${q(fld(b, 'PORT'))})`) },
  { block: 'sensor_distance', category: 'Sensors & Data', kind: 'reporter', opcode: 'GET_SENSOR_DATA', docs: 'sensors/distance', py: rep((b) => `sensors.distance(port=${q(fld(b, 'PORT'))})`) },
  { block: 'sensor_heading', category: 'Sensors & Data', kind: 'reporter', opcode: 'GET_SENSOR_DATA', docs: 'sensors/heading', py: rep((b) => `sensors.heading(port=${q(fld(b, 'PORT'))})`) },
  { block: 'sensor_set_analog', category: 'Sensors & Data', kind: 'statement', opcode: 'SET_ANALOG', docs: 'sensors/set-analog', py: stmt((b) => `sensors.set_analog(${q(fld(b, 'PORT'))}, ${int(b, 'VALUE')})`) },
  { block: 'sensor_set_digital', category: 'Sensors & Data', kind: 'statement', opcode: 'SET_DIGITAL', docs: 'sensors/set-digital', py: stmt((b) => `sensors.set_digital(${q(fld(b, 'PORT'))}, ${q(fld(b, 'VALUE'))})`) },
  { block: 'sensor_reset_distance', category: 'Sensors & Data', kind: 'statement', opcode: 'RESET_DISTANCE', docs: 'sensors/reset-distance', py: stmt((b) => `sensors.reset_distance(${q(fld(b, 'PORT'))})`) },
  { block: 'sensor_reset_heading', category: 'Sensors & Data', kind: 'statement', opcode: 'RESET_HEADING', docs: 'sensors/reset-heading', py: stmt((b) => `sensors.reset_heading(${q(fld(b, 'PORT'))})`) },

  // ---------------- Mechanisms (mechanisms.ts) ----------------
  { block: 'mechanism_set_head', category: 'Mechanisms', kind: 'statement', opcode: 'SET_HEAD_POSITION', docs: 'mechanisms/head',
    py: stmt((b) => `robot.head(pitch=${int(b, 'PITCH', 90)}, yaw=${int(b, 'YAW', 90)})`) },
  { block: 'mechanism_set_gripper', category: 'Mechanisms', kind: 'statement', opcode: 'SET_GRIPPER', docs: 'mechanisms/gripper',
    py: stmt((b) => `robot.gripper(${q(fld(b, 'STATE'))})`) },

  // ---------------- AI (ai.ts) ----------------
  { block: 'ai_use_model', category: 'AI', kind: 'statement', opcode: 'AI_SET_MODEL', docs: 'ai/use-model', py: stmt((b) => `ai.use_model(${q(fld(b, 'MODEL'))})`) },
  { block: 'ai_camera_on', category: 'AI', kind: 'statement', opcode: 'AI_CAMERA', docs: 'ai/camera', py: (b) => (fld(b, 'STATE') === 'on' ? 'camera.on()\n' : 'camera.off()\n') },
  { block: 'ai_detected', category: 'AI', kind: 'reporter', opcode: 'GET_AI_DATA', docs: 'ai/detected', py: rep((b) => `ai.detected(${label(b)})`) },
  { block: 'ai_confidence', category: 'AI', kind: 'reporter', opcode: 'GET_AI_DATA', docs: 'ai/confidence', py: rep((b) => `ai.confidence(${label(b)})`) },
  { block: 'ai_object_count', category: 'AI', kind: 'reporter', opcode: 'GET_AI_DATA', docs: 'ai/object-count', py: rep((b) => `ai.object_count(${label(b)})`) },
  { block: 'ai_bbox', category: 'AI', kind: 'reporter', opcode: 'GET_AI_DATA', docs: 'ai/bbox', py: rep((b) => `ai.bbox(${q(fld(b, 'LABEL'))}, ${q(fld(b, 'PART'))})`) },
  { block: 'ai_wait_until_seen', category: 'AI', kind: 'statement', opcode: 'WAIT_UNTIL', docs: 'ai/wait-until-seen', py: stmt((b) => `ai.wait_until_seen(${label(b)})`) },
  // legacy, load-only (kept so old .rbk still generate Python without throwing)
  { block: 'ai_object_detected', category: 'AI', kind: 'reporter', opcode: 'GET_AI_DATA', docs: 'ai/detected', py: rep((b) => `ai.detected(${q(fld(b, 'LABEL'))})`) },
  { block: 'ai_capture_frame', category: 'AI', kind: 'statement', docs: 'ai/detected', py: () => '' },

  // ---------------- Variables (override native so no `x = None` prelude) ----------------
  { block: 'variables_set', category: 'Variables', kind: 'statement', opcode: 'META_SET_VAR', docs: 'variables/set',
    py: stmt((b, g) => `${b.getField('VAR')?.getText() ?? 'var'} = ${g.valueToCode(b, 'VALUE', Order.NONE) || '0'}`) },
  { block: 'variables_get', category: 'Variables', kind: 'reporter', docs: 'variables/get',
    py: (b) => [b.getField('VAR')?.getText() ?? 'var', Order.ATOMIC] },

  // ---------------- Templates (templates.ts) ----------------
  { block: 'templates_comment', category: 'Templates', kind: 'statement', docs: 'templates/comment', py: stmt((b) => `# ${fld(b, 'TEXT')}`) },
];

export const API_BY_BLOCK: Readonly<Record<string, ApiEntry>> = Object.fromEntries(
  API.map((e) => [e.block, e]),
);
