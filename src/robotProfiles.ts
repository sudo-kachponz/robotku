// src/robotProfiles.ts

export interface RobotProfile {
  name: string;
  commands: {
    // System
    estop: 'ESTOP';
    
    // Direct Drive & Sequential
    driveDirect: 'DRIVE_DIRECT';
    moveTimed: 'MOVE_TIMED';
    turnTimed: 'TURN_TIMED';
    wait: 'WAIT';
    
    // Head & Gripper
    setHeadPosition: 'SET_HEAD_POSITION';
    setGripper: 'SET_GRIPPER';

    // Looks
    setLedColor: 'SET_LED_COLOR';
    displayIcon: 'DISPLAY_ICON';

    // Sound
    playInternalSound: 'PLAY_INTERNAL_SOUND';

    // Sensors
    getSensorData: 'GET_SENSOR_DATA';
  };
}

export const astroidV2: RobotProfile = {
  name: 'Astroid V2 (ESP32)',
  commands: {
    // System
    estop: 'ESTOP',
    // Drive
    driveDirect: 'DRIVE_DIRECT',
    moveTimed: 'MOVE_TIMED',
    turnTimed: 'TURN_TIMED',
    wait: 'WAIT',
    // Head & Gripper
    setHeadPosition: 'SET_HEAD_POSITION',
    setGripper: 'SET_GRIPPER',
    // Looks
    setLedColor: 'SET_LED_COLOR',
    displayIcon: 'DISPLAY_ICON',
    // Sound
    playInternalSound: 'PLAY_INTERNAL_SOUND',
    // Sensors
    getSensorData: 'GET_SENSOR_DATA',
  },
};