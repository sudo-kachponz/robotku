# Robotku Block Coding — Prompt Pack (Simulator 2D · AI/CV · Templates · Share Code)

Prompt siap-tempel untuk Claude Code / vibe coding, dibuat **berdasarkan repo `robotku-main` yang kamu upload** (Next.js 15 + React 19 + Blockly 12 + three.js).
Semua path, nama fungsi, dan kontrak command di bawah sudah dicocokkan dengan kode yang ada — jadi model tidak perlu menebak.

## Fakta repo yang dipakai semua prompt (jangan diubah)

| Hal | Kenyataan di repo |
|---|---|
| Editor | `src/components/blockcoding/BlockCoding.tsx` (Blockly inject, zelos, continuous-toolbox) |
| Toolbox | `src/toolbox.ts` → 12 kategori, `templatesCategory` & `aiCategory` masih **stub** |
| Blok | `src/categories/*.ts`, registrasi via `defineOnce()` (`_defineOnce.ts`) |
| Bentuk command | `{"command":"MOVE_TIMED","params":{...}};` — **selalu ada `params`** |
| Meta opcode | `META_START_LOOP` / `META_START_INFINITE_LOOP` / `META_END_LOOP` / `META_BREAK_LOOP` / `META_CONTINUE_LOOP` / `META_IF` / `META_ELSE_IF` / `META_ELSE` / `META_END_IF` |
| Reporter sensor | generate string `getSensorValue("<json GET_SENSOR_DATA>")`, dievaluasi sandbox `new Function(...)` di `simulator_sequencer.ts` |
| Run path | `src/command_runner.ts` → transport kalau connect, else `simulatorRunner` |
| Transport | `src/transport/*` (BLE NUS + Web Serial), `src/domain/protocol.ts` (`SET_PORT`, `DRIVE_DIRECT`, `estopLines`) |
| Sim 3D | `src/simulator.ts` + `src/simulator_sequencer.ts` (three.js, opt-in, sering WebGL context error) |
| Sim 2D acuan | `src/components/modes/BaseMode.tsx` (pose loop + `RobotSprite.tsx`) & `src/components/modes/PortMode.tsx` (`PortBoard`, 8 slider, `fillBg()`) |
| Persist | `src/app/persistence.ts` (localforage: `settings`, `projects`, `settingsPresets`) |

**Urutan eksekusi yang disarankan:** `PROMPT 1` (runtime + sim 2D) → `PROMPT 2` (AI/CV) → `PROMPT 3` (Templates) → `PROMPT 4` (Share code) → `PROMPT 5` (Sensor Monitor, opsional).
PROMPT 1 wajib duluan: Templates dan AI dua-duanya butuh interpreter yang bisa jalan tanpa WebGL.

---

# PROMPT 1 — Runtime bersama + Simulator 2D (gaya Base Robot & Port Control)

