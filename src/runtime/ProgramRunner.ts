// src/runtime/ProgramRunner.ts
//
// Headless async interpreter over the {"command":...,"params":{...}} command
// array. This is the SHARED runtime the Block Coding editor uses so a program can
// run with NO WebGL context: offline (SimSink) or connected (TransportSink).
//
// The control-flow semantics (pc/while loop + LoopFrame stack + the
// findMatchingEndLoop / findNextBranch / findMatchingEndIf helpers) are copied
// verbatim from src/simulator_sequencer.ts::runCommandSequence so both paths
// behave identically. On top of that we also handle META_CONTINUE_LOOP,
// META_END_IF and WAIT_UNTIL, which the 3D sequencer left as no-ops.

import { showToast } from '../ui/toast';
import type { RuntimeCommand, CommandParams } from '../domain/protocol';

/** Read a params field as a finite number, else a default. */
const numOf = (v: unknown, dflt = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};
/** Read a params field as a string array (function arg names / call args). */
const arrOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Where side effects (motion, display, sound, sensors) are applied. */
export interface RobotSink {
  /** Perform one timed/instant action. Timed actions resolve when their duration elapses. */
  exec(cmd: RuntimeCommand): Promise<void>;
  /** Synchronous, latest cached sensor value for a GET_SENSOR_DATA json string. */
  getSensorValue(getSensorDataJson: string): number | null;
  /** Zero every output and cancel any in-flight timed action. */
  stopAll(): void;
}

interface LoopFrame {
  type: 'finite' | 'infinite';
  startIndex: number;
  iterationsLeft?: number;
  total?: number; // finite loops: original `times`, for the iteration counter
  ifDepth: number; // ifStack length at loop entry, so break/continue can't leak if-frames
}

interface IfFrame {
  taken: boolean; // has any branch (if/else-if/else) of this conditional already run?
}

interface FuncEntry {
  startPc: number;
  endPc: number;
  argNames: string[];
}

interface CallFrame {
  returnPc: number;
  savedArgs: Record<string, unknown>;
  savedLoopStack: LoopFrame[];
  savedIfStack: IfFrame[];
}

const sanitize = (name: unknown): string => String(name ?? 'var').replace(/[^A-Za-z0-9_]/g, '_');

export class ProgramRunner {
  private sink: RobotSink;
  private running = false;
  private stopRequested = false;
  private wakers = new Set<() => void>();

  // Run-time variable scope (cleared each run) + compiled-expression cache so a
  // forever loop never recompiles the same expression.
  private scope: Record<string, unknown> = {};
  private compileCache = new Map<string, (...args: unknown[]) => unknown>();

  // Run controls (PROMPT B): time scaling + pause/step gate.
  private speed = 1;
  private paused = false;
  private stepOnce = false;
  private gateResolvers: Array<() => void> = [];

  /** Fired before each command executes; used to highlight the running block. */
  onStep?: (pc: number, cmd: RuntimeCommand | null) => void;
  /** Fired whenever the variable scope changes; used by the Variables watch. */
  onScopeChange?: (scope: Record<string, unknown>) => void;
  /** Fired with lightweight status (innermost loop iteration) for the status strip. */
  onStatus?: (status: { loopIteration: number }) => void;

