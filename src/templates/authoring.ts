// src/templates/authoring.ts
//
// Authoring helper for built-in templates. Templates are declared as a tree of
// BlockSpec objects (the same ergonomic format the parity harness uses) and this
// module builds a REAL, headless Blockly workspace from them, then serialises it
// with Blockly.serialization.workspaces.save(). That guarantees:
//   - the workspace JSON is always structurally valid (Blockly built it), and
//   - it carries program_start + the whole body, ready to load into the editor.
//
// Requires the block definitions to be registered first (initializeAstroidEditor).

import * as Blockly from 'blockly';

export type ValueSpec = number | string | BlockSpec;

export interface BlockSpec {
  type: string;
  fields?: Record<string, string | number>;
  inputs?: Record<string, ValueSpec>;
  statements?: Record<string, BlockSpec[]>;
  /** Mutator state (e.g. controls_if else-if/else counts) applied before wiring. */
  extraState?: Record<string, unknown>;
}

function ensureVariable(
  ws: Blockly.Workspace,
  name: string,
): Blockly.IVariableModel<Blockly.IVariableState> {
  const existing = ws
    .getAllVariables()
    .find((v) => v.getName?.() === name || (v as any).name === name);
  return existing ?? ws.createVariable(name);
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

function createBlock(ws: Blockly.Workspace, spec: BlockSpec): Blockly.Block {
  const block = ws.newBlock(spec.type);
  if (spec.extraState && typeof (block as any).loadExtraState === 'function') {
    (block as any).loadExtraState(spec.extraState);
  }
  if (spec.fields) {
    for (const [k, v] of Object.entries(spec.fields)) {
      const field = block.getField(k);
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

/**
 * Build a full workspace (program_start + body + any top-level function defs) from
 * a program spec and return the serialised workspace JSON.
 *
 * Blocks without a previousConnection (procedures_defnoreturn) are left as separate
 * top stacks, mirroring how the editor keeps function definitions.
 */
export function buildTemplateWorkspace(program: BlockSpec[]): object {
  const ws = new Blockly.Workspace();
  try {
    const start = ws.newBlock('program_start');
    let prev: Blockly.Connection | null = start.nextConnection;
    for (const spec of program) {
      const block = createBlock(ws, spec);
      if (prev && block.previousConnection) {
        prev.connect(block.previousConnection);
        prev = block.nextConnection;
      }
    }
    const json = Blockly.serialization.workspaces.save(ws);
    // The editor's program_start is immovable & undeletable — mark it so on load.
    const startJson = (json as any)?.blocks?.blocks?.find((b: any) => b.type === 'program_start');
    if (startJson) {
      startJson.deletable = false;
      startJson.movable = false;
    }
    return json;
  } finally {
    ws.dispose();
  }
}
