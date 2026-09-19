// src/pythongen/compile.ts
//
// Phase 3 — Compiler: Robotku-Python (dialect) -> RuntimeCommand[].
//
// Strategy that GUARANTEES parity (C1): we do NOT re-emit commands by hand.
// We parse the dialect into the SAME BlockSpec tree the block editor uses, build a
// headless Blockly workspace via buildTemplateWorkspace(), and run the EXISTING
// generateProgram(). Because both paths end in the same JS generators,
//   blocks -> commands  ==  blocks -> python -> commands
// holds for META_* control flow, servo/melody expansions and $expr alike.
// It also gives Python->Blocks (Phase 9) for free via parsePython().
//
// Only the dialect subset in docs/PYTHON-MODE.md is accepted; anything else raises
// a CompileError {line, message} (fed to the Problems panel in Phase 7).

import * as Blockly from 'blockly';
import type { BlockSpec, ValueSpec } from '../templates/authoring';
import { buildTemplateWorkspace } from '../templates/authoring';
import { generateProgram } from '../blockcoding/generateProgram';

export class CompileError extends Error {
  line: number;
  constructor(line: number, message: string) {
    super(message);
    this.line = line;
    this.name = 'CompileError';
  }
}

// ----------------------------------------------------------------------------
// Expression lexer + parser (single-line expressions)
// ----------------------------------------------------------------------------
type Tok = { t: string; v: string };

function lexExpr(src: string, line: number): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const two = ['==', '!=', '<=', '>='];
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') { s += src[j] + (src[j + 1] ?? ''); j += 2; continue; }
        s += src[j]; j++;
      }
      if (j >= src.length) throw new CompileError(line, 'unterminated string');
      toks.push({ t: 'str', v: s });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      toks.push({ t: 'num', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      toks.push({ t: 'name', v: src.slice(i, j) });
      i = j;
      continue;
    }
    const pair = src.slice(i, i + 2);
    if (two.includes(pair)) { toks.push({ t: 'op', v: pair }); i += 2; continue; }
    if ('+-*/%<>().,='.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    throw new CompileError(line, `unexpected token near \`${c}\``);
  }
  return toks;
}

// A tiny recursive-descent parser producing ValueSpec (BlockSpec tree / literal).
class ExprParser {
  p = 0;
  constructor(private toks: Tok[], private line: number) {}
  peek(): Tok | undefined { return this.toks[this.p]; }
  eat(v?: string): Tok {
    const t = this.toks[this.p];
    if (!t) throw new CompileError(this.line, 'unexpected end of expression');
    if (v && !(t.v === v)) throw new CompileError(this.line, `expecting \`${v}\` near \`${t.v}\``);
    this.p++;
    return t;
  }
  isOp(v: string): boolean { const t = this.peek(); return !!t && t.t === 'op' && t.v === v; }
  isName(v: string): boolean { const t = this.peek(); return !!t && t.t === 'name' && t.v === v; }

  parse(): ValueSpec { const v = this.or(); if (this.peek()) throw new CompileError(this.line, `unexpected \`${this.peek()!.v}\``); return v; }