  constructor(sink: RobotSink) {
    this.sink = sink;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** 0.25 | 0.5 | 1 | 2 | 4 — scales every sleep (never below 1 ms). */
  setSpeed(mult: number): void {
    this.speed = mult > 0 ? mult : 1;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.flushGate();
  }

  /** Execute exactly one more command, then pause again. */
  step(): void {
    if (this.paused) {
      this.stepOnce = true;
      this.flushGate();
    }
  }

  private flushGate(): void {
    const resolvers = this.gateResolvers;
    this.gateResolvers = [];
    for (const r of resolvers) r();
  }

  /** Awaited at the top of the loop; blocks while paused unless a step token exists. */
  private async gate(): Promise<void> {
    while (this.paused && !this.stepOnce && !this.stopRequested) {
      await new Promise<void>((res) => this.gateResolvers.push(res));
    }
    if (this.stepOnce) this.stepOnce = false;
  }

  get isRunning(): boolean {
    return this.running;
  }

  async run(commands: RuntimeCommand[]): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.stopRequested = false;
    this.scope = {};
    this.compileCache.clear();

    let pc = 0;
    let loopStack: LoopFrame[] = [];
    let ifStack: IfFrame[] = [];
    const callStack: CallFrame[] = [];

    // --- Pre-pass: index functions and pre-declare variables ---------------
    const funcTable = new Map<string, FuncEntry>();
    for (let i = 0; i < commands.length; i++) {
      const c = commands[i];
      if (c?.command === 'META_FUNC_DEF') {
        funcTable.set(String(c.params?.name), {
          startPc: i,
          endPc: this.findMatchingFuncEnd(commands, i),
          argNames: arrOf(c.params?.args).map((n) => sanitize(n)),
        });
      } else if (c?.command === 'META_SET_VAR') {
        const n = sanitize(c.params?.name);
        if (!(n in this.scope)) this.scope[n] = 0; // so `set x to x + 1` works first run
      }
    }
    this.onScopeChange?.({ ...this.scope });

    try {
      while (pc < commands.length && !this.stopRequested) {
        const command = commands[pc];
        const commandName = command?.command;
        const before = pc;
        let pcIncrement = 1;

        this.onStep?.(pc, command);

        // Step/pause gate (PROMPT B). Blocks here while paused.
        await this.gate();
        if (this.stopRequested) break;

        switch (commandName) {
          // --- Variables ---
          case 'META_SET_VAR': {
            this.scope[sanitize(command.params?.name)] = this.resolveParams(command.params?.value);
            this.onScopeChange?.({ ...this.scope });
            break;
          }

          // --- Functions ---
          case 'META_FUNC_DEF': {
            // Definitions must not run inline — skip straight to the matching end.
            const entry = funcTable.get(String(command.params?.name));
            pc = entry ? entry.endPc : this.findMatchingFuncEnd(commands, pc);
            break;
          }
          case 'META_CALL': {
            if (callStack.length >= 32) {
              showToast('Fungsi memanggil dirinya terlalu dalam', 'error');
              this.stopRequested = true;
              break;
            }
            const entry = funcTable.get(String(command.params?.name));
            if (!entry) break; // unknown function → no-op
            const argValues = arrOf(command.params?.args).map((a) => this.resolveParams(a));
            const savedArgs: Record<string, unknown> = {};
            entry.argNames.forEach((n, idx) => {
              savedArgs[n] = this.scope[n];
              this.scope[n] = argValues[idx];
            });
            callStack.push({ returnPc: pc + 1, savedArgs, savedLoopStack: loopStack, savedIfStack: ifStack });
            loopStack = []; // a break inside the function must not escape the caller's loop
            ifStack = []; // ...nor may an if inside the function see the caller's frames
            pc = entry.startPc + 1;
            pcIncrement = 0;
            this.onScopeChange?.({ ...this.scope });
            break;
          }
          case 'META_FUNC_END':
          case 'META_RETURN': {
            const frame = callStack.pop();
            if (frame) {
              for (const k of Object.keys(frame.savedArgs)) {
                if (frame.savedArgs[k] === undefined) delete this.scope[k];
                else this.scope[k] = frame.savedArgs[k];
              }
              loopStack = frame.savedLoopStack;
              ifStack = frame.savedIfStack;
              pc = frame.returnPc;
              pcIncrement = 0;
              this.onScopeChange?.({ ...this.scope });
            }
            break;
          }

          // --- Loop Commands ---
          case 'META_START_LOOP': {
            loopStack.push({
              type: 'finite',
              startIndex: pc + 1,
              iterationsLeft: numOf(command.params?.times),
              total: numOf(command.params?.times),
              ifDepth: ifStack.length,
            });
            this.onStatus?.({ loopIteration: 1 });
            break;
          }
          case 'META_START_INFINITE_LOOP': {
            loopStack.push({ type: 'infinite', startIndex: pc + 1, iterationsLeft: 0, ifDepth: ifStack.length });
            this.onStatus?.({ loopIteration: 1 });
            break;
          }
          case 'META_END_LOOP': {
            if (loopStack.length > 0) {
              const currentLoop = loopStack[loopStack.length - 1];
              if (currentLoop.type === 'infinite') {
                currentLoop.iterationsLeft = (currentLoop.iterationsLeft ?? 0) + 1;
                this.onStatus?.({ loopIteration: currentLoop.iterationsLeft });
                pc = currentLoop.startIndex;
                pcIncrement = 0;
              } else if ((currentLoop.iterationsLeft ?? 0) > 1) {
                currentLoop.iterationsLeft!--;
                this.onStatus?.({ loopIteration: (currentLoop.total ?? 0) - currentLoop.iterationsLeft! + 1 });
                pc = currentLoop.startIndex;
                pcIncrement = 0;
              } else {
                loopStack.pop();
              }
            }
            break;
          }
          case 'META_BREAK_LOOP': {
            if (loopStack.length > 0) {
              const frame = loopStack.pop()!;
              ifStack.length = frame.ifDepth; // drop if-frames opened inside the loop body
              pc = this.findMatchingEndLoop(commands, pc);
            }
            break;
          }
          case 'META_CONTINUE_LOOP': {
            // Jump to the innermost matching END_LOOP and let it re-run the loop.
            if (loopStack.length > 0) {
              ifStack.length = loopStack[loopStack.length - 1].ifDepth; // same leak guard
              pc = this.findMatchingEndLoop(commands, pc);
              pcIncrement = 0;
            }
            break;
          }

          // --- Conditional Commands ---
          // An if/else-if/else chain runs EXACTLY ONE branch. We track that with an
          // IfFrame (`taken`) so, once a branch fires, later else-if/else markers skip
          // straight to END_IF instead of re-running. Conditions are evaluated FRESH
          // here every iteration, so "forever + if sensor" still reacts live.
          case 'META_IF': {
            const frame: IfFrame = { taken: false };
            ifStack.push(frame);
            if (this.evaluateCondition(command.params?.condition)) {
              frame.taken = true; // enter this branch's body (fall through)
            } else {
              pc = this.findNextBranch(commands, pc); // land ON the next branch marker
              pcIncrement = 0;
            }
            break;
          }
          case 'META_ELSE_IF': {
            const frame = ifStack[ifStack.length - 1];
            if (!frame || frame.taken) {
              pc = this.findMatchingEndIf(commands, pc); // a branch already ran → skip rest
              pcIncrement = 0;
            } else if (this.evaluateCondition(command.params?.condition)) {
              frame.taken = true;
            } else {
              pc = this.findNextBranch(commands, pc);
              pcIncrement = 0;
            }
            break;
          }
          case 'META_ELSE': {
            const frame = ifStack[ifStack.length - 1];
            if (frame && frame.taken) {
              pc = this.findMatchingEndIf(commands, pc); // a branch already ran → skip else
              pcIncrement = 0;
            } else if (frame) {
              frame.taken = true; // no branch ran yet → execute the else body
            }
            break;
          }
          case 'META_END_IF': {
            ifStack.pop();
            break;
          }

          // --- Timing that depends on live conditions ---
          case 'WAIT_UNTIL': {
            await this.waitUntil(command.params?.condition);
            break;
          }

          // --- Everything else is a side-effecting action ---
          default: {
            if (commandName) {
              // Resolve any `{$expr}` params (variables/math/sensor reporters)
              // against the live scope right before executing, so the sink and
              // the firmware only ever see plain literals.
              const params = (this.resolveParams(command.params) as CommandParams | undefined) ?? {};
              await this.sink.exec({ command: commandName, params });
            }
          }
        }

        pc += pcIncrement;

        // Safety: never let a tight loop (e.g. forever with only an if) freeze the
        // UI. A backward jump (loop restart) floors at ~4 ms and yields to the
        // event loop so rendering + Stop stay responsive; forward steps just yield
        // a microtask so finite programs stay fast.
        if (this.stopRequested) break;
        if (pc <= before) {
          await this.sleep(4);
        } else {
          await Promise.resolve();
        }
      }
    } catch (error) {
      console.error('Error during program run:', error);
    } finally {
      this.sink.stopAll();
      this.running = false;
      this.onStep?.(-1, null);
      // Release compiled condition/expression Functions so an edited program that
      // is re-run never accumulates another closure per run (R3 leak audit #4).
      this.compileCache.clear();
      this.scope = {};
    }
  }

