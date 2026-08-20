// src/toolbox.ts
//
// Robotku Block Coding toolbox — the 12-category structure from a.md
// (Movement, Timing, Display, Audio, Sensors & Data, Program Flow, Logic, Math,
// then the "Advanced" group: Variables, Functions, Templates, AI).
import * as Blockly from 'blockly/core';

import { motorsCategory } from './categories/motors';       // Movement
import { timingCategory } from './categories/events';        // Timing
import { looksCategory } from './categories/looks';          // Display
import { audioCategory } from './categories/audio';          // Audio
import { sensorsCategory } from './categories/sensors';      // Sensors & Data
import { controlCategory } from './categories/control';      // Program Flow
import { logicCategory } from './categories/logic';          // Logic
import { mathCategory } from './categories/math';            // Math
import { variablesCategory } from './categories/variables';  // Variables
import { functionsCategory } from './categories/functions';  // Functions
import { templatesCategory } from './categories/templates';  // Templates
import { aiCategory } from './categories/ai';                // AI

export function getAstroidToolbox(): Blockly.utils.toolbox.ToolboxDefinition {
  return {
    kind: 'categoryToolbox',
    contents: [
      motorsCategory,
      timingCategory,
      looksCategory,
      audioCategory,
      sensorsCategory,
      controlCategory,
      logicCategory,
      mathCategory,
      { kind: 'sep' },
      variablesCategory,
      functionsCategory,
      templatesCategory,
      aiCategory,
    ],
  };
}
