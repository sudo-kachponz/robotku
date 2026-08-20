<p align="center">
  <img src="public/brand/Robotku-Mascot-Logo-Horizontal.png" alt="Robotku Mascot Logo" width="480" />
</p>

<h1 align="center">Robotku — Web Control & Visual Block Coding Platform</h1>

<p align="center">
  <b>A Modern, Next-Generation Web Suite & Firmware Ecosystem for Robotics, ESP32 Control, and Visual Block Coding</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Blockly-Google-4285F4?style=for-the-badge&logo=google" alt="Blockly" />
  <img src="https://img.shields.io/badge/ESP32-Arduino_C%2B%2B-E7352C?style=for-the-badge&logo=espressif" alt="ESP32" />
  <img src="https://img.shields.io/badge/Styling-Robotku_Design_System-4F46E5?style=for-the-badge" alt="Robotku DS" />
</p>

---

## 📖 Overview

**Robotku** is an all-in-one web-based robotics platform engineered for physical hardware control, educational block-based programming, and interactive 3D robot simulation. Designed with a custom **Robotku Design System** built on top of *Plus Jakarta Sans* typography, glassmorphism UI elements, and vibrant category palettes, Robotku seamlessly bridges visual coding with real-time ESP32 hardware execution.

---

## ✨ Key Features

### 🧩 1. Visual Block Coding (Blockly Engine)
* **Custom Zelos Renderer Theme**: Reskinned with Robotku's signature visual language.
* **Category Glass Pane**: Semi-transparent, low-saturation glassmorphism flyouts (`backdrop-filter: blur(16px)`) per active category.
* **12 Comprehensive Categories**:
  1. 🟩 **Movement**: Forward, Reverse, Steer, Claw, and Stop controls with timed execution.
  2. 🟧 **Timing**: Program hat (`Start Program`), wait timers, and conditional pause handlers.
  3. 🟦 **Display**: 5x5 LED Matrix pattern designer, LCD text & shape rendering.
  4. 🟧 **Audio**: Tone synthesizer, sound effects, volume control, and audio recorder.
  5. 🟪 **Sensors & Data**: Ultrasonic distance, temperature, humidity, light sensor, and I/O pin handlers.
  6. 🩵 **Program Flow**: Loop forever, repeat N times, while loops, breaks, and if/else conditions.
  7. 🟩 **Logic**: Logical operations, negation, and boolean values.
  8. 🟦 **Math**: Arithmetic, modulo, random integer generation, and rounding.
  9. 🟫 **Variables**: Variable creation, getters, and setters.
  10. 🟪 **Functions**: Dynamic procedure definitions and execution calls.
  11. 🟨 **Templates**: Inline documentation, note blocks, and saved snippets.
  12. 🩷 **AI**: Experimental AI vision and frame capture stubs.

### 🎮 2. Control Modes Carousel
* **Base Robot Mode**: D-pad navigation, grab & release controls.
* **Port Control Mode**: 8-port manual PWM testing slider (-100 to 100).
* **Tank Mode**: Dual left/right track throttles with turret steering.
* **Joystick Mode**: Analog virtual joystick with arcade mixing algorithms.
* **Block Coding Mode**: Workspace with live 3D simulator preview, console telemetry monitor, and hardware streaming bridge.

### 🔌 3. ESP32 Hardware Integration
* **Protocol & Firmware**: Line-delimited JSON RPC command protocol (`HELLO`, `DRIVE_DIRECT`, `MOVE_TIMED`, `SET_LED_COLOR`, `GET_SENSOR_DATA`, etc.).
* **Web Serial Bridge**: Direct browser-to-ESP32 communication via USB/Serial without external drivers.
* **Safety Failsafe**: Heartbeat watchdog automatic motor cutoff on connection loss.

---

## 🛠 System Architecture

```
                               ┌──────────────────────────────────────────┐
                               │            Robotku Web Client            │
                               │          (Next.js 15 + React 19)         │
                               └────────────────────┬─────────────────────┘
                                                    │
                 ┌──────────────────────────────────┴──────────────────────────────────┐
                 │                                                                     │
                 ▼                                                                     ▼
   ┌───────────────────────────┐                                         ┌───────────────────────────┐
   │    Blockly Code Engine    │                                         │    Direct Control Modes   │
   │ (Zelos + Glass Pane Flyout)│                                         │ (Joystick/Tank/Base/Ports)│
   └─────────────┬─────────────┘                                         └─────────────┬─────────────┘
                 │                                                                     │
                 └──────────────────────────────────┬──────────────────────────────────┘
                                                    │ JSON RPC Commands
                                                    ▼
                                     ┌─────────────────────────────┐
                                     │  Web Serial Protocol Bridge │
                                     └──────────────┬──────────────┘
                                                    │ USB / Serial @ 115200 Baud
                                                    ▼
                                     ┌─────────────────────────────┐
                                     │   Robotku ESP32 Firmware    │
                                     │ (robotku-esp32/firmware.ino)│
                                     └─────────────────────────────┘
```

---

## 📂 Directory Structure

```
robotku/
├── firmware/
│   └── robotku-esp32/
│       └── robotku-esp32.ino        # ESP32 C++ Firmware source
├── public/
│   └── brand/
│       ├── Robotku-Mascot-Logo-Horizontal.png
│       └── Robotku-Mascot-Logo-Vertical.png
├── src/
│   ├── assets/                      # SVG icons & visual media
│   ├── categories/                  # 12 Blockly category block definitions & generators
│   ├── components/
│   │   ├── blockcoding/             # Blockly workspace component & module styles
│   │   ├── control/                 # Navigation, header, floating connection badge
│   │   └── modes/                   # Control mode pages (Joystick, Tank, Base, Port)
│   ├── hooks/                       # Custom React hooks (useConnection, useDrive)
│   ├── pages/                       # Next.js page routes
│   │   ├── control/
│   │   │   └── modes/
│   │   │       ├── base.tsx
│   │   │       ├── code.tsx
│   │   │       ├── joystick.tsx
│   │   │       ├── port.tsx
│   │   │       └── tank.tsx
│   │   └── index.tsx
│   ├── styles/                      # Modular CSS styling sheet
│   ├── theme/                       # Design system CSS variables & tokens
│   ├── simulator.ts                 # Three.js 3D robot preview renderer
│   ├── toolbox.ts                   # Blockly category toolbox structure
│   └── visual/                      # Theme definitions & category icon mappers
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** >= 18.x
* **npm** or **yarn** / **pnpm**
* **Arduino IDE** (for flashing ESP32 firmware) + `ArduinoJson` v6 library

### Installation

1. **Clone the repository:**
   ```bash
   git clone git@github.com:sudo-kachponz/robotku.git
   cd robotku
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

4. **Build for production:**
   ```bash
   npm run build
   npm run start
   ```

---

## 🤖 ESP32 Firmware Setup

1. Open `firmware/robotku-esp32/robotku-esp32.ino` in Arduino IDE.
2. Select your ESP32 board (e.g., `ESP32 Dev Module`).
3. Ensure the `ArduinoJson` library (version 6.x) is installed via Library Manager.
4. Upload the sketch to your ESP32 board via USB.
5. Connect to the Robotku Web interface and select **Connect Device** via Web Serial.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more details.

---

<p align="center">
  Crafted with ❤️ by the <b>Robotku Team</b>
</p>
