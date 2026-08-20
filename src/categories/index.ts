// src/categories/index.ts
// Register the standard Blockly blocks via side-effect import.
// This ensures built-in blocks (logic, math, text, control, variables,
// procedures, etc.) are available before our category modules run.
import 'blockly/blocks';

// Side-effect imports: each module defines its blocks + JS generators.
import './motors';      // Movement
import './events';      // Timing + program_start hat
import './looks';       // Display
import './audio';       // Audio
import './sensors';     // Sensors & Data
import './control';     // Program Flow
import './operators';   // standard math/logic/text generator overrides
import './variables';   // Variables generator overrides
import './templates';   // Templates
import './ai';          // AI (stub)
