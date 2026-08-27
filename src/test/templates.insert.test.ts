// src/test/templates.insert.test.ts
//
// Insertion CORE (pure): the id-regeneration + variable-remap that stops a template
// from colliding with itself when inserted twice. The thin DOM wrappers around this
// (append to a live WorkspaceSvg, flash, center) need a rendered workspace and are
// exercised in the app, not here.

import { describe, it, expect } from 'vitest';
import { ensureInit } from './harness';
import { buildTemplateWorkspace } from '../templates/authoring';
import { bodyBlocks, remapBlock } from '../templates/insert';
import { squarePath } from '../templates/builtin/gerakDasar';
import { counterGame } from '../templates/builtin/tantangan';

/** Every `id` found anywhere in a block-state tree. */
function collectIds(node: any, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  if (typeof node.id === 'string') out.push(node.id);
  if (node.inputs)
    for (const v of Object.values<any>(node.inputs)) {
      collectIds(v.block, out);
      collectIds(v.shadow, out);
    }
  if (node.next) {
    collectIds(node.next.block, out);
    collectIds(node.next.shadow, out);
  }
  return out;
}

/** Every variable id referenced by a VAR field in the tree. */
function collectVarRefs(node: any, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  if (node.fields)
    for (const f of Object.values<any>(node.fields))
      if (f && typeof f === 'object' && f.id) out.push(f.id);
  if (node.inputs)
    for (const v of Object.values<any>(node.inputs)) {
      collectVarRefs(v.block, out);
      collectVarRefs(v.shadow, out);
    }
  if (node.next) {
    collectVarRefs(node.next.block, out);
    collectVarRefs(node.next.shadow, out);
  }
  return out;
}

describe('Templates: insertion core', () => {
  it('bodyBlocks drops program_start but keeps the body stack', () => {
    ensureInit();
    const json = buildTemplateWorkspace(squarePath.program) as any;
    const body = bodyBlocks(json);
    expect(body.length).toBe(1);
    expect(body[0].type).toBe('controls_repeat_ext');
  });

  it('remapBlock gives fresh ids; two remaps never collide (insert twice is safe)', () => {
    ensureInit();
    const json = buildTemplateWorkspace(squarePath.program) as any;
    const source = bodyBlocks(json)[0];
    const originalIds = collectIds(source);

    const a = remapBlock(source, new Map());
    const b = remapBlock(source, new Map());
    const aIds = collectIds(a);
    const bIds = collectIds(b);

    // Structure preserved (same number of blocks), but every id is new & unique.
    expect(aIds.length).toBe(originalIds.length);
    expect(new Set([...aIds, ...bIds]).size).toBe(aIds.length + bIds.length);
    for (const id of aIds) expect(originalIds).not.toContain(id);
  });

  it('remapBlock rewrites variable references through the varMap', () => {
    ensureInit();
    const json = buildTemplateWorkspace(counterGame.program) as any;
    const source = bodyBlocks(json)[0];
    const oldRefs = [...new Set(collectVarRefs(source))];
    expect(oldRefs.length).toBeGreaterThan(0);

    const varMap = new Map(oldRefs.map((id) => [id, `NEW_${id}`]));
    const remapped = remapBlock(source, varMap);
    const newRefs = collectVarRefs(remapped);

    expect(newRefs.length).toBeGreaterThan(0);
    for (const ref of newRefs) expect(ref.startsWith('NEW_')).toBe(true);
  });
});
