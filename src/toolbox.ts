// src/toolbox.ts
import * as Blockly from 'blockly/core';

// Import the final, refactored categories
import { motorsCategory } from './categories/motors';
import { mechanismsCategory } from './categories/mechanisms';
import { looksCategory } from './categories/looks';
import { audioCategory } from './categories/audio';
import { sensorsCategory } from './categories/sensors';

// Import the standard logic categories
import { controlCategory } from './categories/control';
import { operatorsCategory } from './categories/operators';

export function getAstroidToolbox(): Blockly.utils.toolbox.ToolboxDefinition {
  return {
    kind: 'categoryToolbox',
    contents: [
      motorsCategory,
      mechanismsCategory,
      looksCategory,
      audioCategory,
      { kind: 'sep' },
      controlCategory,
      operatorsCategory,
      sensorsCategory,
    ],
  };
}