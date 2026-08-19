// src/categories/index.ts
// Register the standard Blockly blocks via side-effect import.
// This ensures built-in blocks (logic, math, text, control, etc.) are available.
import 'blockly/blocks';

import './motors';
import './mechanisms';
import './looks';
import './sensors';
import './audio';
import './control';
import './operators';