  or(): ValueSpec {
    let a = this.and();
    while (this.isName('or')) { this.eat(); const b = this.and(); a = { type: 'logic_operation', fields: { OP: 'OR' }, inputs: { A: a, B: b } }; }
    return a;
  }
  and(): ValueSpec {
    let a = this.not();
    while (this.isName('and')) { this.eat(); const b = this.not(); a = { type: 'logic_operation', fields: { OP: 'AND' }, inputs: { A: a, B: b } }; }
    return a;
  }
  not(): ValueSpec {
    if (this.isName('not')) { this.eat(); return { type: 'logic_negate', inputs: { BOOL: this.not() } }; }
    return this.compare();
  }
  compare(): ValueSpec {
    let a = this.add();
    const map: Record<string, string> = { '==': 'EQ', '!=': 'NEQ', '<': 'LT', '<=': 'LTE', '>': 'GT', '>=': 'GTE' };
    while (this.peek()?.t === 'op' && map[this.peek()!.v]) {
      const op = this.eat().v; const b = this.add();
      a = { type: 'logic_compare', fields: { OP: map[op] }, inputs: { A: a, B: b } };
    }
    return a;
  }
  add(): ValueSpec {
    let a = this.mul();
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.eat().v; const b = this.mul();
      a = { type: 'math_arithmetic', fields: { OP: op === '+' ? 'ADD' : 'MINUS' }, inputs: { A: a, B: b } };
    }
    return a;
  }
  mul(): ValueSpec {
    let a = this.unary();
    while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
      const op = this.eat().v; const b = this.unary();
      if (op === '%') a = { type: 'math_modulo', inputs: { DIVIDEND: a, DIVISOR: b } };
      else a = { type: 'math_arithmetic', fields: { OP: op === '*' ? 'MULTIPLY' : 'DIVIDE' }, inputs: { A: a, B: b } };
    }
    return a;
  }
  unary(): ValueSpec {
    if (this.isOp('-')) {
      this.eat();
      const v = this.unary();
      if (typeof v === 'number') return -v;
      return { type: 'math_single', fields: { OP: 'NEG' }, inputs: { NUM: v } };
    }
    return this.postfix();
  }
  postfix(): ValueSpec {
    // dotted name, optional call
    const t = this.peek();
    if (t?.t === 'name' && /[A-Za-z_]/.test(t.v[0])) {
      let path = this.eat().v;
      while (this.isOp('.')) { this.eat(); path += '.' + this.eat().v; }
      if (this.isOp('(')) {
        const args = this.callArgs();
        return buildReporter(path, args, this.line);
      }
      // bare name
      if (path === 'True') return { type: 'logic_boolean', fields: { BOOL: 'TRUE' } };
      if (path === 'False') return { type: 'logic_boolean', fields: { BOOL: 'FALSE' } };
      if (path.includes('.')) throw new CompileError(this.line, `name '${path}' is not defined`);
      return { type: 'variables_get', fields: { VAR: path } };
    }
    return this.atom();
  }
  atom(): ValueSpec {
    const t = this.peek();
    if (!t) throw new CompileError(this.line, 'unexpected end of expression');
    if (t.t === 'num') { this.eat(); return t.v.includes('.') ? parseFloat(t.v) : parseInt(t.v, 10); }
    if (t.t === 'str') { this.eat(); return decodeStr(t.v); }
    if (this.isOp('(')) { this.eat(); const v = this.or(); this.eat(')'); return v; }
    throw new CompileError(this.line, `unexpected token near \`${t.v}\``);
  }
  callArgs(): CallArgs {
    this.eat('(');
    const pos: ValueSpec[] = [];
    const kw: Record<string, ValueSpec> = {};
    if (!this.isOp(')')) {
      for (;;) {
        // keyword? name '=' (not '==')
        const t = this.peek();
        if (t?.t === 'name' && this.toks[this.p + 1]?.t === 'op' && this.toks[this.p + 1].v === '=') {
          const key = this.eat().v; this.eat('='); kw[key] = this.or();
        } else {
          pos.push(this.or());
        }
        if (this.isOp(',')) { this.eat(); continue; }
        break;
      }
    }
    this.eat(')');
    return { pos, kw };
  }
}

type CallArgs = { pos: ValueSpec[]; kw: Record<string, ValueSpec> };

function decodeStr(raw: string): string {
  try { return JSON.parse('"' + raw.replace(/\\'/g, "'").replace(/"/g, '\\"') + '"'); } catch { return raw; }
}
function parseExpr(src: string, line: number): ValueSpec {
  return new ExprParser(lexExpr(src, line), line).parse();
}

// A field value must be a literal (number/string/bool), not a block expression.
function asField(v: ValueSpec, line: number): string {
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && v.type === 'logic_boolean') return v.fields!.BOOL === 'TRUE' ? 'true' : 'false';
  throw new CompileError(line, 'expecting a constant value here');
}

