// src/templates/insert.ts
//
// Insert a template's workspace JSON into the LIVE editor without the two classic
// hazards: duplicate block ids (inserting the same template twice) and a bloated
// undo history (one Ctrl+Z should remove a whole template). Two modes:
//   - 'replace' : clear the canvas and load the template outright.
//   - 'append'  : drop the template's body as a fresh stack to the right, giving
//                 every block a NEW id and reusing/creating variables by name.

import * as Blockly from 'blockly';

type BlockState = Record<string, any>;
interface WorkspaceJson {
  blocks?: { blocks?: BlockState[] };
  variables?: Array<{ name: string; id: string; type?: string }>;
}

const genUid = () => Blockly.utils.idGenerator.genUid();

/** Deep-clone a block state, assigning fresh ids and remapping variable field ids. */
export function remapBlock(node: BlockState, varMap: Map<string, string>): BlockState {
  const out: BlockState = { ...node };
  if (out.id) out.id = genUid();

  if (out.fields) {
    out.fields = { ...out.fields };
    for (const k of Object.keys(out.fields)) {
      const f = out.fields[k];
      if (f && typeof f === 'object' && typeof f.id === 'string' && varMap.has(f.id)) {
        out.fields[k] = { ...f, id: varMap.get(f.id) };
      }
    }
  }
  if (out.inputs) {
    out.inputs = { ...out.inputs };
    for (const k of Object.keys(out.inputs)) {
      const inp = { ...out.inputs[k] };
      if (inp.block) inp.block = remapBlock(inp.block, varMap);
      if (inp.shadow) inp.shadow = remapBlock(inp.shadow, varMap);
      out.inputs[k] = inp;
    }
  }
  if (out.next) {
    out.next = { ...out.next };
    if (out.next.block) out.next.block = remapBlock(out.next.block, varMap);
    if (out.next.shadow) out.next.shadow = remapBlock(out.next.shadow, varMap);
  }
  return out;
}

/** The top-level stacks that make up a template's program (its body + function defs). */
export function bodyBlocks(json: WorkspaceJson): BlockState[] {
  const tops = json.blocks?.blocks ?? [];
  const start = tops.find((b) => b.type === 'program_start');
  const out: BlockState[] = [];
  if (start?.next?.block) out.push(start.next.block); // the main stack under the hat
  for (const b of tops) if (b.type !== 'program_start') out.push(b); // e.g. function defs
  return out;
}

function appendTemplate(ws: Blockly.WorkspaceSvg, json: WorkspaceJson): string[] {
  // Ensure every variable the template needs exists in the target, by NAME.
  const varMap = new Map<string, string>();
  for (const v of json.variables ?? []) {
    const existing =
      ws.getVariableMap().getVariable(v.name) ?? ws.createVariable(v.name, v.type ?? null);
    varMap.set(v.id, existing.getId());
  }

  const bbox = ws.getBlocksBoundingBox();
  const startX = (Number.isFinite(bbox.right) ? bbox.right : 0) + 48;
  let y = Number.isFinite(bbox.top) ? bbox.top : 0;

  const newIds: string[] = [];
  for (const raw of bodyBlocks(json)) {
    const cloned = remapBlock(raw, varMap);
    cloned.x = startX;
    cloned.y = y;
    const block = Blockly.serialization.blocks.append(cloned as any, ws);
    if (block) newIds.push(block.id);
    y += 220; // stagger extra top stacks (function definitions) downward
  }
  return newIds;
}

/** Flash a gold outline on the given blocks (2×300 ms). No-op without SVG. */
function flashBlocks(ws: Blockly.WorkspaceSvg, ids: string[]): void {
  const roots: Element[] = [];
  for (const id of ids) {
    const el = ws.getBlockById(id)?.getSvgRoot();
    if (el) roots.push(el);
  }
  if (roots.length === 0) return;
  let count = 0;
  const toggle = () => {
    const on = count % 2 === 0;
    for (const r of roots) r.classList.toggle('blocklyTemplateFlash', on);
    count++;
    if (count < 4) setTimeout(toggle, 300);
    else for (const r of roots) r.classList.remove('blocklyTemplateFlash');
  };
  toggle();
}

export type InsertMode = 'replace' | 'append';

/**
 * Insert a template. Wrapped in a single event group so one undo reverts the whole
 * template. Returns the ids of the new top-level blocks (for scroll/flash/tests).
 */
export function insertTemplate(
  ws: Blockly.WorkspaceSvg,
  templateJson: WorkspaceJson,
  mode: InsertMode = 'replace',
): string[] {
  let newIds: string[] = [];
  Blockly.Events.setGroup(true);
  try {
    if (mode === 'replace') {
      Blockly.serialization.workspaces.load(templateJson as object, ws); // clears first
      newIds = (ws.getTopBlocks(false) as Blockly.Block[]).map((b) => b.id);
    } else {
      newIds = appendTemplate(ws, templateJson);
    }
  } finally {
    Blockly.Events.setGroup(false);
  }

  // Reveal + flash the freshly inserted stack (no cleanUp — keep the child's layout).
  if (newIds[0] && typeof (ws as any).centerOnBlock === 'function') {
    try {
      (ws as any).centerOnBlock(newIds[0]);
    } catch {
      /* headless */
    }
  }
  flashBlocks(ws, newIds);
  return newIds;
}
