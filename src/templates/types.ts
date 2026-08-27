// src/templates/types.ts
//
// Types for the Template Gallery (PROMPT D). A built-in template is authored as a
// block-spec tree (see authoring.ts) rather than hand-written Blockly JSON, so the
// workspace it produces is always valid and stays in sync with the block defs.

import type { BlockSpec } from './authoring';

export type TemplateCollection =
  'gerak-dasar' | 'sensor' | 'ai-kamera' | 'seni-suara' | 'tantangan';

/** Hardware a template leans on — surfaced as chips and (for kamera) an AI gate. */
export type TemplateRequirement = 'kamera' | 'ultrasonic' | 'capit';

export interface BuiltinTemplate {
  id: string;
  name: string;
  description: string;
  collection: TemplateCollection;
  tags: string[];
  requires?: TemplateRequirement[];
  difficulty: 1 | 2 | 3;
  /** 2-3 short bullets shown in the detail sheet ("apa yang dipelajari"). */
  learn: string[];
  /** Inline animated SVG markup for the card thumbnail. */
  thumbnail: string;
  /** The program body, top-to-bottom, that lives under program_start. */
  program: BlockSpec[];
}

/** A user-saved template (Template Saya) — same shape, serialised workspace JSON. */
export interface UserTemplate {
  id: string;
  name: string;
  savedAt: number;
  /** Blockly.serialization.workspaces.save() output. */
  workspace: unknown;
}

export const COLLECTION_LABELS: Record<TemplateCollection, string> = {
  'gerak-dasar': 'Gerak Dasar',
  sensor: 'Sensor',
  'ai-kamera': 'AI Kamera',
  'seni-suara': 'Seni & Suara',
  tantangan: 'Tantangan',
};

export const REQUIREMENT_LABELS: Record<TemplateRequirement, string> = {
  kamera: 'Kamera',
  ultrasonic: 'Ultrasonic',
  capit: 'Capit',
};