// ----------------------------------------------------------------------------
// Reporter calls (expressions) -> BlockSpec
// ----------------------------------------------------------------------------
function buildReporter(fn: string, a: CallArgs, line: number): BlockSpec {
  const kw = (n: string) => a.kw[n];
  switch (fn) {
    case 'sensors.button1': return { type: 'sensor_button1' };
    case 'sensors.button2': return { type: 'sensor_button2' };
    case 'sensors.is_recording': return { type: 'sensor_is_recording' };
    case 'sensors.analog': return { type: 'sensor_get_analog', fields: { PORT: asField(a.pos[0], line) } };
    case 'sensors.digital': return { type: 'sensor_get_digital', fields: { PORT: asField(a.pos[0], line) } };
    case 'sensors.ultrasonic': return { type: 'sensor_ultrasonic', fields: { PORT: asField(kw('port') ?? a.pos[0], line), UNIT: asField(kw('unit') ?? a.pos[1], line) } };
    case 'sensors.temperature': return { type: 'sensor_temperature', fields: { PORT: asField(kw('port') ?? a.pos[0], line) } };
    case 'sensors.humidity': return { type: 'sensor_humidity', fields: { PORT: asField(kw('port') ?? a.pos[0], line) } };
    case 'sensors.light': return { type: 'sensor_light', fields: { PORT: asField(kw('port') ?? a.pos[0], line) } };
    case 'sensors.distance': return { type: 'sensor_distance', fields: { PORT: asField(kw('port') ?? a.pos[0], line) } };
    case 'sensors.heading': return { type: 'sensor_heading', fields: { PORT: asField(kw('port') ?? a.pos[0], line) } };
    case 'ai.detected': return { type: 'ai_detected', fields: { LABEL: a.pos[0] ? asField(a.pos[0], line) : 'any' } };
    case 'ai.confidence': return { type: 'ai_confidence', fields: { LABEL: a.pos[0] ? asField(a.pos[0], line) : 'any' } };
    case 'ai.object_count': return { type: 'ai_object_count', fields: { LABEL: a.pos[0] ? asField(a.pos[0], line) : 'any' } };
    case 'ai.bbox': return { type: 'ai_bbox', fields: { LABEL: asField(a.pos[0], line), PART: asField(a.pos[1], line) } };
    default: throw new CompileError(line, `can't find called function '${fn}'`);
  }
}