```
ROLE
You are working in the existing Robotku web app (Next.js 15 + React 19 + TypeScript + Blockly 12).
Replace the three.js-only execution path of Block Coding with ONE shared program runtime plus a
lightweight 2D simulator drawn in the same visual language as the Base Robot and Port Control modes.
Do not rewrite Blockly, do not change any block definition or any generator output.

WHY
Today `BlockCoding.tsx` only runs a program offline when the 3D panel is open (it registers
`setSimulatorRunner` inside the `showSim` effect), and the 3D sim leaks/fails WebGL contexts.
Meanwhile `simulator_sequencer.ts` reads `command.params.*` for some opcodes only — most of the
v1.1 opcodes (STEER_TIMED, CLAW_TIMED, STOP, STOP_ALL, SET_PORT, DISPLAY_*, LCD_*, PLAY_TONE,
SET_ANALOG/SET_DIGITAL) are not interpreted at all. Fix this by extracting the interpreter from the
renderer.

ARCHITECTURE (create these files)
1. src/runtime/ProgramRunner.ts — headless async interpreter over the command array.
   - Reuses the EXACT control-flow semantics already implemented in
     src/simulator_sequencer.ts::runCommandSequence: a pc/while loop with a LoopFrame stack and the
     helpers findMatchingEndLoop / findNextBranch / findMatchingEndIf. Copy that logic, do not invent
     a new one. Also handle META_CONTINUE_LOOP and META_END_IF (currently unhandled no-ops).
   - Conditions: keep the existing sandbox contract. Build the evaluator with
     `new Function('getSensorValue','mathRandomInt', 'return ' + condition + ';')` and pass the
     sink's resolvers. Conditions must be evaluated FRESH on every loop iteration (that is what
     makes "forever + if sensor" work).
   - Interface:
       export interface RobotSink {
         exec(cmd: {command: string; params: any}): Promise<void>;   // timed/instant actions
         getSensorValue(getSensorDataJson: string): number | null;    // sync, latest cached value
         stopAll(): void;
       }
       export class ProgramRunner {
         constructor(sink: RobotSink);
         run(commands: any[]): Promise<void>;
         stop(): void;          // cooperative: sets stopRequested, awaited sleeps bail out early
         get isRunning(): boolean;
         onStep?: (pc: number, cmd: any) => void;   // used to highlight the running block later
       }
   - Every wait inside exec() must be interruptible: implement `sleep(ms, signal)` that resolves
     immediately when stop() was called, so Stop is instant (<100 ms).
   - Safety: cap infinite loops with a yield every iteration (`await Promise.resolve()` + a 4 ms
     floor) so the UI never freezes.

2. src/runtime/SimSink.ts — implements RobotSink against a virtual robot model (no WebGL).
   State: { x, y, headingDeg, portValues: number[8], gripperOpen, matrix: boolean[8][8],
            matrixText, lcdText, lcdShape, ledColor, buzzerHz, sensors: Record<string, number> }
   Kinematics (mirror BaseMode.tsx so both screens feel identical):
     - forward/backward: 150 px/s along heading; turning: 90 deg/s; clamp inside the stage
       (±42% of stage half-width/height) exactly like BaseMode's clamp().
     - MOVE_TIMED  → params.direction forward|backward, params.speed (duty 0..100),
                     params.duration_ms; velocity scales with speed/70.
     - TURN_TIMED  → params.direction left|right, same scaling.
     - STEER_TIMED → params.steering -100..100 blends turn rate into forward motion.
     - CLAW_TIMED  → animates gripperOpen over params.duration_ms.
     - STOP / STOP_ALL → zero every port + zero velocity.
     - WAIT → params.duration_ms (accept `ms` too).
     - SET_PORT → set portValues[port-1]; also decay back to 0 after the timed command ends so the
       port strip mirrors what Port Control shows.
     - DISPLAY_MATRIX (params.pattern is the same string format as categories/looks.ts DEFAULT_MATRIX),
       DISPLAY_TEXT, SET_LED_BRIGHTNESS, CLEAR_MATRIX, LCD_SHAPE, LCD_TEXT, LCD_CLEAR,
       SET_LED_COLOR, DISPLAY_ICON → update state for the panel.
     - PLAY_TONE / PLAY_SOUND_EFFECT / PLAY_INTERNAL_SOUND → WebAudio beep (respect SET_VOLUME,
       and never throw if AudioContext is blocked).
     - SET_ANALOG / SET_DIGITAL / RESET_DISTANCE / RESET_HEADING → update virtual sensor state.
   getSensorValue(json): parse it, read params.sensor, and return a plausible virtual value:
     ultrasonic → distance to the nearest virtual obstacle (or 200 when the arena is empty),
     distance → integrated odometry, heading → headingDeg, light/temperature/humidity → smooth noise
     around a base value, button1/button2 → 1 while the on-screen virtual buttons are held,
     analog/digital → last SET_ value. Unknown sensor → null (must not crash the condition).
   Expose `subscribe(cb)` (external store) so React can render at ~30 fps without prop drilling.

3. src/runtime/TransportSink.ts — implements RobotSink against the real robot.
   - exec() serialises the command with `encodeCommand()` from src/domain/protocol.ts and calls
     `transport.sendLine(...)`, then awaits params.duration_ms locally for timed commands.
   - getSensorValue(): sends the GET_SENSOR_DATA line and returns the LAST cached TELEMETRY value
     for that sensor+port (keep a Map updated from `onTelemetry` in src/app/connection.ts). Never
     block the sandbox — it is synchronous by contract.
   - stopAll(): `estop()` from src/app/connection.ts.

4. src/components/blockcoding/SimStage.tsx — the 2D simulator panel.
   Layout (3 stacked sections inside the existing simCard, scrollable, ~360 px wide):
     a) ROBOT STAGE — reuse <RobotSprite/> from src/components/modes/RobotSprite.tsx verbatim
        (pass fwd/turn/gripperOpen/reduced) on a dotted #F3F4FB arena with a soft grid, exactly like
        styles.stage in src/styles/ModeControls.module.css. Apply the pose with a transform:
        `translate(x,y) rotate(heading)` — same technique as BaseMode's rAF loop. Draw a fading
        motion trail (last ~200 poses, polyline, indigo 20% alpha) so kids can see the path.
     b) PORT STRIP — extract the existing `PortBoard` sub-component out of
        src/components/modes/PortMode.tsx into src/components/modes/PortBoard.tsx and import it in
        BOTH places (no duplication). Under it render 8 compact read-only bars using PortMode's
        `fillBg(v)` center-out gradient and the same CW #8085F4 / CCW #F265AE colours, labelled 1..8.
     c) OUTPUT PANEL — 8x8 LED matrix preview (rounded dots, lit = category-blue), one line of LCD
        text, an RGB LED dot, and a buzzer pulse indicator.
   Also add small "virtual sensor" controls at the bottom: a slider for ultrasonic distance and two
   press-and-hold buttons for Touch Button 1 / 2, so sensor blocks can be demoed offline.
   Respect prefers-reduced-motion (freeze animation, still update pose) like BaseMode does.

5. WIRE IT UP in src/components/blockcoding/BlockCoding.tsx
   - Register the runner ONCE on mount, not inside the showSim effect:
       setSimulatorRunner((commands) => { setRunning(true); runnerRef.current.run(commands).finally(...) })
     so Run works offline even with every panel closed.
   - Route Run through the correct sink: connected → TransportSink, disconnected → SimSink.
     When connected AND the sim panel is open, drive both (mirror mode) so the on-screen robot
     shadows the real one.
   - handleStop() must call runner.stop() as well as estop().
   - Simulator toggle: default OFF. Keep the 3D panel behind a secondary "3D (beta)" switch inside
     the same card; the 2D stage is now the default and must never touch WebGL.
   - Use runner.onStep to add/remove a `.blocklyRunningBlock` glow on the block whose id produced the
     current command. To make that possible, add the source block id into every generated command as
     `params._bid` — do it in ONE place: wrap javascriptGenerator.forBlock at editor init
     (src/core.ts) so no category file has to change. Firmware ignores unknown params keys.

CONSTRAINTS
- No new heavy dependency. SVG + CSS + rAF only. three.js stays but is never imported by SimStage.
- Do not change the `{"command":..., "params":{...}}` wire shape or any opcode name.
- src/simulator_sequencer.ts keeps working for Academy/challenge levels; refactor it to delegate its
  control flow to ProgramRunner if that is cheap, otherwise leave it untouched.
- TypeScript strict must pass: `npm run typecheck`.

ACCEPTANCE (verify each, state how)
1. Disconnected, sim panel CLOSED, Run a Forward-2s program → console shows the interpreter running
   and no error. Reopen panel → robot has moved.
2. Forever + [if Ultrasonic < 20 → Turn Left, else Forward] with the virtual distance slider →
   the sprite reacts live when the slider is dragged. Stop halts within 100 ms.
3. Display Matrix block → the 8x8 preview shows the pattern; Play Tone → audible beep, no crash when
   audio is blocked.
4. Port strip lights up in the same colours as Port Control while a Movement block runs.
5. Open/close the panel 10 times → no "WebGL context limit" warning (2D path never allocates one).
6. Connected board: Run still streams identical bytes as before (diff the serial log).
```

