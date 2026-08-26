// src/test/harness.ts
//
// Parity harness (PROMPT C). Builds a headless Blockly workspace containing
// program_start + the block(s) under test, generates the command array via the
// SAME generateProgram() the editor uses, and runs it in a fresh SimSink so tests
// can assert the resulting SimState + the log of every exec() call.

import * as Blockly from 'blockly';
import { initializeAstroidEditor } from '../core';
import { getAstroidToolbox } from '../toolbox';
import { generateProgram } from '../blockcoding/generateProgram';
import { SimSink, type SimState } from '../runtime/SimSink';
import { ProgramRunner, type RobotSink } from '../runtime/ProgramRunner';

let inited = false;
export function ensureInit(): void {
  if (inited) return;
  initializeAstroidEditor();
  getAstroidToolbox(); // force every category module to register its blocks/generators
  inited = true;
}

export type ValueSpec = number | string | BlockSpec;
export interface BlockSpec {
  type: string;
  fields?: Record<string, string | number>;
  inputs?: Record<string, ValueSpec>;
  statements?: Record<string, BlockSpec[]>;
  /** Mutator state (e.g. controls_if else-if/else counts) applied before wiring. */
  extraState?: Record<string, unknown>;
}

function numberBlock(ws: Blockly.Workspace, n: number): Blockly.Block {
  const b = ws.newBlock('math_number');
  b.setFieldValue(String(n), 'NUM');
  return b;
}

function textBlock(ws: Blockly.Workspace, s: string): Blockly.Block {
  const b = ws.newBlock('text');
  b.setFieldValue(s, 'TEXT');
  return b;
}

/** Find or create a variable model by name (variables_set / variables_get). */
function ensureVariable(ws: Blockly.Workspace, name: string): Blockly.IVariableModel<Blockly.IVariableState> {
  const existing = ws.getAllVariables().find((v) => v.getName?.() === name || (v as any).name === name);
  return existing ?? ws.createVariable(name);
}

function createBlock(ws: Blockly.Workspace, spec: BlockSpec): Blockly.Block {
  const block = ws.newBlock(spec.type);
  // Apply mutator state first so inputs (IF1/DO1/ELSE …) exist before wiring.
  if (spec.extraState && typeof (block as any).loadExtraState === 'function') {
    (block as any).loadExtraState(spec.extraState);
  }
  if (spec.fields) {
    for (const [k, v] of Object.entries(spec.fields)) {
      const field = block.getField(k);
      // Variable fields (variables_set/get) need a real variable model + its id,
      // not a raw string, so setFieldValue would silently no-op otherwise.
      if (field instanceof Blockly.FieldVariable) {
        field.setValue(ensureVariable(ws, String(v)).getId());
      } else {
        block.setFieldValue(String(v), k);
      }
    }
  }
  if (spec.inputs) {
    for (const [name, child] of Object.entries(spec.inputs)) {
      const input = block.getInput(name);
      if (!input?.connection) continue;
      const childBlock =
        typeof child === 'number'
          ? numberBlock(ws, child)
          : typeof child === 'string'
            ? textBlock(ws, child)
            : createBlock(ws, child);
      if (childBlock.outputConnection) input.connection.connect(childBlock.outputConnection);
    }
  }
  if (spec.statements) {
    for (const [name, kids] of Object.entries(spec.statements)) {
      const input = block.getInput(name);
      let prev = input?.connection ?? null;
      for (const kidSpec of kids) {
        const kid = createBlock(ws, kidSpec);
        if (prev && kid.previousConnection) {
          prev.connect(kid.previousConnection);
          prev = kid.nextConnection;
        }
      }
    }
  }
  return block;
}

/** Build the command array for program_start + a chain of block specs. */
export function buildProgram(specs: BlockSpec[]): any[] {
  ensureInit();
  const ws = new Blockly.Workspace();
  try {
    const start = ws.newBlock('program_start');
    let prev: Blockly.Connection | null = start.nextConnection;
    for (const spec of specs) {
      const block = createBlock(ws, spec);
      if (prev && block.previousConnection) {
        prev.connect(block.previousConnection);
        prev = block.nextConnection;
      }
      // Blocks with no previousConnection (function defs) stay as separate top
      // stacks — generateProgram() appends them.
    }
    return generateProgram(ws);
  } finally {
    ws.dispose();
  }
}

/** Convenience: build a single block's program. */
export function buildBlock(spec: BlockSpec): any[] {
  return buildProgram([spec]);
}

export interface RunResult {
  state: SimState;
  log: Array<{ command: string; params: any }>;
  sink: SimSink;
  runner: ProgramRunner;
}

export interface RunOpts {
  speed?: number;
  /** Prime the virtual world (sensor values, buttons, obstacle) BEFORE the run starts. */
  before?: (sink: SimSink) => void;
}

export interface PendingRun {
  sink: SimSink;
  runner: ProgramRunner;
  log: Array<{ command: string; params: any }>;
  done: Promise<void>;
}

/**
 * Start a run WITHOUT awaiting it — for non-terminating programs (forever loops)
 * where the test drives stop()/timing itself. Await `done` after stopping.
 */
export function startRun(commands: any[], opts: RunOpts = {}): PendingRun {
  const sink = new SimSink();
  const speed = opts.speed ?? 4;
  sink.setSpeed(speed);
  const log: Array<{ command: string; params: any }> = [];
  const wrapped: RobotSink = {
    exec: (c) => {
      log.push(c);
      return sink.exec(c);
    },
    getSensorValue: (j) => sink.getSensorValue(j),
    stopAll: () => sink.stopAll(),
  };
  const runner = new ProgramRunner(wrapped);
  runner.setSpeed(speed);
  opts.before?.(sink);
  const done = runner.run(commands);
  return { sink, runner, log, done };
}

/** Build a program from specs and start it WITHOUT awaiting (for forever loops). */
export function buildAndStart(specs: BlockSpec[], opts: RunOpts = {}): PendingRun {
  return startRun(buildProgram(specs), opts);
}

/** Run a command array in a fresh SimSink (4× by default) and capture state + exec log. */
export async function runInSim(commands: any[], opts: RunOpts = {}): Promise<RunResult> {
  const pending = startRun(commands, opts);
  await pending.done;
  return { state: pending.sink.getState(), log: pending.log, sink: pending.sink, runner: pending.runner };
}

/** Build + run in one step. */
export async function buildAndRun(specs: BlockSpec[], opts?: RunOpts): Promise<RunResult> {
  return runInSim(buildProgram(specs), opts);
}

/** Deep-clone a command tree with every editor-only `_bid` block id removed. */
export function stripBids<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripBids(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>)) {
      if (k === '_bid') continue;
      out[k] = stripBids((value as Record<string, unknown>)[k]);
    }
    return out as unknown as T;
  }
  return value;
}