// ----------------------------------------------------------------------------
// Statement calls -> BlockSpec (device / control API)
// ----------------------------------------------------------------------------
function buildStatement(fn: string, a: CallArgs, line: number): BlockSpec {
  const kw = (n: string) => a.kw[n];
  const F = (v: ValueSpec | undefined, d: string) => (v === undefined ? d : asField(v, line));
  switch (fn) {
    case 'robot.forward': return { type: 'move_forward', fields: { SPEED: F(kw('speed'), 'medium') }, inputs: { DURATION: a.pos[0] ?? 1 } };
    case 'robot.reverse': return { type: 'move_reverse', fields: { SPEED: F(kw('speed'), 'medium') }, inputs: { DURATION: a.pos[0] ?? 1 } };
    case 'robot.turn': {
      const dir = asField(a.pos[0], line);
      return { type: dir === 'right' ? 'move_right' : 'move_left', fields: { SPEED: F(kw('speed'), 'medium') }, inputs: { DURATION: a.pos[1] ?? 1 } };
    }
    case 'robot.steer': return { type: 'move_steer', fields: { STEERING: F(kw('steering'), '0'), SPEED: F(kw('speed'), 'medium') }, inputs: { DURATION: a.pos[0] ?? 1 } };
    case 'robot.claw': return { type: 'move_claw', fields: { SPEED: F(kw('speed'), 'medium'), DIRECTION: F(kw('direction'), 'clockwise'), PORT: F(kw('port'), 'P1') }, inputs: { DURATION: a.pos[0] ?? 1 } };
    case 'robot.stop': return { type: 'move_stop', fields: { WHEELS: F(a.pos[0], '2') } };
    case 'robot.stop_all': return { type: 'move_stop_all' };
    case 'robot.servo': return { type: 'servo_single', fields: { PORT: asField(a.pos[0], line), SPEED: asField(a.pos[1], line) }, inputs: { DURATION: a.pos[2] ?? 1 } };
    case 'robot.head': return { type: 'mechanism_set_head', fields: { PITCH: F(kw('pitch'), '90'), YAW: F(kw('yaw'), '90') } };
    case 'robot.gripper': return { type: 'mechanism_set_gripper', fields: { STATE: asField(a.pos[0], line) } };
    case 'wait': return { type: 'timing_wait', inputs: { DURATION: a.pos[0] ?? 1 } };
    case 'wait_until': return { type: 'timing_wait_until', inputs: { CONDITION: a.pos[0] } };
    case 'display.text': return { type: 'display_text', fields: { TEXT: asField(a.pos[0], line) } };
    case 'display.face': return { type: 'display_kaomoji', fields: { FACE: asField(a.pos[0], line) } };
    case 'display.brightness': return { type: 'display_set_brightness', fields: { VALUE: asField(a.pos[0], line) } };
    case 'led.color': return { type: 'set_led_color', fields: { COLOR: asField(a.pos[0], line) }, inputs: { DURATION: a.pos[1] ?? 1 } };
    case 'lcd.shape': return { type: 'lcd_shape', fields: { SHAPE: asField(a.pos[0], line) }, inputs: { DURATION: a.pos[1] ?? 1 } };
    case 'lcd.text': return { type: 'lcd_text', fields: { TEXT: asField(a.pos[0], line) }, inputs: { DURATION: a.pos[1] ?? 1 } };
    case 'lcd.clear': return { type: 'lcd_clear' };
    case 'audio.record': return { type: 'audio_record', fields: { SLOT: F(kw('slot'), '1'), WAIT: F(kw('wait'), 'true') }, inputs: { DURATION: kw('sec') ?? a.pos[0] ?? 1 } };
    case 'audio.play_recording': return { type: 'audio_play_recording', fields: { SLOT: F(kw('slot'), '1'), WAIT: F(kw('wait'), 'true') } };
    case 'audio.sound_effect': return { type: 'audio_sound_effect', fields: { EFFECT: asField(a.pos[0], line), WAIT: F(kw('wait'), 'true') } };
    case 'audio.tone': return { type: 'audio_play_tone_sec', fields: { NOTE: asField(a.pos[0], line), WAIT: F(kw('wait'), 'true') }, inputs: { DURATION: a.pos[1] ?? 1 } };
    case 'audio.tone_beat': return { type: 'audio_play_tone_beat', fields: { NOTE: asField(a.pos[0], line), WAIT: F(kw('wait'), 'true') }, inputs: { BEATS: a.pos[1] ?? 1 } };
    case 'audio.melody': return { type: 'audio_play_melody', fields: { SONG: asField(a.pos[0], line) } };
    case 'audio.volume': return { type: 'audio_set_volume', fields: { VALUE: asField(a.pos[0], line) } };
    case 'audio.stop': return { type: 'audio_stop_sounds' };
    case 'audio.bpm': return { type: 'audio_set_bpm', fields: { BPM: asField(a.pos[0], line) } };
    case 'sensors.set_analog': return { type: 'sensor_set_analog', fields: { PORT: asField(a.pos[0], line), VALUE: asField(a.pos[1], line) } };
    case 'sensors.set_digital': return { type: 'sensor_set_digital', fields: { PORT: asField(a.pos[0], line), VALUE: asField(a.pos[1], line) } };
    case 'sensors.reset_distance': return { type: 'sensor_reset_distance', fields: { PORT: asField(a.pos[0], line) } };
    case 'sensors.reset_heading': return { type: 'sensor_reset_heading', fields: { PORT: asField(a.pos[0], line) } };
    case 'ai.use_model': return { type: 'ai_use_model', fields: { MODEL: asField(a.pos[0], line) } };
    case 'ai.wait_until_seen': return { type: 'ai_wait_until_seen', fields: { LABEL: a.pos[0] ? asField(a.pos[0], line) : 'any' } };
    case 'camera.on': return { type: 'ai_camera_on', fields: { STATE: 'on' } };
    case 'camera.off': return { type: 'ai_camera_on', fields: { STATE: 'off' } };
    default: throw new CompileError(line, `can't find called function '${fn}'`);
  }
}

