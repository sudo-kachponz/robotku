// src/toolbox.ts
//
// Robotku Block Coding toolbox — the 12-category structure from a.md
// (Movement, Timing, Display, Audio, Sensors & Data, Program Flow, Logic, Math,
// then the "Advanced" group: Variables, Functions, Templates, AI).
import * as Blockly from 'blockly/core';

import { motorsCategory } from './categories/motors'; // Movement
import { timingCategory } from './categories/events'; // Timing
import { looksCategory } from './categories/looks'; // Display
import { audioCategory } from './categories/audio'; // Audio
import { sensorsCategory } from './categories/sensors'; // Sensors & Data
import { controlCategory } from './categories/control'; // Program Flow
import { logicCategory } from './categories/logic'; // Logic
import { mathCategory } from './categories/math'; // Math
import { variablesCategory } from './categories/variables'; // Variables
import { functionsCategory } from './categories/functions'; // Functions
import { templatesCategory } from './categories/templates'; // Templates
import { aiCategory } from './categories/ai'; // AI
import { BLOCK_OPCODE } from './blockcoding/blockOpcodes';
import { isSupported, robotkuEsp32V3, type BoardProfile } from './domain/boardProfile';

// P1 — board profile guard. Blocks whose opcode the active board can't run are
// left in the toolbox but greyed + non-draggable (never deleted, so another board
// profile can still surface them later). Walks category trees recursively.
const DISABLED_TOOLTIP = 'Hardware ini tidak ada pada board Robotku V3';

function guardItem(item: any, profile: BoardProfile): any {
  if (item?.contents) {
    return { ...item, contents: item.contents.map((c: any) => guardItem(c, profile)) };
  }
  if (item?.kind === 'block' && typeof item.type === 'string') {
    const opcode = BLOCK_OPCODE[item.type];
    if (opcode && !isSupported(opcode, profile)) {
      return { ...item, disabled: true, tooltip: DISABLED_TOOLTIP };
    }
  }
  return item;
}

export function getAstroidToolbox(
  profile: BoardProfile = robotkuEsp32V3,
): Blockly.utils.toolbox.ToolboxDefinition {
  const contents = [
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
  ].map((c) => guardItem(c, profile));

  return { kind: 'categoryToolbox', contents } as Blockly.utils.toolbox.ToolboxDefinition;
}