  /** Cooperative stop: awaited sleeps bail out immediately so Stop is instant. */
  stop(): void {
    this.stopRequested = true;
    this.paused = false;
    this.flushGate();
    for (const wake of this.wakers) wake();
    this.wakers.clear();
    this.sink.stopAll();
  }

  // --- Interruptible sleep (scaled by the speed multiplier) ----------------
  private sleep(ms: number): Promise<void> {
    const scaled = Math.max(1, ms / this.speed);
    return new Promise<void>((resolve) => {
      if (this.stopRequested) {
        resolve();
        return;
      }
      const wake = () => {
        clearTimeout(timer);
        this.wakers.delete(wake);
        resolve();
      };
      const timer = setTimeout(() => {
        this.wakers.delete(wake);
        resolve();
      }, scaled);
      this.wakers.add(wake);
    });
  }

  private async waitUntil(condition?: unknown): Promise<void> {
    const start = performance.now();
    while (!this.stopRequested && !this.evaluateCondition(condition)) {
      await this.sleep(30);
      if (performance.now() - start > 60000) {
        showToast('Menunggu terlalu lama — dilewati', 'info');
        break; // 60 s safety cap
      }
    }
  }

  // --- Expression sandbox (shared by conditions + $expr params) ------------
  // Compiles `new Function('getSensorValue','mathRandomInt', ...scopeKeys, ...)`
  // so variables are real identifiers; cached per (scope-key-set + expression).
  private evalExpr(expr: string): unknown {
    const keys = Object.keys(this.scope);
    const cacheKey = keys.join(',') + '::' + expr;
    let fn = this.compileCache.get(cacheKey);
    if (!fn) {
       
      fn = new Function('getSensorValue', 'mathRandomInt', ...keys, `return (${expr});`) as (
        ...args: unknown[]
      ) => unknown;
      this.compileCache.set(cacheKey, fn);
    }
    return fn(
      (json: string) => this.sink.getSensorValue(json),
      (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
      ...keys.map((k) => this.scope[k]),
    );
  }

  private evaluateCondition(condition?: unknown): boolean {
    if (condition == null) return false;
    const trimmed = String(condition).trim().toLowerCase();
    if (trimmed === 'true') return true;
    if (trimmed === 'false' || trimmed === '') return false;
    try {
      return this.evalExpr(String(condition)) === true;
    } catch (error) {
      console.error(`Error evaluating condition "${String(condition)}":`, error);
      return false;
    }
  }

  /** Deep-resolve `{$expr}` nodes in a params tree; everything else passes through. */
  private resolveParams(value: unknown): unknown {
    if (value == null) return value;
    if (Array.isArray(value)) return value.map((v) => this.resolveParams(v));
    if (typeof value === 'object') {
      const rec = value as Record<string, unknown>;
      if (typeof rec.$expr === 'string') {
        try {
          return this.evalExpr(rec.$expr);
        } catch {
          return 0;
        }
      }
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(rec)) out[k] = this.resolveParams(rec[k]);
      return out;
    }
    return value;
  }

