// src/pythongen/docs/registry.ts
//
// One place that resolves a docs `slug` (the value on each apiMap entry) to a full
// DocEntry. Shared by the in-editor DocsPanel and the /docs/reference pages.
// boardNote is computed from isSupported() so it always matches the active board.

import { isSupported } from '../../domain/boardProfile';
import type { DocEntry } from './types';
import { MOVEMENT_DOCS } from './movement';
import { TIMING_DOCS } from './timing';
import { FLOW_DOCS } from './flow';
import { DISPLAY_DOCS } from './display';
import { AUDIO_DOCS } from './audio';
import { SENSORS_DOCS } from './sensors';
import { MECHANISMS_DOCS } from './mechanisms';
import { AI_DOCS } from './ai';
import { FUNCTIONS_DOCS } from './functions';
import { MISC_DOCS } from './misc';

const ALL: DocEntry[] = [
  ...MOVEMENT_DOCS,
  ...TIMING_DOCS,
  ...FLOW_DOCS,
  ...DISPLAY_DOCS,
  ...AUDIO_DOCS,
  ...SENSORS_DOCS,
  ...MECHANISMS_DOCS,
  ...AI_DOCS,
  ...FUNCTIONS_DOCS,
  ...MISC_DOCS,
];

export const DOCS: Readonly<Record<string, DocEntry>> = Object.fromEntries(
  ALL.map((d) => [d.slug, d]),
);

function withBoardNote(d: DocEntry): DocEntry {
  const op = d.signature.opcode;
  if (op && !isSupported(op)) {
    return { ...d, boardNote: 'Belum tersedia di board Robotku V3 (butuh modul/sensor tambahan).' };
  }
  return d;
}

/** Resolve a slug to its DocEntry (with computed boardNote), or undefined. */
export function getDoc(slug: string): DocEntry | undefined {
  const d = DOCS[slug];
  return d ? withBoardNote(d) : undefined;
}

export function allDocs(): DocEntry[] {
  return ALL.map(withBoardNote);
}

/** Category -> its entries, in registry order (for the reference index). */
export function docsByCategory(): Record<string, DocEntry[]> {
  const out: Record<string, DocEntry[]> = {};
  for (const d of allDocs()) (out[d.category] ??= []).push(d);
  return out;
}

/** All slugs — used by getStaticPaths for /docs/reference/[...slug]. */
export function allSlugs(): string[] {
  return ALL.map((d) => d.slug);
}