/** Function names the compiler understands (for autocomplete + coverage tests). */
export const KNOWN_STATEMENT_FNS = [
  'robot.forward', 'robot.reverse', 'robot.turn', 'robot.steer', 'robot.claw', 'robot.stop', 'robot.stop_all',
  'robot.servo', 'robot.head', 'robot.gripper', 'wait', 'wait_until',
  'display.text', 'display.face', 'display.brightness',
  'led.color', 'lcd.shape', 'lcd.text', 'lcd.clear',
  'audio.record', 'audio.play_recording', 'audio.sound_effect', 'audio.tone', 'audio.tone_beat', 'audio.melody', 'audio.volume', 'audio.stop', 'audio.bpm',
  'sensors.set_analog', 'sensors.set_digital', 'sensors.reset_distance', 'sensors.reset_heading',
  'ai.use_model', 'ai.wait_until_seen', 'camera.on', 'camera.off',
] as const;

// ----------------------------------------------------------------------------
// Line splitter (indentation) + suite parser
// ----------------------------------------------------------------------------
type Line = { indent: number; text: string; no: number };

function splitLines(src: string): Line[] {
  const out: Line[] = [];
  src.split('\n').forEach((raw, idx) => {
    const noComment = stripComment(raw);
    if (noComment.trim() === '') return;
    const indent = noComment.length - noComment.trimStart().length;
    out.push({ indent, text: noComment.trim(), no: idx + 1 });
  });
  return out;
}
function stripComment(s: string): string {
  let inStr = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = ''; continue; }
    if (c === '"' || c === "'") inStr = c;
    else if (c === '#') return s.slice(0, i);
  }
  return s;
}

// Parse a suite of statements at exactly `indent`, starting at lines[i]. Returns [specs, nextIndex].
function parseSuite(lines: Line[], i: number, indent: number): [BlockSpec[], number] {
  const specs: BlockSpec[] = [];
  while (i < lines.length && lines[i].indent === indent) {
    const line = lines[i];
    const text = line.text;
    // ---- compound: if / elif / else chain ----
    if (/^if\b/.test(text)) {
      const branches: { cond?: ValueSpec; body: BlockSpec[] }[] = [];
      const cond = parseHeaderCond(text, 'if', line.no);
      let [body, ni] = parseChildSuite(lines, i + 1, indent, line.no);
      branches.push({ cond, body });
      i = ni;
      while (i < lines.length && lines[i].indent === indent && /^elif\b/.test(lines[i].text)) {
        const c = parseHeaderCond(lines[i].text, 'elif', lines[i].no);
        [body, ni] = parseChildSuite(lines, i + 1, indent, lines[i].no);
        branches.push({ cond: c, body });
        i = ni;
      }
      let elseBody: BlockSpec[] | undefined;
      if (i < lines.length && lines[i].indent === indent && /^else\s*:\s*$/.test(lines[i].text)) {
        [elseBody, ni] = parseChildSuite(lines, i + 1, indent, lines[i].no);
        i = ni;
      }
      specs.push(buildIf(branches, elseBody));
      continue;
    }
    // ---- compound: loops / def ----
    let m: RegExpMatchArray | null;
    if ((m = text.match(/^while\s+True\s*:$/))) {
      const [body, ni] = parseChildSuite(lines, i + 1, indent, line.no);
      specs.push({ type: 'controls_forever', statements: { DO: body } }); i = ni; continue;
    }
    if ((m = text.match(/^while\s+(.+?)\s*:$/))) {
      const cond = parseExpr(m[1], line.no);
      const [body, ni] = parseChildSuite(lines, i + 1, indent, line.no);
      specs.push({ type: 'controls_while', inputs: { CONDITION: cond }, statements: { DO: body } }); i = ni; continue;
    }
    if ((m = text.match(/^for\s+_\s+in\s+range\s*\((.+)\)\s*:$/))) {
      const n = parseExpr(m[1], line.no);
      const [body, ni] = parseChildSuite(lines, i + 1, indent, line.no);
      specs.push({ type: 'controls_repeat_ext', inputs: { TIMES: n }, statements: { DO: body } }); i = ni; continue;
    }
    if ((m = text.match(/^def\s+([A-Za-z_]\w*)\s*\(\s*\)\s*:$/))) {
      const [body, ni] = parseChildSuite(lines, i + 1, indent, line.no);
      specs.push({ type: 'procedures_defnoreturn', fields: { NAME: m[1] }, statements: { STACK: body } }); i = ni; continue;
    }
    // ---- simple statements ----
    if (text === 'break') { specs.push({ type: 'controls_break' }); i++; continue; }
    if (text === 'continue') { specs.push({ type: 'controls_continue' }); i++; continue; }
    if (text === 'pass') { i++; continue; }
    specs.push(parseSimple(text, line.no));
    i++;
  }
  return [specs, i];
}

