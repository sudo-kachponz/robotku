// src/domain/hardware.ts
//
// The ONE physical description of the Robotku Controller V3 board, from the
// ESP32_Controller_V3 schematic + board photos (see sim.md). Used by the port
// model, UI, and simulator so nothing hardcodes "8 ports" or a stray GPIO.
//
// GPIO POLICY: only pins PHYSICALLY VERIFIED on real hardware carry a number.
// Everything else is `undefined` (verified:false) = TODO — confirm on the board
// before flashing, so the sim/firmware say UNSUPPORTED instead of driving a
// random pin. Verified this session: P1=33, P2=25 (both servos spun), buzzer=13,
// RGB=16/17/5, OLED bus SDA21/SCL22. NOT tested: P3..P5, Bt_LED.

export type PortKind = 'pwm' | 'i2c';

export interface HardwarePort {
  id: string; // 'P1'..'P5' | 'I1'..'I5'
  kind: PortKind;
  index: number; // 1..5 within its kind
  pins: string[]; // header rows, board-edge -> inner
  colors: string[]; // header colors matching the photo (parallel to pins)
  gpio?: number; // verified GPIO; undefined = not yet confirmed
  verified: boolean; // true only if proven on real hardware
  role?: string; // human note, e.g. 'drive-left'
}

// Header colors straight from the board photo (sim.md SLICE 4).
const PWM_PINS = ['GND', '5V', 'PWM'];
const PWM_COLORS = ['#111111', '#E02B2B', '#F5C518']; // black GND, red 5V, yellow PWM
const I2C_PINS = ['GND', 'VCC', 'SCL', 'SDA'];
const I2C_COLORS = ['#111111', '#E02B2B', '#22A559', '#F5C518']; // black,red,green,yellow

// PWM/servo ports. Only P1 (GPIO33) + P2 (GPIO25) are proven — the two drive
// servos we spun on hardware. P3..P5 exist on the board but their GPIO isn't
// confirmed, so they stay TODO (undefined) rather than guessed.
export const PWM_PORTS: HardwarePort[] = [
  { id: 'P1', kind: 'pwm', index: 1, pins: PWM_PINS, colors: PWM_COLORS, gpio: 33, verified: true, role: 'drive-left' },
  { id: 'P2', kind: 'pwm', index: 2, pins: PWM_PINS, colors: PWM_COLORS, gpio: 25, verified: true, role: 'drive-right' },
  { id: 'P3', kind: 'pwm', index: 3, pins: PWM_PINS, colors: PWM_COLORS, verified: false }, // TODO: GPIO unverified
  { id: 'P4', kind: 'pwm', index: 4, pins: PWM_PINS, colors: PWM_COLORS, verified: false }, // TODO: GPIO unverified
  { id: 'P5', kind: 'pwm', index: 5, pins: PWM_PINS, colors: PWM_COLORS, verified: false }, // TODO: GPIO unverified
];

// I2C ports: ONE shared bus (SDA=21, SCL=22, verified via the OLED) broken out to
// 5 parallel connectors. Plug the OLED (or any I2C module) into any of them.
export const I2C_PORTS: HardwarePort[] = [1, 2, 3, 4, 5].map((i) => ({
  id: `I${i}`,
  kind: 'i2c' as const,
  index: i,
  pins: I2C_PINS,
  colors: I2C_COLORS,
  verified: true, // the bus itself is verified; which connector you use doesn't matter
  role: 'i2c-bus',
}));

export const I2C_BUS = { sda: 21, scl: 22, verified: true };

// Fixed-function pins (not ports). Verified this session except Bt_LED.
export const BOARD_PINS = {
  rgbLed: { r: 16, g: 17, b: 5, verified: true },
  buzzer: { gpio: 13, verified: true },
  statusLed: { gpio: 4, verified: false }, // Bt_LED — not tested
};

export interface BoardHardware {
  id: 'esp32-controller-v3';
  name: string;
  pwmPorts: HardwarePort[];
  i2cPorts: HardwarePort[];
  hasRgbLed: boolean;
  hasBuzzer: boolean;
  hasStatusLed: boolean;
  hasMotorDriver: false;
  hasOnboardDisplay: false; // OLED is an external I2C module, not on-board
  hasMatrix: false;
  onboardSensors: never[];
}

export const robotkuControllerV3: BoardHardware = {
  id: 'esp32-controller-v3',
  name: 'Robotku Controller V3',
  pwmPorts: PWM_PORTS,
  i2cPorts: I2C_PORTS,
  hasRgbLed: true,
  hasBuzzer: true,
  hasStatusLed: true,
  hasMotorDriver: false,
  hasOnboardDisplay: false,
  hasMatrix: false,
  onboardSensors: [],
};

// Modules that plug into a port — drive block availability + sim art (SLICE 4).
export interface Peripheral {
  id: string;
  name: string;
  bus: PortKind;
  addr?: number;
  pins: string[];
}

export const PERIPHERALS: Peripheral[] = [
  { id: 'oled-ssd1306', name: 'Layar OLED 0.96"', bus: 'i2c', addr: 0x3c, pins: ['GND', 'VDD', 'SCK', 'SDA'] },
  { id: 'servo-sg90', name: 'Servo SG90', bus: 'pwm', pins: ['GND', '5V', 'PWM'] },
];
