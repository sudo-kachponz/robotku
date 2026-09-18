// src/components/blockcoding/python/blockPreview.ts
//
// Render a single Robotku block to a standalone SVG string (py2.md §2.2), the way
// pxt renders block images for docs. Uses a hidden read-only Blockly workspace,
// extracts the block's <g> into an <svg> sized by its bbox, and caches the result
// per (blockType, fields, theme). Returns null on failure so callers can fall back
// to a coloured chip — never crash.

import * as Blockly from 'blockly';
import { initializeAstroidEditor } from '../../../core';
import { getRobotkuTheme } from '../../../visual/theme';
import { buildTemplateWorkspace, type BlockSpec } from '../../../templates/authoring';

const cache = new Map<string, string | null>();

function currentThemeId(): string {
  if (typeof document === 'undefined') return 'default';
  return document.documentElement.dataset.theme || 'default';
}

function keyOf(blockType: string, fields: Record<string, unknown> | undefined, themeId: string) {
  return `${themeId}|${blockType}|${JSON.stringify(fields ?? {})}`;
}

let hiddenDiv: HTMLDivElement | null = null;
function getHiddenDiv(): HTMLDivElement {
  if (hiddenDiv) return hiddenDiv;
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;left:-99999px;top:0;width:600px;height:400px;visibility:hidden;';
  document.body.appendChild(d);
  hiddenDiv = d;
  return d;
}

/** Blockly text/field colours come from CSS classes; inline the essentials so the
 *  extracted SVG renders the same outside the workspace. Field-text colour is read
 *  from the --ink-900 token so it follows the theme (no hardcoded hex). */
function inlineStyle(): string {
  const ink =
    (typeof document !== 'undefined' &&
      getComputedStyle(document.documentElement).getPropertyValue('--ink-900').trim()) ||
    'black';
  return (
    '.blocklyText{fill:white;font-family:"Plus Jakarta Sans",sans-serif;font-weight:700;}' +
    '.blocklyEditableText>rect,.blocklyFieldRect{fill:rgba(255,255,255,.25);}' +
    `.blocklyEditableText>.blocklyText{fill:${ink};}` +
    `.blocklyDropdownText{fill:${ink};}`
  );
}

export function renderBlockPreviewSvg(
  blockType: string,
  fields?: Record<string, unknown>,
): string | null {
  const themeId = currentThemeId();
  const key = keyOf(blockType, fields, themeId);
  if (cache.has(key)) return cache.get(key)!;

  let svg: string | null = null;
  let ws: Blockly.WorkspaceSvg | null = null;
  try {
    initializeAstroidEditor();
    ws = Blockly.inject(getHiddenDiv(), {
      readOnly: true,
      renderer: 'zelos',
      theme: getRobotkuTheme(),
      toolbox: undefined,
      trashcan: false,
      scrollbars: false,
      move: { scrollbars: false, drag: false, wheel: false },
    });
    const block = ws.newBlock(blockType);
    if (fields) {
      for (const [k, v] of Object.entries(fields)) {
        try {
          if (block.getField(k)) block.setFieldValue(String(v), k);
        } catch {
          /* skip unsettable field (e.g. FieldVariable) — preview still renders */
        }
      }
    }
    block.initSvg();
    block.render();
    Blockly.svgResize(ws);

    const g = block.getSvgRoot();
    const bbox = g.getBBox();
    if (!bbox.width || !bbox.height) throw new Error('empty bbox');
    const pad = 4;
    const clone = g.cloneNode(true) as SVGElement;
    clone.removeAttribute('transform');
    svg =
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `width="${Math.ceil(bbox.width + pad * 2)}" height="${Math.ceil(bbox.height + pad * 2)}" ` +
      `viewBox="${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}">` +
      `<style>${inlineStyle()}</style>${new XMLSerializer().serializeToString(clone)}</svg>`;
  } catch {
    svg = null;
  } finally {
    if (ws) ws.dispose();
  }

  cache.set(key, svg);
  return svg;
}

/** Render a multi-block example program (BlockSpec[]) to a standalone SVG. */
export function renderProgramPreviewSvg(blocks: BlockSpec[]): string | null {
  const themeId = currentThemeId();
  const key = `prog|${themeId}|${JSON.stringify(blocks)}`;
  if (cache.has(key)) return cache.get(key)!;

  let svg: string | null = null;
  let ws: Blockly.WorkspaceSvg | null = null;
  try {
    initializeAstroidEditor();
    ws = Blockly.inject(getHiddenDiv(), {
      readOnly: true,
      renderer: 'zelos',
      theme: getRobotkuTheme(),
      trashcan: false,
      scrollbars: false,
      move: { scrollbars: false, drag: false, wheel: false },
    });
    Blockly.serialization.workspaces.load(buildTemplateWorkspace(blocks), ws);
    Blockly.svgResize(ws);
    const canvas = ws.getCanvas();
    const bbox = canvas.getBBox();
    if (!bbox.width || !bbox.height) throw new Error('empty bbox');
    const pad = 6;
    const clone = canvas.cloneNode(true) as SVGElement;
    clone.removeAttribute('transform');
    svg =
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `width="${Math.ceil(bbox.width + pad * 2)}" height="${Math.ceil(bbox.height + pad * 2)}" ` +
      `viewBox="${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}">` +
      `<style>${inlineStyle()}</style>${new XMLSerializer().serializeToString(clone)}</svg>`;
  } catch {
    svg = null;
  } finally {
    if (ws) ws.dispose();
  }
  cache.set(key, svg);
  return svg;
}

export function clearBlockPreviewCache(): void {
  cache.clear();
}