function parseChildSuite(lines: Line[], i: number, parentIndent: number, headerLine: number): [BlockSpec[], number] {
  if (i >= lines.length || lines[i].indent <= parentIndent) {
    throw new CompileError(headerLine, 'expected an indented block');
  }
  return parseSuite(lines, i, lines[i].indent);
}

function parseHeaderCond(text: string, kw: string, line: number): ValueSpec {
  const m = text.match(new RegExp(`^${kw}\\s+(.+?)\\s*:$`));
  if (!m) throw new CompileError(line, `expecting <expr> after \`${kw}\``);
  return parseExpr(m[1], line);
}

function buildIf(branches: { cond?: ValueSpec; body: BlockSpec[] }[], elseBody?: BlockSpec[]): BlockSpec {
  const inputs: Record<string, ValueSpec> = {};
  const statements: Record<string, BlockSpec[]> = {};
  branches.forEach((b, k) => { inputs['IF' + k] = b.cond as ValueSpec; statements['DO' + k] = b.body; });
  if (elseBody) statements['ELSE'] = elseBody;
  return {
    type: 'controls_if',
    extraState: { elseIfCount: branches.length - 1, hasElse: !!elseBody },
    inputs,
    statements,
  };
}

// A non-compound line: assignment `NAME = expr` or a statement call `fn(...)`.
function parseSimple(text: string, line: number): BlockSpec {
  const assign = matchAssign(text);
  if (assign) {
    return { type: 'variables_set', fields: { VAR: assign.name }, inputs: { VALUE: parseExpr(assign.expr, line) } };
  }
  const call = text.match(/^([A-Za-z_][\w.]*)\s*\((.*)\)\s*$/s);
  if (!call) throw new CompileError(line, `unexpected token near \`${text}\``);
  const fn = call[1];
  const args = new ExprParser(lexExpr('(' + call[2] + ')', line), line).callArgs();
  // user-defined function call?
  if (!KNOWN_STATEMENT_FNS.includes(fn as never)) {
    if (fn.includes('.')) throw new CompileError(line, `can't find called function '${fn}'`);
    return { type: 'procedures_callnoreturn', fields: { NAME: fn } };
  }
  return buildStatement(fn, args, line);
}

// Detect `name = expr` where `=` is a real assignment (depth 0, not `==`).
function matchAssign(text: string): { name: string; expr: string } | null {
  const m = text.match(/^([A-Za-z_]\w*)\s*=(?!=)\s*(.+)$/s);
  if (!m) return null;
  return { name: m[1], expr: m[2] };
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------
/** Parse dialect source into the BlockSpec tree (Phase 9 uses this to rebuild blocks). */
export function parsePython(src: string): BlockSpec[] {
  const lines = splitLines(src);
  const [specs, end] = parseSuite(lines, 0, lines.length ? lines[0].indent : 0);
  if (end !== lines.length) {
    throw new CompileError(lines[end].no, `unexpected indentation near \`${lines[end].text}\``);
  }
  return specs;
}

/** Compile dialect source into the SAME RuntimeCommand[] as generateProgram(). */
export function compilePython(src: string): unknown[] {
  const specs = parsePython(src);
  const json = buildTemplateWorkspace(specs);
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(json, ws);
    return generateProgram(ws);
  } finally {
    ws.dispose();
  }
}
