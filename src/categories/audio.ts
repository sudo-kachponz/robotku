import * as Blockly from 'blockly/core';
import { javascriptGenerator } from 'blockly/javascript';
import { astroidV2 } from '../robotProfiles';
import { SOUND_MAPPING } from '../sound_profile';

const soundDropdownOptions = SOUND_MAPPING.map(sound => ([sound.name, String(sound.id)]));

// --- Block Definitions ---
Blockly.defineBlocksWithJsonArray([
  {
    "type": "audio_play_internal_sound",
    "message0": "Play sound %1",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "SOUND_ID",
        "options": soundDropdownOptions
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "style": "audio_blocks",
    "tooltip": "Plays a pre-loaded sound effect from the robot's speaker."
  },
]);

// --- Block Generators ---
javascriptGenerator.forBlock['audio_play_internal_sound'] = function(block, _generator) {
  const soundIdString = block.getFieldValue('SOUND_ID');
  
  const soundIdNumber = parseInt(soundIdString, 10);

  const commandObj = {
    command: astroidV2.commands.playInternalSound,
    params: {
      sound_id: soundIdNumber 
    }
  };
  return JSON.stringify(commandObj) + ';';
};


// --- Toolbox Definition ---
export const audioCategory = {
  kind: 'category',
  name: 'Sound',
  categorystyle: 'audio_category',
  contents: [
    { kind: 'block', type: 'audio_play_internal_sound' },
  ],
};