---

# PROMPT 2 — Kategori AI + panel Computer Vision (webcam / ESP32-Cam)

```
ROLE
Implement the AI category and the Computer Vision panel of the Robotku Block Coding editor, replacing
the placeholder stubs in src/categories/ai.ts and the disabled "AI" toolbar button in
src/components/blockcoding/BlockCoding.tsx. Model inference runs in the BROWSER (the camera is on the
laptop/tablet, not on the ESP32), and the resulting values feed the existing block runtime.

KEY ARCHITECTURAL RULE
AI reporter blocks must resolve exactly the way sensor reporters already do: the generator emits a
sandbox call, and the runtime resolves it synchronously from the latest cached inference result.
Follow the pattern in src/categories/sensors.ts::reporter():
    getSensorValue(JSON.stringify({command:'GET_AI_DATA', params:{...}}))
Do NOT add a second evaluation mechanism, and do NOT try to run models on the robot.
Because inference lives in the browser, any program containing AI blocks runs HOST-EXECUTED: the
ProgramRunner (src/runtime/ProgramRunner.ts) evaluates conditions locally and streams only primitive
motion commands to the board. Detect this at Run time and log it once in the Serial Monitor
("AI program: dijalankan dari browser, robot menerima perintah gerak saja").

FILES TO CREATE
1. src/ai/types.ts
     export type CvKind = 'classification' | 'detection';
     export interface CvClassResult { label: string; score: number; }              // score 0..1
     export interface CvBox { label: string; score: number; x: number; y: number; w: number; h: number; } // normalised 0..1, x/y = CENTER
     export interface CvFrameResult { at: number; classes: CvClassResult[]; boxes: CvBox[]; }
     export interface CvEngine {
       id: string; name: string; kind: CvKind; labels: string[];
       load(): Promise<void>;
       infer(source: HTMLVideoElement | HTMLCanvasElement): Promise<CvFrameResult>;
       dispose(): void;
     }
2. src/ai/registry.ts — the model catalogue shown in the panel dropdown, grouped exactly like this:
     Classification Models
       - stop_go        "Stop Go (Open Palm & Close Fist)"   labels: open_palm (Go), closed_fist (Stop)
       - face_mood      "Smiling vs Frowning Face"           labels: smiling, frowning
       - rps            "Scissors Paper Stone"               labels: scissors, paper, stone
       - red_car        "Red Car Detector"                   labels: red_car, none
     Detection Models
       - coco           "Generic Object Detection (COCO)"    labels: the 80 COCO classes
       - balloon        "Balloon Detector"                   labels: balloon
       - balloon_esp32  "Balloon Detector (ESP32Cam)"        labels: balloon, source: esp32cam
   Each entry: { id, name, kind, group, labels, modelUrl, engine: 'tm' | 'cocossd' | 'mediapipe' }.
   modelUrl points at /models/<id>/ under public/ so models are swappable without a rebuild; if a
   model folder is missing, mark the entry `unavailable` and grey it out in the UI instead of throwing.
3. src/ai/engines/ — one adapter per engine, all behind CvEngine:
     - TeachableMachineEngine (@tensorflow/tfjs + @teachablemachine/image) for every classification model
     - CocoSsdEngine (@tensorflow-models/coco-ssd) for `coco`
     - CustomDetectorEngine (tfjs graph model, letterbox preprocess + NMS) for balloon
     - HandGestureEngine (@mediapipe/tasks-vision GestureRecognizer) as the preferred backend for
       stop_go when the model folder is absent — open palm / closed fist come free.
   Lazy-import every engine (`await import(...)`) so the AI bundle is never in the main chunk.
4. src/ai/cvStore.ts — singleton: camera lifecycle + inference loop + external store.
     - startCamera(deviceId?) via navigator.mediaDevices.getUserMedia({video:{width:640,height:480}});
       enumerateDevices() for the camera picker; handle NotAllowedError / NotFoundError with a calm
       inline message (no alert, no console spam).
     - ESP32-Cam source: instead of getUserMedia, poll an MJPEG/JPEG URL (settings-configurable,
       default http://192.168.4.1:81/stream) into an offscreen canvas; same downstream contract.
     - Inference loop throttled to ~10 fps via requestAnimationFrame + timestamp gate; pause when the
       tab is hidden (visibilitychange) and when the panel is closed.
     - Exponential smoothing on scores (alpha 0.6) so a jittery frame does not flip the robot.
     - Public API: getConfidence(label): number (0..100), getBox(label): CvBox|null,
       getTopLabel(): string, isDetected(label, threshold): boolean, getObjectCount(label): number,
       subscribe(cb), setModel(id), setThreshold(n), start(), stop(), getState().
     - Everything must return a safe default (0 / null / false) when the camera is off, so a program
       with AI blocks still runs (robot just never sees anything).
5. src/components/blockcoding/CvPanel.tsx — the floating panel from the reference screenshot.
   Draggable card, top-right of the canvas, Robotku DS styling (white surface, 16 px radius,
   indigo #4F46E5 accents, pink #EC2D8F for the AI category colour, Plus Jakarta Sans):
     - Header "Computer Vision" + a Webcam / ESP32-Cam segmented toggle + close X.
     - "Select CV Model" dropdown, grouped by Classification Models / Detection Models exactly as in
       registry.ts, with the current model highlighted.
     - Live preview (mirrored for webcam), with detection boxes + labels drawn on an overlay canvas
       (box colour = pink, label chip = white text on pink).
     - Confidence bars: one row per label of the current model, e.g. "Open Palm (Go) ---- 40%" /
       "Close Fist (Stop) ---- 60%", updating live, with the winning row emphasised.
     - A threshold slider (default 60%) that AI boolean blocks use.
     - Footer link "Train custom models here" → opens Teachable Machine in a new tab, plus a
       "Load model from URL/folder" input that registers a custom entry into the registry at runtime.
     - Before permission is granted, show the empty state "Enter learning element. Check permissions
       and try again." exactly like the reference, not a browser alert.

BLOCKS — rewrite src/categories/ai.ts (style "ai_blocks", colour #EC2D8F, keep defineOnce())
  Statements
   - ai_camera_on       "AI: turn camera [on|off]"                      → {command:'AI_CAMERA', params:{state}}
   - ai_use_model       "AI: use model [dropdown of registry ids]"      → {command:'AI_SET_MODEL', params:{model}}
   - ai_wait_until_seen "AI: wait until [label] is detected"            → META-style wait using the reporter
  Reporters (Number, output 0..100 so kids compare with plain numbers)
   - ai_confidence      "% Confidence of [label]"                        → getSensorValue(GET_AI_DATA {field:'confidence', label})
   - ai_bbox            "Bounding Box [Center X|Center Y|Width|Height] of [label]"
                        → getSensorValue(GET_AI_DATA {field:'bbox', axis, label})   // 0..100 of frame
   - ai_object_count    "Number of [label] detected"                     → {field:'count', label}
   - ai_top_label is NOT needed; skip it to keep the category small.
  Booleans
   - ai_detected        "Detected [label]?"                              → (getSensorValue(...{field:'detected'}) === 1)
  The [label] field is a DYNAMIC dropdown: it lists the labels of the currently selected model, plus
  "any". Implement it with a Blockly.FieldDropdown whose generator function reads cvStore.getState()
  — and make sure it degrades to a text input when no model is loaded.

RUNTIME WIRING
  - In src/runtime/SimSink.ts and src/runtime/TransportSink.ts, extend getSensorValue(): when the
    parsed command is 'GET_AI_DATA', delegate to cvStore (confidence → 0..100, bbox → 0..100,
    detected → 1|0, count → n). One added branch per sink, nothing else changes.
  - Handle AI_CAMERA / AI_SET_MODEL in exec() by calling cvStore.
  - In the 2D SimStage, when a detection model is active, draw the detected box as a coloured target
    marker in the arena so the offline demo of "chase the balloon" is understandable.

BLOCKCODING.TSX
  - Enable the AI toolbar button: toggles CvPanel, turns pink when the camera is live, and shows a
    small live dot. Remove `disabled`.
  - Camera must stop on unmount and when the panel closes (release the MediaStream tracks — a
    forgotten track leaves the webcam LED on and parents notice).

DEPENDENCIES (add to package.json, all lazy-loaded)
  @tensorflow/tfjs, @tensorflow-models/coco-ssd, @teachablemachine/image, @mediapipe/tasks-vision

CONSTRAINTS
- Next.js: every module touching navigator/window is client-only; CvPanel is imported through
  next/dynamic({ssr:false}) just like BlockCoding.
- getUserMedia needs a secure context: if location is plain http on a LAN IP, show an inline hint to
  use https or localhost instead of failing silently.
- Never store camera frames anywhere. No upload. State it in the panel footer in one short line.
- `npm run typecheck` clean.

ACCEPTANCE
1. AI button → panel opens → allow camera → "Stop Go" model → open palm makes the Open Palm bar go
   above 80%.
2. Program: forever [ if % Confidence of open_palm > 60 → Forward 0.5 s ; else if closed_fist > 60 →
   Stop All ] — robot (2D sim) starts/stops with the hand. Same program with the board connected
   moves the real robot.
3. Switch to "Balloon Detector" → boxes render on the preview and `Bounding Box Center X of balloon`
   returns ~50 when the balloon is centred, <30 on the left, >70 on the right.
4. Close the panel → webcam LED turns off, CPU drops to idle, and a running program keeps going with
   AI values reading 0.
5. Missing /models folder → model shows greyed out with a tooltip, app does not crash.
```

