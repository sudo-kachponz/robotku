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

// Drop labels that no longer precede any block (after unsupported blocks are cut).
function dropOrphanLabels(contents: any[]): any[] {
  return contents.filter((item: any, i: number) => {
    if (item?.kind !== 'label') return true;
    for (let j = i + 1; j < contents.length; j++) {
      if (contents[j]?.kind === 'label') break;
      if (contents[j]?.kind === 'block') return true;
    }
    return false;
  });
}

// hide=true (phones): REMOVE unsupported blocks (and emptied labels/categories) so the
// flyout only lists blocks this board can run — decluttering the cramped mobile view.
// hide=false (default/desktop): keep them, greyed + non-draggable.
function guardItem(item: any, profile: BoardProfile, hide: boolean): any {
  if (item?.contents) {
    const contents = dropOrphanLabels(
      item.contents.map((c: any) => guardItem(c, profile, hide)).filter(Boolean),
    );
    // A category left with only labels/seps (all its blocks were unsupported) is dropped.
    if (hide && item.kind === 'category' && !contents.some((c: any) => c?.kind === 'block')) {
      return null;
    }
    return { ...item, contents };
  }
  if (item?.kind === 'block' && typeof item.type === 'string') {
    const opcode = BLOCK_OPCODE[item.type];
    if (opcode && !isSupported(opcode, profile)) {
      return hide ? null : { ...item, disabled: true, tooltip: DISABLED_TOOLTIP };
    }
  }
  return item;
}

export function getAstroidToolbox(
  profile: BoardProfile = robotkuEsp32V3,
  hideUnsupported = false,
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
  ]
    .map((c) => guardItem(c, profile, hideUnsupported))
    .filter(Boolean);

  return { kind: 'categoryToolbox', contents } as Blockly.utils.toolbox.ToolboxDefinition;
}
