// src/pythongen/docs/types.ts
//
// Documentation model for the Python reference (py2.md §2.1). One DocEntry per
// apiMap `docs` slug. Rendered identically by the in-editor DocsPanel and the
// standalone /docs/reference pages (shared DocsBody, Phase 3).

export interface DocParam {
  name: string;
  type: string;
  default?: string;
  desc: string;
  range?: string;
}

export interface DocExample {
  title: string;
  desc?: string;
  python: string;
  /** Blockly workspace JSON (BlockSpec[] or serialized) for the "Blok" tab + ▶ run. */
  blocks?: unknown;
  runnable?: boolean;
}

export interface DocEntry {
  slug: string;
  title: string;
  category: string;
  summary: string; // 1-2 kalimat, bahasa anak
  description: string; // paragraf penjelas
  signature: { python: string; opcode?: string };
  params?: DocParam[];
  returns?: { type: string; desc: string };
  blockPreview: { blockType: string; fields?: Record<string, unknown> };
  examples?: DocExample[];
  seeAlso?: string[];
  notes?: string[];
  /** Filled at read time from isSupported() — not authored per entry. */
  boardNote?: string;
}