---

# PROMPT 3 — Kategori Templates (Go · Stop · Balloon dkk.)

```
ROLE
Turn the placeholder Templates category (src/categories/templates.ts — currently just a comment block)
into a real template library: a flyout of ready-made programs that a child can click to drop a whole
working script onto the canvas, plus the ability to save their own selection as a template.

DATA MODEL — src/templates/types.ts
  export interface BlockTemplate {
    id: string;
    name: string;               // short, shown on the card
    description: string;        // one line, Bahasa Indonesia
    tags: ('movement'|'sensor'|'ai'|'display'|'audio')[];
    requires?: ('camera'|'ultrasonic'|'line'|'claw')[];  // shown as a small chip on the card
    difficulty: 1 | 2 | 3;
    thumbnail: string;          // inline SVG string, no network fetch
    workspace: object;          // Blockly.serialization.workspaces.save() output, starting at program_start
  }

BUILT-IN TEMPLATES — src/templates/builtin/*.ts (one file each, typed, hand-written JSON)
  1. stop_go.ts — "Stop & Go"  (tags: ai, movement | requires: camera)
     AI: use model [stop_go] → AI: turn camera on → forever:
       if % Confidence of open_palm > 60  → Display Matrix (check) + Forward 0.3 s Medium
       else if % Confidence of closed_fist > 60 → Display Matrix (cross) + Stop All
  2. balloon_chase.ts — "Kejar Balon" (tags: ai, movement | requires: camera)
     AI: use model [balloon] → forever:
       if Bounding Box Center X of balloon < 40 → Left 0.2 s
       else if Bounding Box Center X of balloon > 60 → Right 0.2 s
       else if Bounding Box Width of balloon > 45 → Stop All   (sudah dekat)
       else → Forward 0.3 s
  3. balloon_pop.ts — "Pecahkan Balon" — balloon_chase + Claw Clockwise 1 s + Play Tone when width > 55.
  4. avoid_obstacle.ts — "Hindari Rintangan" (ultrasonic) — forever: if Ultrasonic < 20 cm →
     Reverse 0.4 s + Right 0.5 s else Forward.
  5. line_follow.ts — "Ikuti Garis" — two IR/analog reads on G1/G2 driving a steer decision.
  6. dance.ts — "Menari" — repeat 4 [ Left 0.4 s, Right 0.4 s, Play Tone, Display Matrix smiley ].
  7. rps_referee.ts — "Suit Batu Gunting Kertas" (model rps) — display the winner on the matrix.
  8. smile_light.ts — "Senyum = Lampu" (model face_mood) — smiling → LED green, frowning → LED red.
  Templates 1,2,3,7,8 require the AI category from PROMPT 2 — if those blocks are not registered,
  the card renders with a "butuh AI" chip and clicking it shows a toast instead of a broken load.

HOW TO AUTHOR THE workspace JSON without hand-writing it
  Add a dev-only helper: with ?devtemplate=1 in the URL, the toolbar shows a "Copy workspace JSON"
  button that prints Blockly.serialization.workspaces.save(workspace) to the clipboard. Build each
  template in the editor, copy, paste into the .ts file. Document this in src/templates/README.md.

FLYOUT — src/categories/templates.ts
  - Register a custom flyout callback instead of a static block list:
      workspace.registerToolboxCategoryCallback('TEMPLATES_FLYOUT', templatesFlyoutCallback)
    and set the category to { kind:'category', name:'Templates', custom:'TEMPLATES_FLYOUT',
    categorystyle:'templates_category' }. Registration happens in BlockCoding.tsx right after inject.
  - Blockly flyouts only host blocks, so implement each card as a real block:
    define a single block type `template_card` with a mutator-free extraState { templateId } that
    renders as a gold (#CA8A04) card: template name + a small SVG icon + difficulty dots. The
    callback returns one `template_card` state per template plus the existing `templates_comment`
    block and a "Simpan blok terpilih sebagai template" label.
  - Clicking/dragging a card must NOT drop the card onto the canvas. Intercept
    Blockly.Events.BLOCK_CREATE for type `template_card`: dispose the created block and instead
    append the template's blocks to the workspace.

INSERTION SEMANTICS (this is the part that usually breaks — be careful)
  - Loading a template must PRESERVE the child's existing work. Behaviour:
      * If the canvas only holds the immovable `program_start` block with nothing attached →
        load the template directly under it.
      * Otherwise → show a small confirm ("Ganti program sekarang" / "Tambahkan di samping" / Batal).
        "Tambahkan" appends the template's stack as a separate top-level stack offset to the right of
        the existing content bounding box, with fresh block ids.
  - Always regenerate block ids on insert (Blockly.serialization has no id-collision protection):
    deep-clone the template JSON and rewrite every `id` field with Blockly.utils.idGenerator.genUid().
  - After insert: workspace.cleanUp() is too aggressive — instead scroll/centre on the new stack and
    flash it (2 x 300 ms outline pulse in the category gold).
  - Wrap the whole insert in Blockly.Events.setGroup(true/false) so ONE Ctrl+Z undoes it.

USER TEMPLATES
  - "Simpan sebagai template": takes the currently selected block (and everything below it), saves
    { id, name, savedAt, workspace } under a new `templates` key via src/app/persistence.ts
    (add loadUserTemplates/persistUserTemplates next to loadProjects/persistProjects — same
    safeGet/safeSet pattern, never throw when storage is blocked).
  - User templates appear in the same flyout under a "Template Saya" label, each with a delete
    (long-press or right-click → Hapus) action.

ACCEPTANCE
1. Templates category shows 8 built-in cards with icons; the flyout tint is the gold Templates colour.
2. Clicking "Stop & Go" on an empty canvas loads a complete runnable program; pressing Run with the
   camera on makes the sim robot start/stop with your hand.
3. Clicking a second template on a non-empty canvas offers Replace/Append/Cancel and Append never
   deletes the previous stack.
4. Ctrl+Z once removes an entire inserted template.
5. Insert the same template twice → no duplicate-id warnings in the console.
6. Save selection as template → reload the page → it is still there under "Template Saya".
```

