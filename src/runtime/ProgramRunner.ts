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

/** Where side effects (motion, display, sound, sensors) are applied. */
export interface RobotSink {
  /** Perform one timed/instant action. Timed actions resolve when their duration elapses. */
  exec(cmd: { command: string; params: any }): Promise<void>;
  /** Synchronous, latest cached sensor value for a GET_SENSOR_DATA json string. */
  getSensorValue(getSensorDataJson: string): number | null;
  /** Zero every output and cancel any in-flight timed action. */
  stopAll(): void;
}

interface LoopFrame {
  type: 'finite' | 'infinite';
  startIndex: number;
  iterationsLeft?: number;
}

export class ProgramRunner {
  private sink: RobotSink;
  private running = false;
  private stopRequested = false;
  private wakers = new Set<() => void>();

  /** Fired before each command executes; used to highlight the running block. */
  onStep?: (pc: number, cmd: any) => void;

  constructor(sink: RobotSink) {
    this.sink = sink;
  }

  get isRunning(): boolean {
    return this.running;
  }

  async run(commands: any[]): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.stopRequested = false;

    let pc = 0;
    const loopStack: LoopFrame[] = [];

    try {
      while (pc < commands.length && !this.stopRequested) {
        const command = commands[pc];
        const commandName = command?.command;
        const before = pc;
        let pcIncrement = 1;

        this.onStep?.(pc, command);

        switch (commandName) {
          // --- Loop Commands ---
          case 'META_START_LOOP': {
            loopStack.push({
              type: 'finite',
              startIndex: pc + 1,
              iterationsLeft: command.params?.times,
            });
            break;
          }
          case 'META_START_INFINITE_LOOP': {
            loopStack.push({ type: 'infinite', startIndex: pc + 1 });
            break;
          }
          case 'META_END_LOOP': {
            if (loopStack.length > 0) {
              const currentLoop = loopStack[loopStack.length - 1];
              if (currentLoop.type === 'infinite') {
                pc = currentLoop.startIndex;
                pcIncrement = 0;
              } else if ((currentLoop.iterationsLeft ?? 0) > 1) {
                currentLoop.iterationsLeft!--;
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
              loopStack.pop();
              pc = this.findMatchingEndLoop(commands, pc);
            }
            break;
          }
          case 'META_CONTINUE_LOOP': {
            // Jump to the innermost matching END_LOOP and let it re-run the loop.
            if (loopStack.length > 0) {
              pc = this.findMatchingEndLoop(commands, pc);
              pcIncrement = 0;
            }
            break;
          }

          // --- Conditional Commands ---
          case 'META_IF':
          case 'META_ELSE_IF': {
            // Conditions are evaluated FRESH here every iteration — that is what
            // makes "forever + if sensor" react live to the world.
            const conditionMet = this.evaluateCondition(command.params?.condition);
            if (!conditionMet) {
              pc = this.findNextBranch(commands, pc);
            }
            break;
          }
          case 'META_ELSE': {
            pc = this.findMatchingEndIf(commands, pc);
            break;
          }
          case 'META_END_IF': {
            // no-op: falls through to the next command
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
              await this.sink.exec(command);
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
    }
  }

  /** Cooperative stop: awaited sleeps bail out immediately so Stop is instant. */
  stop(): void {
    this.stopRequested = true;
    for (const wake of this.wakers) wake();
    this.wakers.clear();
    this.sink.stopAll();
  }

  // --- Interruptible sleep -------------------------------------------------
  private sleep(ms: number): Promise<void> {
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
      }, ms);
      this.wakers.add(wake);
    });
  }

  private async waitUntil(condition?: string): Promise<void> {
    const start = performance.now();
    while (!this.stopRequested && !this.evaluateCondition(condition)) {
      await this.sleep(30);
      if (performance.now() - start > 60000) break; // 60 s safety cap
    }
  }

  // --- Condition sandbox (same contract as simulator_sequencer.ts) ---------
  private evaluateCondition(condition?: string): boolean {
    if (condition == null) return false;
    const trimmed = String(condition).trim().toLowerCase();
    if (trimmed === 'true') return true;
    if (trimmed === 'false' || trimmed === '') return false;

    try {
      const evaluator = new Function(
        'getSensorValue',
        'mathRandomInt',
        `return ${condition};`,
      );
      const result = evaluator(
        (json: string) => this.sink.getSensorValue(json),
        (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
      );
      return result === true;
    } catch (error) {
      console.error(`Error evaluating condition "${condition}":`, error);
      return false;
    }
  }

  // --- PC jump helpers (copied from simulator_sequencer.ts) -----------------
  private findNextBranch(commands: any[], startIndex: number): number {
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

  private findMatchingEndIf(commands: any[], startIndex: number): number {
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

  private findMatchingEndLoop(commands: any[], startIndex: number): number {
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
