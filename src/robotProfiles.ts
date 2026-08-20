// src/robotProfiles.ts
//
// Robotku v1.1 opcode map. Documents every command the Block Coding editor can
// stream as line-delimited JSON (`{"command":"...",...};`). The original Astroid
// V2 opcodes are kept for backward compatibility with the 3D simulator sequencer
// (MOVE_TIMED / TURN_TIMED / WAIT / SET_HEAD_POSITION / SET_LED_COLOR /
// DISPLAY_ICON / PLAY_INTERNAL_SOUND / GET_SENSOR_DATA); the new peripheral +
// motion opcodes below extend the language to the full a.md toolbox.

export interface RobotProfile {
  name: string;
  commands: {
    // System
    estop: 'ESTOP';

    // Direct Drive & Sequential (legacy, simulator-backed)
    driveDirect: 'DRIVE_DIRECT';
    moveTimed: 'MOVE_TIMED';
    turnTimed: 'TURN_TIMED';
    wait: 'WAIT';

    // Movement (v1.1)
    steerTimed: 'STEER_TIMED';
    clawTimed: 'CLAW_TIMED';
    stop: 'STOP';
    stopAll: 'STOP_ALL';

    // Head & Gripper (legacy)
    setHeadPosition: 'SET_HEAD_POSITION';
    setGripper: 'SET_GRIPPER';

    // Display — LED Matrix (v1.1)
    displayMatrix: 'DISPLAY_MATRIX';
    displayText: 'DISPLAY_TEXT';
    setLedBrightness: 'SET_LED_BRIGHTNESS';
    clearMatrix: 'CLEAR_MATRIX';
    // Display — LCD Screen (v1.1)
    lcdShape: 'LCD_SHAPE';
    lcdText: 'LCD_TEXT';
    lcdClear: 'LCD_CLEAR';
    // Display — legacy RGB / icons
    setLedColor: 'SET_LED_COLOR';
    displayIcon: 'DISPLAY_ICON';

    // Audio (v1.1)
    recordAudio: 'RECORD_AUDIO';
    playRecording: 'PLAY_RECORDING';
    playSoundEffect: 'PLAY_SOUND_EFFECT';
    playTone: 'PLAY_TONE';
    setVolume: 'SET_VOLUME';
    stopSounds: 'STOP_SOUNDS';
    setBpm: 'SET_BPM';
    playInternalSound: 'PLAY_INTERNAL_SOUND';

    // Sensors & Data (v1.1)
    getSensorData: 'GET_SENSOR_DATA';
    setAnalog: 'SET_ANALOG';
    setDigital: 'SET_DIGITAL';
    resetDistance: 'RESET_DISTANCE';
    resetHeading: 'RESET_HEADING';
  };
}

export const astroidV2: RobotProfile = {
  name: 'Robotku v1.1 (ESP32)',
  commands: {
    // System
    estop: 'ESTOP',
    // Drive (legacy)
    driveDirect: 'DRIVE_DIRECT',
    moveTimed: 'MOVE_TIMED',
    turnTimed: 'TURN_TIMED',
    wait: 'WAIT',
    // Movement (v1.1)
    steerTimed: 'STEER_TIMED',
    clawTimed: 'CLAW_TIMED',
    stop: 'STOP',
    stopAll: 'STOP_ALL',
    // Head & Gripper (legacy)
    setHeadPosition: 'SET_HEAD_POSITION',
    setGripper: 'SET_GRIPPER',
    // Display
    displayMatrix: 'DISPLAY_MATRIX',
    displayText: 'DISPLAY_TEXT',
    setLedBrightness: 'SET_LED_BRIGHTNESS',
    clearMatrix: 'CLEAR_MATRIX',
    lcdShape: 'LCD_SHAPE',
    lcdText: 'LCD_TEXT',
    lcdClear: 'LCD_CLEAR',
    setLedColor: 'SET_LED_COLOR',
    displayIcon: 'DISPLAY_ICON',
    // Audio
    recordAudio: 'RECORD_AUDIO',
    playRecording: 'PLAY_RECORDING',
    playSoundEffect: 'PLAY_SOUND_EFFECT',
    playTone: 'PLAY_TONE',
    setVolume: 'SET_VOLUME',
    stopSounds: 'STOP_SOUNDS',
    setBpm: 'SET_BPM',
    playInternalSound: 'PLAY_INTERNAL_SOUND',
    // Sensors
    getSensorData: 'GET_SENSOR_DATA',
    setAnalog: 'SET_ANALOG',
    setDigital: 'SET_DIGITAL',
    resetDistance: 'RESET_DISTANCE',
    resetHeading: 'RESET_HEADING',
  },
};

// Speed enum used by Movement blocks (Slow/Medium/Fast → duty %).
export const SPEED_ENUM: Record<string, number> = { slow: 40, medium: 70, fast: 100 };