---

# PROMPT 4 — Share Code (8 karakter) + Load a Shared Program

```
ROLE
Implement program sharing for Robotku Block Coding: a Share menu that turns the current workspace into
a short 8-character code, and a "Load a shared program" dialog that restores a friend's program from
that code. Today src/components/blockcoding/BlockCoding.tsx::handleShare only copies the generated
JSON to the clipboard — replace it.

CODE FORMAT
  - 8 characters, Crockford Base32 alphabet without I, L, O, U → "0123456789ABCDEFGHJKMNPQRSTVWXYZ".
  - Displayed grouped as XXXX-XXXX, stored/queried uppercase without the dash.
  - Input must be paste-tolerant: accept lowercase, spaces, dashes, a full URL, or the code pasted
    into any one of the 8 boxes; normalise before lookup. Map visually confusable input on the way in
    (o→0, i→1, l→1) so a kid reading a code off a friend's screen still succeeds.
  - 32^8 ≈ 1.1e12 combinations; on collision, retry generation up to 5 times.

BACKEND — Next.js API routes (pages/api, this repo uses the pages router)
  POST /api/programs
    body: { workspace: object, name?: string }
    - Reject payloads > 256 KB with 413.
    - Validate it deserialises: it must be an object with a `blocks` key (do not run Blockly server-side).
    - Generate code, store { code, workspace, name, createdAt, expiresAt, hits }, return
      { code, url, expiresAt }. TTL 30 days, refreshed on read.
    - Rate limit: 20 creates per IP per hour (in-memory LRU is fine for the dev adapter).
  GET /api/programs/[code]
    - 404 → { error: 'NOT_FOUND' }; 410 → { error: 'EXPIRED' }. Never leak stack traces.
    - Increments hits, returns { workspace, name, createdAt }.
  STORAGE ADAPTER — src/server/programStore.ts with one interface and two implementations:
    - MemoryStore (default, dev, no config)
    - KvStore (Upstash Redis / Vercel KV) enabled when KV_REST_API_URL + KV_REST_API_TOKEN exist.
    Selected at module load; document both in README. Do not hard-code a vendor anywhere else.
  Payload: gzip the workspace JSON (CompressionStream on the client, base64) before POST — programs
  are very repetitive JSON and this keeps stored blobs ~10x smaller.

OFFLINE / NO-SERVER FALLBACK
  If POST fails (offline, static export, workshop with no internet), fall back to a self-contained
  link: compress the workspace, base64url it into the URL hash (#p=...), and show that link instead of
  a code, with a clear note "Kode online tidak tersedia — pakai link ini". The Load dialog must accept
  such a link too. Never lose the child's program because the network is down.

UI — SHARE (src/components/blockcoding/ShareModal.tsx)
  Triggered by the existing Share toolbar button. Robotku DS card:
    - Big code display XXXX-XXXX in a monospace-ish tracking-wide style, with a Copy button.
    - A QR code of the share URL (generate locally with `qrcode` — no external image service, this
      is used offline in classrooms).
    - "Salin link" + "Bagikan" (navigator.share when available).
    - Expiry line: "Kode berlaku 30 hari".
    - While generating: skeleton state; on error: retry + the offline-link fallback above.
    - Cache the code for the current workspace hash so pressing Share twice does not create two codes.

UI — LOAD (src/components/blockcoding/LoadSharedModal.tsx) — match the reference screenshot
  Purple/violet gradient card, centred, on a dimmed backdrop:
    - Title "Load a shared program", subtitle "Got a code from a friend? Enter it to open their
      program on your robot." (provide Bahasa Indonesia strings too; keep one strings file so the
      whole modal can be switched).
    - Label "PROGRAM CODE" + a paste icon button that reads navigator.clipboard.
    - 8 rounded input boxes with auto-advance, backspace-to-previous, arrow keys, and full-code paste
      into any box. Hint under it: "All caps · letters & numbers · paste works in any box".
    - Info row with an (i) icon: "Ask a friend to share their 8-character code from the Share menu,
      then key it in above."
    - Primary button "Load Program" (disabled until 8 chars), secondary "Cancel".
    - Inline error states, never an alert: NOT_FOUND → "Kode tidak ditemukan. Cek lagi ya.",
      EXPIRED → "Kode sudah kedaluwarsa.", network → "Tidak bisa terhubung."
  Entry points: a "Load code" item in the Projects page (src/pages/control/projects.tsx) AND next to
  Share in the editor toolbar.

LOADING SEMANTICS
  - Loading replaces the canvas, so confirm first when the current workspace has more than just
    `program_start`: "Program di kanvas akan diganti. Simpan dulu?" → Simpan & Muat / Muat / Batal.
  - Reuse the existing hand-off: src/app/editorBridge.ts::setPendingWorkspace() then route to the
    editor — that is exactly how Projects already opens a program, so Load-from-Projects needs no new
    plumbing.
  - Deep link: /control/modes/code?code=XXXXXXXX (and the #p= fallback) auto-opens the modal
    pre-filled and loads after confirmation.
  - Validate the loaded workspace before injecting: unknown block types must be dropped with a single
    toast ("2 blok tidak dikenal dilewati") rather than throwing inside Blockly.

CONSTRAINTS
- No auth, no accounts — a code is a capability. Because of that: no personal data in the payload,
  and the API must not expose any listing/enumeration endpoint.
- Add `qrcode` (or a tiny QR generator) as the only new dependency.
- All modals: focus trap, Esc to close, aria-modal, and mobile-friendly (the 8 boxes must not
  overflow on a 360 px screen).

ACCEPTANCE
1. Share → code appears in < 1 s, Copy works, QR scans to a URL that opens the same program.
2. Second device: Load → type the code (or paste it into box 1) → the exact same blocks appear.
3. Wrong code → inline "tidak ditemukan", boxes stay filled so the child can fix one character.
4. Kill the API (rename the route) → Share still produces a working offline link.
5. Load with unsaved work → confirmation appears and Cancel truly cancels.
6. Refresh after loading → program still there (it went through the normal editor/persistence path).
```

