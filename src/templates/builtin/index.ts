// src/templates/builtin/index.ts — the built-in template catalogue.

import type { BuiltinTemplate } from '../types';
import { gerakDasarTemplates } from './gerakDasar';
import { sensorTemplates } from './sensor';
import { aiKameraTemplates } from './aiKamera';
import { seniSuaraTemplates } from './seniSuara';
import { tantanganTemplates } from './tantangan';

/** All 15 built-in templates, in gallery order. */
export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  ...gerakDasarTemplates,
  ...sensorTemplates,
  ...aiKameraTemplates,
  ...seniSuaraTemplates,
  ...tantanganTemplates,
];

export function getBuiltinTemplate(id: string): BuiltinTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}
