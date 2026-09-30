// src/components/modes/joystick/layoutConfig.ts
// Percentage-based bounding box layout mapped 1:1 onto the 1600x900 RobotKu Pad SVG canvas.

export interface LayoutBox {
  left: string;
  top: string;
  width: string;
  height: string;
}

export const LAYOUT: Record<string, LayoutBox> = {
  // Center Virtual Arena Screen
  monitor: {
    left: '33.0%',
    top: '18.22%',
    width: '34.0%',
    height: '30.89%',
  },

  // Left 4-Way Directional Pad
  dpad: {
    left: '14.06%',
    top: '25.0%',
    width: '13.125%',
    height: '23.33%',
  },

  // Right 4 Action Buttons Diamond
  actions: {
    left: '72.81%',
    top: '25.0%',
    width: '13.125%',
    height: '23.33%',
  },

  // Left Analog Thumbstick (L3)
  leftStick: {
    left: '34.25%',
    top: '53.67%',
    width: '9.0%',
    height: '16.0%',
  },

  // Right Analog Thumbstick (R3)
  rightStick: {
    left: '56.75%',
    top: '53.67%',
    width: '9.0%',
    height: '16.0%',
  },

  // Center RobotKu Home / Mute Button
  homeButton: {
    left: '48.375%',
    top: '62.11%',
    width: '3.25%',
    height: '5.78%',
  },

  // Left Pill Button (Gear Cycle)
  gearPill: {
    left: '29.25%',
    top: '19.11%',
    width: '3.25%',
    height: '6.67%',
  },

  // Right Pill Button (Stick / Levers Mode Toggle)
  modePill: {
    left: '67.5%',
    top: '19.11%',
    width: '3.25%',
    height: '6.67%',
  },

  // Top Left Shoulder Bumper (L)
  bumperLeft: {
    left: '14.5%',
    top: '10.5%',
    width: '23.0%',
    height: '10.0%',
  },

  // Top Right Shoulder Bumper (R)
  bumperRight: {
    left: '62.5%',
    top: '10.5%',
    width: '23.0%',
    height: '10.0%',
  },

  // Center Bottom E-STOP Pill
  estop: {
    left: '44.5%',
    top: '71.5%',
    width: '11.0%',
    height: '4.8%',
  },
};