---

# PROMPT 5 (opsional) — Sensor Monitor dengan grafik

```
ROLE
Upgrade the Serial Monitor in src/components/blockcoding/BlockCoding.tsx into the "Sensor Monitor"
panel from the reference: a live list of every sensor value with a click-to-graph detail view.

SPEC
- Header "Sensor Monitor" with minimise + close, draggable, same card styling as CvPanel.
- Body: one row per known sensor/port pair seen in telemetry (name, port, current value, unit),
  updating at ~5 Hz. Values come from the telemetry cache added in PROMPT 1's TransportSink; when the
  robot is offline, read the virtual sensors from SimSink so the panel is never dead.
- Empty state exactly as in the reference: "Not connected to board" + a muted footer
  "click on item for graph".
- Clicking a row expands a sparkline: last 60 s, ~300 samples in a ring buffer, plain SVG polyline,
  auto-scaled Y with a stable baseline, no charting dependency.
- Toolbar: pause/resume, clear, and "Export CSV" (timestamp,sensor,port,value) via a Blob download.
- Keep the raw line log behind a "Raw" tab so debugging the firmware is still possible.
- Memory: cap every ring buffer at 300 samples and the raw log at 500 lines (it is currently sliced
  at 200 in setTelemetry — keep that discipline).

ACCEPTANCE
1. Connected board streaming TELEMETRY → rows appear automatically with live values.
2. Click a row → sparkline animates; pause freezes it; export produces a valid CSV.
3. Offline → virtual sensor rows from the 2D sim, and the ultrasonic slider visibly moves the graph.
4. Leave it open 10 minutes → memory flat (check the heap snapshot).
```