  private findMatchingFuncEnd(commands: RuntimeCommand[], startIndex: number): number {
    for (let i = startIndex + 1; i < commands.length; i++) {
      if (commands[i].command === 'META_FUNC_END') return i;
    }
    return commands.length;
  }

  // --- PC jump helpers (copied from simulator_sequencer.ts) -----------------
  private findNextBranch(commands: RuntimeCommand[], startIndex: number): number {
    let nestLevel = 0;
    for (let i = startIndex + 1; i < commands.length; i++) {
      const cmd = commands[i].command;
      if (cmd === 'META_IF') nestLevel++;
      if (cmd === 'META_END_IF') {
        if (nestLevel === 0) return i;
        nestLevel--;
      }
      if (nestLevel === 0 && (cmd === 'META_ELSE_IF' || cmd === 'META_ELSE')) {
        return i;
      }
    }
    return commands.length;
  }

  private findMatchingEndIf(commands: RuntimeCommand[], startIndex: number): number {
    let nestLevel = 0;
    for (let i = startIndex + 1; i < commands.length; i++) {
      const cmd = commands[i].command;
      if (cmd === 'META_IF') nestLevel++;
      if (cmd === 'META_END_IF') {
        if (nestLevel === 0) return i;
        nestLevel--;
      }
    }
    return commands.length;
  }

  private findMatchingEndLoop(commands: RuntimeCommand[], startIndex: number): number {
    let nestLevel = 0;
    for (let i = startIndex + 1; i < commands.length; i++) {
      const cmd = commands[i].command;
      if (cmd === 'META_START_LOOP' || cmd === 'META_START_INFINITE_LOOP') {
        nestLevel++;
      } else if (cmd === 'META_END_LOOP') {
        if (nestLevel === 0) return i;
        nestLevel--;
      }
    }
    return commands.length;
  }
}
