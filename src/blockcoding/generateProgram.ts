// src/blockcoding/generateProgram.ts
//
// The ONE code-generation path, shared by the editor (BlockCoding.tsx) and the
// parity test harness (src/test/*). Walks the program_start chain into a command
// array, and ALSO appends every top-level function definition so a `call` block
// has a `META_FUNC_DEF` to jump to (definitions live on their own top stacks and
// would otherwise never be emitted).

import type * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

/**
 * Robustly parse top-level `{"command":...}` JSON objects from generated code text.
 * Ignores semicolons inside string literals (e.g. inside `_bid` block IDs).
 */
export function parseCommandSegments(code: string): any[] {
  const results: any[] = [];
  const trimmed = code.trim();
  if (!trimmed) return results;

  let i = 0;
  while (i < trimmed.length) {
    const start = trimmed.indexOf('{', i);
    if (start === -1) break;

    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;

    for (let j = start; j < trimmed.length; j++) {
      const char = trimmed[j];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0) {
            end = j;
            break;
          }
        }
      }
    }

    if (end !== -1) {
      const jsonStr = trimmed.slice(start, end + 1);
      try {
        results.push(JSON.parse(jsonStr));
      } catch (err) {
        console.warn('Skipping invalid JSON segment:', jsonStr, err);
      }
      i = end + 1;
    } else {
      break;
    }
  }

  return results;
}

/** Generate the full command array for a workspace (program + function defs). */
export function generateProgram(workspace: Blockly.Workspace): any[] {
  javascriptGenerator.init(workspace);

  const topBlocks = workspace.getTopBlocks(true);
  const start = topBlocks.find((b) => b.type === 'program_start');
  const first = start?.getNextBlock();

  let code = first ? (javascriptGenerator.blockToCode(first) as string) : '';

  // Append function definitions (separate top-level stacks) so calls resolve.
  for (const b of topBlocks) {
    if (b.type === 'procedures_defnoreturn') {
      code += javascriptGenerator.blockToCode(b) as string;
    }
  }

  return parseCommandSegments(code);
}

/** Same as generateProgram but returns the JSON-array string (editor Run path). */
export function generateProgramJson(workspace: Blockly.Workspace): string {
  return JSON.stringify(generateProgram(workspace));
}