---

## Catatan eksekusi

- **Jalankan satu prompt per sesi** Claude Code, lampirkan repo, dan minta diff per file + langkah verifikasi (persis pola `a.md` kamu). Prompt 1 mengubah fondasi runtime; kalau digabung dengan yang lain, review-nya jadi tidak terkendali.
- **Titik rawan yang sengaja sudah ditulis di prompt** karena paling sering salah kalau tidak disebut: bentuk `params` (bukan flat), sandbox `getSensorValue`, regenerasi block id waktu insert template, kamera yang tidak di-`stop()` waktu panel ditutup, dan `setSimulatorRunner` yang saat ini tersandera di dalam efek `showSim`.
- **Keputusan arsitektur yang perlu kamu setujui dulu**: model AI jalan di browser, jadi program ber-AI tidak bisa berjalan standalone di ESP32 — robot hanya menerima perintah gerak selama laptop/tablet terhubung. Kalau nanti mau otonom penuh, jalurnya beda (TFLite Micro / ESP-DL di ESP32-Cam), dan itu prompt tersendiri.
- **Model file**: prompt sudah minta `public/models/<id>/`. Kalau model Teachable Machine kamu belum ada, `stop_go` tetap jalan lewat MediaPipe gesture recognizer, jadi demo Go/Stop bisa dipakai duluan tanpa training.
