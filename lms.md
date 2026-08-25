# Robotku Block Coding — Prompt Pack v2
### Simulator full-fidelity (SEMUA blok) · Parity test per blok · Templates · AI Computer Vision

Dibuat dari audit `robotku-main__2_.zip`. Baca bagian audit dulu — separuh masalah yang kamu rasakan ("simulatornya cuma port", "AI belum ada", "template cuma comment") sebabnya ada di situ, bukan di kualitas prompt sebelumnya.

---

## AUDIT REPO v2 — apa yang benar-benar terjadi

**Yang sudah dibuat (dan bagus):**
`src/runtime/ProgramRunner.ts`, `src/runtime/SimSink.ts`, `src/runtime/TransportSink.ts`, `src/runtime/telemetryCache.ts`, `src/components/blockcoding/SimStage.tsx` + `.module.css`, `src/components/modes/PortBoard.tsx` (sudah di-extract dan dipakai bareng Port Control).

**Masalah #1 — file runtime itu YATIM. Tidak ada satu pun yang meng-import-nya.**
```
$ grep -rn "SimStage\|ProgramRunner\|SimSink\|TransportSink" src --include=*.tsx | grep -v runtime/
(kosong)
```
`BlockCoding.tsx` **tidak berubah sama sekali**: masih `new Simulator(container)` + `SimulatorSequencer` three.js, dan `setSimulatorRunner(...)` masih terkunci di dalam `useEffect([showSim])` (baris 259–297). Jadi mesin 2D yang bagus itu ada di disk tapi tidak pernah jalan. Ini penjelasan langsung kenapa yang kelihatan cuma port/3D.

**Masalah #2 — pipeline generate membuang blok yang tidak menghasilkan JSON.**
Di `BlockCoding.tsx::generateCode()` tiap segmen yang gagal `JSON.parse` dibuang diam-diam (`console.warn` doang). Akibatnya:
- `procedures_defnoreturn` / `procedures_callnoreturn` (Functions) → hilang total.
- `variables_set` memang emit `META_SET_VAR`, tapi **tidak ada** yang menginterpretasikannya (komentar di file itu sendiri bilang "TODO").

**Masalah #3 — nilai parameter dibekukan saat generate, bukan saat run.**
`motors.ts::durSecs()` = `parseFloat(valueToCode(...))`. Kalau input Duration diisi variabel, hasil `math_arithmetic`, atau reporter sensor, `parseFloat("hitung")` → `NaN` → jadi `0.1` detik. Artinya **Math, Variables, dan reporter Sensor tidak bisa dipakai di dalam input angka blok manapun**. Ini akar masalah "blok tidak semua bekerja", dan tidak bisa diperbaiki hanya di simulator — harus di kontrak param.

**Masalah #4 — opcode yang tidak ditangani SimSink:** `SET_HEAD_POSITION`, `SET_GRIPPER`, `RECORD_AUDIO`, `PLAY_RECORDING` (sensor `recording` juga), `SET_BPM` (dipakai `audio_play_tone_beat` → beats belum dikonversi ke ms), dan `SET_ANALOG`/`SET_DIGITAL`/`sensor_get_*` yang masih global — belum per-port G1..G8.

**Masalah #5 — pemetaan port belum didefinisikan.** Blok Movement pakai `M1..M4`, Sensor pakai `G1..G8`, `SimSink.portValues` pakai index 1..8, `move_stop` menerima `wheels/left/right` tapi SimSink menolkan semua port. Harus ada satu tabel mapping.

**Masalah #6 — AI & Templates memang belum dikerjakan.** `categories/ai.ts` (46 baris) masih 2 blok stub, `categories/templates.ts` (36 baris) masih 1 blok comment, dan tombol AI di toolbar masih `disabled`.

**Urutan wajib:** A → B → C → D → E. Prompt A dan C adalah inti dari permintaanmu ("semua blok bekerja & dites satu-satu").

---

# PROMPT A — Sambungkan runtime + bikin SEMUA blok benar-benar tereksekusi

```
ROLE
Work in the existing Robotku repo (Next.js 15, React 19, TypeScript strict, Blockly 12).
Two jobs: (1) actually wire the already-written 2D runtime into the editor — it is currently dead
code that nothing imports — and (2) close the gaps that make whole categories of blocks no-ops.
Ship this as one coherent change with a diff per file and a verification note per fix.

=== PART 1: WIRE THE RUNTIME (src/components/blockcoding/BlockCoding.tsx) ===
Current state to replace: the component imports Simulator + SimulatorSequencer, and registers
setSimulatorRunner INSIDE the `useEffect(..., [showSim])` at lines ~259-297, so Run does nothing
offline unless the 3D panel is open. src/runtime/* and SimStage.tsx are never imported.

Target state:
- Create ONE SimSink and ONE ProgramRunner per mounted editor, in a mount-effect (empty dep array),
  stored in refs. Register setSimulatorRunner there, unconditionally, and clear it on unmount.
- Sink selection at Run time:
    connected  -> TransportSink (streams to the board)
    offline    -> SimSink
    connected + sim panel open -> mirror: run TransportSink, and feed the same commands to SimSink
    so the on-screen robot shadows the real one. Implement this as a tiny `FanOutSink` that
    implements RobotSink and forwards exec()/stopAll() to N sinks, resolving getSensorValue() from
    the FIRST sink that returns non-null (transport first, sim as fallback).
- Because a runner can only own one sink, construct the runner per Run call:
    runnerRef.current = new ProgramRunner(pickSink()); await runnerRef.current.run(cmds);
  Guard re-entry: if a runner is already running, Run acts as Restart (stop, await, then run).
- handleStop(): runner.stop() AND estop(). Must zero the sim too.
- The simulator panel now renders <SimStage sink={simSink} reduced={prefersReducedMotion}/> by
  default. Keep the three.js path behind a secondary "3D (beta)" toggle inside the same card; when
  3D is off, nothing from src/simulator.ts may be imported at runtime (use a dynamic import so it
  stays out of the main chunk).
- The panel must be resizable/collapsible and default OPEN on desktop (>=1280px), collapsed on
  small screens. Kids need to see the robot to believe the blocks did something.

=== PART 2: RUN-TIME EXPRESSIONS (this is what makes Math/Variables/Sensors usable) ===
Problem: generators freeze numeric inputs at generate time (`parseFloat(valueToCode(...))`), so any
non-constant input becomes NaN -> 0.1. Fix the CONTRACT, in one place, without touching the wire
format the firmware sees.

1. New file src/categories/_args.ts:
     export function numArg(block, gen, inputName, fallback = 1): number | { $expr: string }
     - Read `gen.valueToCode(block, inputName, Order.ATOMIC)`.
     - If it parses as a finite number -> return the number (unchanged behaviour, byte-identical
       output for every existing constant program).
     - Otherwise -> return { $expr: code } so the value is resolved at run time.
     Also export strArg() with the same shape for text inputs.
2. Update EVERY generator that currently uses parseFloat/parseInt on a value input to use numArg:
   motors.ts (durSecs, STEERING), events.ts (timing_wait), looks.ts (secs), audio.ts (num()),
   sensors.ts (SET_ANALOG value). Field-only values (dropdowns, sliders) stay literal.
3. In ProgramRunner, before `sink.exec(command)`, deep-resolve params:
     resolveParams(params, scope) — walk the object; any `{$expr: "..."}` is evaluated through the
     SAME sandbox used by evaluateCondition, extended with the variable scope. Cache the compiled
     Function per expression string (Map) so a forever-loop does not recompile every iteration.
   TransportSink therefore always receives plain literals — the firmware never sees `$expr`.
4. Conditions get the same scope: evaluateCondition must expose variables as real identifiers.

=== PART 3: VARIABLES ===
- `variables_set` already emits META_SET_VAR {name, value}. Make `value` go through numArg/strArg so
  `set score to score + 1` works.
- ProgramRunner: keep `private scope: Record<string, any>` cleared at the start of every run().
  Handle META_SET_VAR by assigning `scope[sanitize(name)] = resolve(value)`.
- `variables_get` already emits the sanitised identifier — the sandbox must receive the scope, so
  build evaluators as `new Function('getSensorValue','mathRandomInt','$v', 'with($v){ return ...; }')`
  OR (preferred, no `with`) compile with the current scope keys as named parameters and pass their
  values positionally. Recompile only when the key set changes.
- Blockly's typed variable flyout already gives Number/String/Boolean vars — support all three;
  numbers must not become strings after a round trip.
- Expose the live scope to the UI: ProgramRunner.onScopeChange?(scope) so SimStage can show a
  "Variables" watch list (see PROMPT B).

=== PART 4: FUNCTIONS ===
- Generators (new file src/categories/functions_gen.ts, imported from categories/index.ts):
    procedures_defnoreturn ->  META_FUNC_DEF {name, args:[...]} ; <body> ; META_FUNC_END
    procedures_callnoreturn -> META_CALL {name, args:[<resolved values>]}
    procedures_ifreturn     -> META_RETURN {}
- ProgramRunner:
    * Pre-pass before execution: index every META_FUNC_DEF -> {startPc, endPc, argNames} and record
      the skip ranges. During linear execution, a META_FUNC_DEF jumps straight to its META_FUNC_END
      (definitions must not run inline).
    * META_CALL: push {returnPc, savedArgs} on a call stack, bind args into scope, jump to startPc+1.
      META_FUNC_END / META_RETURN: pop, restore, jump back. Depth cap 32 -> on overflow, stop the
      program and toast "Fungsi memanggil dirinya terlalu dalam".
    * Loop stack and call stack are separate; a break inside a function must not escape the caller's
      loop (save/restore loopStack depth on call).
- Value-returning functions (`procedures_defreturn`/`callreturn`) cannot work in a synchronous
  condition sandbox. Hide them from the Functions flyout (Define + Call + Exit only, as in a.md) and
  document why in a comment. Do not silently generate broken code.

=== PART 5: MISSING OPCODES + PORT MAP ===
- New file src/domain/ports.ts — the ONE mapping table, imported by SimSink, TransportSink and
  PortMode: M1..M4 -> physical port 1..4, G1..G8 -> port 1..8 (sensor bus), plus
  `portIndex(name: string): number|null`. No more magic 0/1 indices in SimSink.animateDrive:
  light up the ports the block actually names (LEFT/RIGHT/PORT fields), so the strip tells the truth.
- SimSink: add handlers for
    SET_HEAD_POSITION {pitch,yaw}  -> head pose in state (rendered in PROMPT B)
    SET_GRIPPER {state}            -> gripperOpen 1|0 instantly
    RECORD_AUDIO {slot,secs,wait}  -> sets sensors.recording=1 for the duration, stores a fake clip
                                      length per slot; honours `wait`
    PLAY_RECORDING {slot,wait}     -> beeps for the stored clip length; no clip -> short error tone
    SET_BPM {bpm}                  -> stored; PLAY_TONE with `beats` resolves ms = beats*60000/bpm
    STOP {wheels,left,right}       -> zero ONLY the named ports (currently zeroes all 8)
  and make SET_ANALOG/SET_DIGITAL/`sensor_get_analog`/`sensor_get_digital` per-port:
  sensors.analog[port], sensors.digital[port]; getSensorValue must read params.port.
  Add `recording` to getSensorValue (sensor_is_recording currently always null -> false).
- ProgramRunner: `WAIT_UNTIL` already handled — verify the 60 s cap emits a visible toast rather
  than silently continuing.

=== PART 6: BLOCK HIGHLIGHTING ===
- In src/core.ts, wrap javascriptGenerator.forBlock once at init so every generated command object
  carries `params._bid = block.id` (do it centrally; no category file changes). Strip `_bid` in
  TransportSink before sending so the wire stays clean.
- BlockCoding: runner.onStep -> add class `runningBlock` to that block's SVG group (CSS: 3px indigo
  glow + slight scale), remove on the next step and on finish. This is how a child sees which block
  is executing right now.

CONSTRAINTS
- Byte-identical wire output for programs that only use constants — verify by diffing the JSON of an
  existing saved .rbk before/after.
- `npm run typecheck` clean. No new dependency in this prompt.
- Do not delete simulator.ts / simulator_sequencer.ts (Academy uses them).

ACCEPTANCE
1. Offline, panel open, Run "Forward 1 s Medium" -> the sprite drives forward, port strip shows M1/M2.
2. `set speed to 3` then `Forward [speed] sec` -> robot drives 3 seconds (before this fix: 0.1 s).
3. `Forward [Ultrasonic Sensor Value / 10] sec` -> duration follows the virtual slider.
4. Define a function "Zigzag" (Left 0.3, Right 0.3), call it 3x inside repeat -> 6 moves, correct order.
5. Break inside a function does not break the caller's repeat loop.
6. Stop mid-run halts within 100 ms and zeroes the port strip.
7. Highlight follows execution block by block; ends clean.
8. Connected board: serial log identical to pre-change for a constant-only program.
```

---

# PROMPT B — SimStage full-fidelity: setiap blok punya efek yang KELIHATAN

```
ROLE
Upgrade src/components/blockcoding/SimStage.tsx (+ .module.css) from a minimal panel into a complete
virtual robot instrument panel, so that EVERY block in the toolbox produces a visible, obvious effect
on screen. Rule of thumb: if a child runs one block alone and sees nothing change, that block is not
done.

LAYOUT (single scrollable column, ~380px, or a 2-column grid when the panel is widened)
 1. ARENA (top, square, dotted #F3F4FB like BaseMode's stage)
    - RobotSprite with pose transform + fading trail (already implemented — keep).
    - ADD: heading compass ring + a live readout chip "x: 12 cm · y: -4 cm · θ: 45°".
    - ADD: a start marker and a faint 10 cm grid so "Forward 1 s" is measurable, not just vibes.
    - ADD: head pose — render the sprite's head/sensor cone rotating with SET_HEAD_POSITION
      (pitch/yaw), and the ultrasonic cone drawn from it. Extend RobotSprite with optional
      `headPitch`/`headYaw` props (default values keep Base Robot's look byte-identical).
    - ADD: a virtual obstacle the child can drag inside the arena. The `ultrasonic` reading becomes
      the real distance from the robot's cone to that obstacle (fallback: the manual slider when no
      obstacle is placed). This makes "avoid obstacle" programs demonstrable offline.
    - ADD: collision feedback — bump the sprite, flash the arena border, count collisions.
 2. PORT STRIP — keep PortBoard + the 8 bars, but label each bar with the block-facing name
    (1/M1, 2/M2 ... 8/G8) using src/domain/ports.ts, and show the numeric value on the right.
 3. OUTPUT PANEL
    - 5x5 LED matrix (matches DISPLAY_MATRIX's 25-cell payload) with brightness-driven opacity,
      plus scrolling text rendering for DISPLAY_TEXT (marquee across the 5x5, one column per ~120 ms).
    - LCD: a small screen widget that actually draws LCD_SHAPE (heart, smile, arrow, square, circle —
      whatever the dropdown offers) as SVG, not as a text label, and LCD_TEXT as two 16-char lines.
    - RGB LED dot with a glow, buzzer pulse + current note name and Hz, volume bar, BPM readout.
    - Microphone widget: recording state (red dot + countdown) for RECORD_AUDIO, and 8 clip slots
      that fill in when recorded and animate when played.
 4. SENSOR RACK — one row per sensor with live value AND an editable control, so every reporter
    block can be exercised offline:
      ultrasonic (slider or arena obstacle), light (slider), temperature (slider), humidity (slider),
      heading (read-only, from pose), distance travelled (read-only + reset flash),
      button1/button2 (hold buttons), analog G1..G8 (small numeric inputs), digital G1..G8 (toggles),
      recording (read-only lamp).
 5. VARIABLES WATCH — live table of the runner's scope (name, value, type), updating via
    ProgramRunner.onScopeChange. Empty state: "Belum ada variabel".
 6. CALL STACK / STATUS strip — running / stopped, current block name, loop iteration counter,
    elapsed time, and a collision counter.

RUN CONTROLS (in the panel header)
 - Speed multiplier 0.25x / 0.5x / 1x / 2x / 4x — applied by ProgramRunner (scale every sleep) so
   long programs are demoable in class. Never scale below 1 ms.
 - Step mode: pause + "Langkah" button that executes exactly one command (runner exposes
   `pause()`, `resume()`, `step()` implemented with a gate promise awaited at the top of the loop).
 - Reset: sink.reset() — pose, trail, ports, outputs, sensors back to initial, without reloading.

QUALITY BAR
 - 60 fps with a forever loop running; SimSink already throttles commits to ~40 fps — do not add
   per-frame React state in SimStage beyond the store subscription.
 - prefers-reduced-motion: no spinning wheels, no marquee; values still update.
 - Every widget has an aria-label in Bahasa Indonesia; the panel is keyboard reachable.
 - No canvas-per-widget; plain SVG/CSS. Zero new dependencies.

ACCEPTANCE — run each block ALONE and confirm the named widget reacts:
 Display Matrix -> pattern; Display Text -> marquee; Set Brightness -> dimming; Clear -> blank;
 LCD Shape -> drawn shape; LCD Text -> two lines; LCD Clear -> blank;
 Play Tone (sec) -> audible + note chip; Play Tone (beat) at BPM 60 vs 240 -> different duration;
 Sound Effect -> pulse; Set Volume -> volume bar + quieter beep; Stop Sounds -> silence;
 Record 2 s -> red dot + countdown + slot fills; Play Recording -> slot animates;
 Set Head -> head cone rotates; Set Gripper -> claw opens/closes; Claw for 1 s -> claw animates;
 Set Analog G3 to 200 -> G3 numeric shows 200; Get Analog G3 -> same value in a variable watch;
 Set Digital G5 HIGH -> G5 toggle flips; Reset Distance -> odometry chip resets to 0;
 Reset Heading -> compass snaps to 0; Steering -100..100 -> visibly different arcs.
```

---

# PROMPT C — Parity harness: uji SETIAP blok satu per satu (block ↔ simulator)

```
ROLE
Build a test harness that proves, block by block, that the toolbox and the simulator agree. Every
block in the Robotku toolbox gets one entry: the workspace that contains just that block, the exact
command JSON it must generate, and the assertion on SimSink state after running it. This is the
regression net for everything PROMPT A and B just built.

TOOLING
- Add vitest + @vitest/coverage-v8 (dev deps) and a `test` / `test:watch` script. jsdom environment.
- Blockly runs headless: use Blockly.inject into a detached div, or better, headless workspaces via
  `new Blockly.Workspace()` + the same generator registration path as src/core.ts. Reuse
  initializeAstroidEditor() so the theme/field registration matches production exactly.

FILES
 src/test/harness.ts
   - buildProgram(blockJson): loads a workspace JSON containing program_start + the block under test
     and returns the command array using the SAME code path as BlockCoding.generateCode() (extract
     that function into src/blockcoding/generateProgram.ts first and import it in BOTH places — the
     test must not re-implement it).
   - runInSim(commands, {timeoutMs}): new SimSink + ProgramRunner, run, return final SimState +
     a recorded log of every exec() call.
   - Fake timers where possible; where the sink animates over real time, use a 4x speed multiplier
     and a generous timeout.
 src/test/blocks/<category>.test.ts — one file per category.

COVERAGE MATRIX — every row is one test. Do not skip a row; if a block genuinely has no simulator
effect, assert the emitted JSON and mark it `it.todo` with a reason comment.

 MOVEMENT (8)
  move_forward     -> MOVE_TIMED dir forward   | y decreases, heading unchanged, odometry > 0
  move_reverse     -> MOVE_TIMED dir backward  | y increases
  move_left        -> TURN_TIMED dir left      | heading decreases ~90deg/s * secs * speed/70
  move_right       -> TURN_TIMED dir right     | heading increases
  move_steer       -> STEER_TIMED              | steering -100 vs +100 produce mirrored headings
  move_claw        -> CLAW_TIMED               | gripperOpen animates to 0 (clockwise) / 1 (anti)
  move_stop        -> STOP {wheels,left,right} | only the named ports zeroed, others untouched
  move_stop_all    -> STOP_ALL                 | all 8 ports zero, fwd/turn zero
 TIMING (2)
  timing_wait      -> WAIT                     | elapsed >= duration, pose unchanged
  timing_wait_until-> WAIT_UNTIL               | resolves when a virtual sensor crosses the threshold
 DISPLAY (7)  display_matrix, display_text, display_set_brightness, display_clear_matrix,
              lcd_shape, lcd_text, lcd_clear   | assert matrix[], displayText, brightness, lcd*
 AUDIO (8)   audio_record, audio_play_recording, audio_sound_effect, audio_play_tone_sec,
             audio_play_tone_beat (assert BPM math: 2 beats @120bpm == 1000 ms),
             audio_set_volume, audio_stop_sounds, audio_set_bpm
 SENSORS (14) sensor_button1/2, sensor_is_recording, sensor_set_analog, sensor_get_analog,
             sensor_set_digital, sensor_get_digital, sensor_ultrasonic, sensor_temperature,
             sensor_humidity, sensor_light, sensor_distance, sensor_reset_distance,
             sensor_heading, sensor_reset_heading
             | reporters are tested inside a condition: `if <reporter> > X then Forward` and the
               assertion is whether the robot moved. That is the only honest way to test a reporter,
               because reporters do not exist as standalone commands.
 PROGRAM FLOW (6) controls_forever (runs N iterations then stop() halts it),
             controls_repeat_ext (exactly N), controls_while (condition flips -> exits),
             controls_break, controls_continue, controls_if / else-if / else (all three branches)
 LOGIC (4)   logic_compare, logic_operation, logic_negate, logic_boolean — inside an if-condition
 MATH (7)    math_number, math_arithmetic, math_modulo, math_constant, math_single, math_round,
             math_random_int (seed Math.random, assert range) — as a duration input, assert timing
 VARIABLES (2) variables_set (number/string/boolean), variables_get inside a duration + a condition
 FUNCTIONS (3) define + call (executes body once), call inside a loop (N times), Exit (early return)
 MECHANISMS (2) mechanism_set_head, mechanism_set_gripper
 TEMPLATES (1) templates_comment -> emits nothing, program still runs
 AI (after PROMPT E) ai_confidence, ai_bbox, ai_detected, ai_object_count, ai_camera_on,
             ai_use_model — with a mocked cvStore returning scripted frames

ALSO ASSERT (integration tests, src/test/integration.test.ts)
 - Wire parity: for a fixed sample program, the array produced by generateProgram() equals a
   committed snapshot fixture (guards accidental generator changes).
 - TransportSink parity: run the same program through a fake transport that records lines; assert
   every line is valid JSON, ends with ';', contains no `_bid` and no `$expr`.
 - Stop latency: forever program, stop() -> resolves in < 150 ms.
 - No leak: run/stop 50 times -> listener count on the sink stays constant.

DELIVERABLE
 - `npm test` green, and a generated coverage report src/test/COVERAGE.md listing every block type
   found by scanning `Blockly.Blocks` against the tested set, so an untested block is impossible to
   miss. Fail the test run if a block exists in the toolbox but has no test.
```

---

# PROMPT D — Templates yang menarik (galeri, bukan comment)

```
ROLE
Replace the placeholder Templates category (src/categories/templates.ts — one comment block) with a
template GALLERY that a 9-year-old wants to click. Two surfaces: a rich modal gallery (primary) and
a compact flyout (secondary, for quick reuse).

GALLERY MODAL — src/components/blockcoding/TemplateGallery.tsx
 - Opens from the Templates sidebar category AND from a "Templates" button in the right toolbar.
 - Layout: left rail of collections (Semua · Gerak Dasar · Sensor · AI Kamera · Seni & Suara ·
   Tantangan · Template Saya), right side a responsive card grid.
 - Each card: animated SVG thumbnail (the robot's actual path for motion templates — a tiny looping
   preview, not a static icon), title, one-line Indonesian description, difficulty dots (1-3),
   requirement chips (Kamera / Ultrasonic / Capit), and an estimated block count.
 - Hover/focus -> the thumbnail animates; click -> a detail sheet with a larger preview, "apa yang
   dipelajari" (2-3 bullets), and two actions: "Coba di Simulator" (loads it AND immediately runs it
   in the sim panel so the child sees the result before committing) and "Pakai Template".
 - Search box + tag filter; keyboard navigable; Esc closes; focus trap.
 - Robotku DS: white surface, 20px radius cards, indigo #4F46E5 primary, Templates gold #CA8A04
   accents, Plus Jakarta Sans, mascot illustration in the empty state.

BUILT-IN TEMPLATES — src/templates/builtin/*.ts, typed as:
   { id, name, description, collection, tags, requires?, difficulty, learn: string[],
     thumbnail: string /* inline animated SVG */, workspace: object }
 Gerak Dasar
  1. hello_robot   — "Halo Robot": maju 1 s, tampilkan senyum di matrix, bunyi C4.
  2. square_path   — "Jalan Kotak": repeat 4 [maju 1 s, belok kanan 1 s] — hasilnya kotak di trail.
  3. dance         — "Menari": repeat 4 [kiri, kanan, tone, matrix ganti] dengan BPM.
 Sensor
  4. avoid_obstacle— "Hindari Rintangan": forever [if ultrasonic < 20 -> mundur + belok, else maju].
  5. line_follow   — "Ikuti Garis": dua analog G1/G2 -> steering.
  6. button_race   — "Balapan Tombol": tekan Button 1 mulai, Button 2 berhenti, catat jarak.
 AI Kamera (butuh PROMPT E)
  7. stop_go       — "Stop & Go": telapak terbuka = maju, kepalan = berhenti, matrix centang/silang.
  8. balloon_chase — "Kejar Balon": bounding box center X -> belok kiri/kanan, width -> berhenti.
  9. balloon_pop   — "Pecahkan Balon": chase + capit + tone saat dekat.
 10. rps_referee   — "Wasit Suit": model rps, tampilkan pemenang di LCD.
 11. smile_light   — "Senyum = Lampu": model face_mood -> LED hijau/merah.
 Seni & Suara
 12. matrix_anim   — "Animasi Matrix": repeat dengan 6 pola berurutan.
 13. song          — "Lagu Sederhana": deret Play Tone (beat) dengan Set BPM.
 Tantangan
 14. counter_game  — "Hitung Mundur": pakai variabel + repeat + display text (mengajarkan Variables).
 15. patrol_func   — "Patroli": pakai Functions (Define "Putar", panggil 4x) — mengajarkan Functions.

AUTHORING FLOW (so these are real, not hand-typed JSON)
 - Dev-only: `?devtemplate=1` shows "Copy workspace JSON" in the toolbar
   (Blockly.serialization.workspaces.save -> clipboard). Build each template in the editor, paste
   into its .ts file. Document in src/templates/README.md.
 - CI guard: a vitest case loads every built-in template into a headless workspace, generates the
   program, runs it in SimSink for 3 simulated seconds, and asserts (a) zero unknown block types,
   (b) at least one state change. A template that does not do anything must fail the build.

INSERTION (the part that usually breaks)
 - Deep-clone the JSON and regenerate every block id with Blockly.utils.idGenerator.genUid() before
   loading — otherwise inserting the same template twice collides.
 - Empty canvas (only the immovable program_start) -> load directly. Otherwise ask:
   Ganti / Tambahkan di samping / Batal. "Tambahkan" places the stack to the right of the current
   content bounding box.
 - Wrap in Blockly.Events.setGroup(true/false): ONE Ctrl+Z undoes an entire template.
 - After insert: scroll to and flash the new stack (2x300 ms gold outline), do NOT call cleanUp().
 - Templates whose `requires` include 'kamera' while the AI blocks are unregistered: card stays
   visible but shows a "butuh AI" chip and the action becomes "Aktifkan AI dulu".

FLYOUT (secondary) — src/categories/templates.ts
 - Register a custom category callback 'TEMPLATES_FLYOUT' via
   workspace.registerToolboxCategoryCallback (set the category to { custom: 'TEMPLATES_FLYOUT' }).
 - Contents: a "Buka Galeri Template" button block, the existing templates_comment block, then
   "Template Saya" entries. Do not try to render the full gallery inside a Blockly flyout.

TEMPLATE SAYA (user templates)
 - "Simpan blok terpilih sebagai template": takes the selected block + everything below it.
 - Persist under a new `templates` key in src/app/persistence.ts using the existing safeGet/safeSet
   pattern (loadUserTemplates / persistUserTemplates), never throwing when storage is blocked.
 - Rename + delete from the gallery card's overflow menu, with an undo toast.

ACCEPTANCE
 1. Gallery opens in < 200 ms with 15 animated thumbnails; search "balon" finds 2.
 2. "Coba di Simulator" on Jalan Kotak: the trail draws a visible square.
 3. Insert twice -> no duplicate-id console warnings; Ctrl+Z removes a whole template each time.
 4. Every built-in template passes the CI "does something" test.
 5. Save selection -> reload -> still in Template Saya.
```

---

# PROMPT E — Kategori AI + panel Computer Vision (kamera beneran)

```
ROLE
Implement the AI category and the Computer Vision panel. Today src/categories/ai.ts has two stub
blocks (ai_object_detected always returns false, ai_capture_frame emits a dead AI_CAPTURE) and the
AI toolbar button in BlockCoding.tsx is hard-disabled. Replace both. Inference runs in the BROWSER
(the camera is on the laptop/tablet, not on the ESP32).

NON-NEGOTIABLE ARCHITECTURE
AI reporters resolve through the SAME sandbox path as sensor reporters — see
src/categories/sensors.ts::reporter(): the generator emits
`getSensorValue(JSON.stringify({command:'GET_AI_DATA', params:{...}}))` and the sink answers it
synchronously from the latest cached inference. No second evaluation mechanism, no model on the robot.
Because inference lives in the browser, a program containing AI blocks is HOST-EXECUTED: ProgramRunner
evaluates conditions locally and streams only primitive motion commands to the board. Detect that at
Run time and log it ONCE in the monitor: "Program AI dijalankan dari browser; robot menerima perintah
gerak saja."

FILES
 1. src/ai/types.ts
    CvClassResult {label, score 0..1}; CvBox {label, score, x, y, w, h}  // normalised, x/y = CENTER
    CvFrameResult {at, classes[], boxes[]}
    CvEngine {id, name, kind:'classification'|'detection', labels[], load(), infer(source), dispose()}
 2. src/ai/registry.ts — the catalogue, grouped exactly like the reference UI:
    Classification: stop_go "Stop Go (Open Palm & Close Fist)" [open_palm, closed_fist];
                    face_mood "Smiling vs Frowning Face"; rps "Scissors Paper Stone";
                    red_car "Red Car Detector"
    Detection:      coco "Generic Object Detection (COCO)"; balloon "Balloon Detector";
                    balloon_esp32 "Balloon Detector (ESP32Cam)"
    Each: {id, name, kind, group, labels, modelUrl:'/models/<id>/', engine:'tm'|'cocossd'|'graph'|'mediapipe'}.
    A missing model folder marks the entry `unavailable` (greyed out + tooltip), never throws.
 3. src/ai/engines/* — one adapter per backend, ALL lazily imported (`await import(...)`) so nothing
    lands in the main bundle: TeachableMachineEngine (@teachablemachine/image + tfjs),
    CocoSsdEngine (@tensorflow-models/coco-ssd), GraphDetectorEngine (tfjs graph model, letterbox +
    NMS) for balloon, MediapipeGestureEngine (@mediapipe/tasks-vision GestureRecognizer) used as the
    default for stop_go when no trained folder exists — open palm / closed fist work out of the box.
 4. src/ai/cvStore.ts — singleton: camera + inference loop + external store.
    - startCamera(deviceId?) via getUserMedia({video:{width:640,height:480}}); enumerateDevices for a
      camera picker; NotAllowedError/NotFoundError -> calm inline state, no alert, no console spam.
    - ESP32-Cam source: poll an MJPEG/JPEG URL (default http://192.168.4.1:81/stream, editable) into
      an offscreen canvas; identical downstream contract.
    - Inference throttled to ~10 fps (rAF + timestamp gate); paused on document.hidden and when the
      panel closes; exponential smoothing alpha 0.6 on scores so one bad frame cannot jerk the robot.
    - API: getConfidence(label):0..100, getBox(label):CvBox|null, isDetected(label,threshold):boolean,
      getObjectCount(label):number, getTopLabel(), setModel(id), setThreshold(n), start(), stop(),
      subscribe(cb), getState().
    - Every getter returns a safe default (0/null/false) when the camera is off, so an AI program
      still runs — the robot simply never sees anything.
 5. src/components/blockcoding/CvPanel.tsx — the panel from the reference photo. Draggable card,
    Robotku DS, AI pink #EC2D8F:
    - Header "Computer Vision", Webcam / ESP32-Cam segmented toggle, close X.
    - "Select CV Model" dropdown grouped Classification Models / Detection Models.
    - Live mirrored preview + overlay canvas drawing detection boxes and labels.
    - Confidence bars per label ("Open Palm (Go) ---- 40%", "Close Fist (Stop) ---- 60%"), winner
      emphasised, animating smoothly.
    - Threshold slider (default 60%) used by AI boolean blocks.
    - Footer: "Train custom models here" link (Teachable Machine, new tab) + "Muat model dari URL"
      which registers a custom entry at runtime.
    - Pre-permission empty state exactly like the reference ("Enter learning element. Check
      permissions and try again."), plus a one-line privacy note: frames never leave the device.

BLOCKS — rewrite src/categories/ai.ts (style ai_blocks, defineOnce, keep the pink category)
  Statements: ai_camera_on "AI: nyalakan kamera [on|off]" -> AI_CAMERA
              ai_use_model "AI: pakai model [dropdown registry]" -> AI_SET_MODEL
              ai_wait_until_seen "AI: tunggu sampai [label] terlihat" -> WAIT_UNTIL with the reporter
  Reporters (Number 0..100 so kids compare with plain numbers):
              ai_confidence "% keyakinan [label]"
              ai_bbox "Bounding Box [Center X|Center Y|Width|Height] dari [label]"
              ai_object_count "jumlah [label] terlihat"
  Boolean:    ai_detected "[label] terdeteksi?"
  The [label] field is a DYNAMIC dropdown listing the current model's labels plus "apa saja"; it must
  degrade to a text input when no model is loaded, and must not crash when the model changes while a
  block already references an old label.
  Delete ai_object_detected / ai_capture_frame, and migrate old workspaces: on load, map
  ai_object_detected -> ai_detected (keep the LABEL text) so saved projects do not break.

RUNTIME WIRING
 - SimSink + TransportSink: in getSensorValue(), add ONE branch for command 'GET_AI_DATA' delegating
   to cvStore (confidence -> 0..100, bbox -> 0..100 of frame, detected -> 1|0, count -> n).
 - exec(): handle AI_CAMERA and AI_SET_MODEL by calling cvStore.
 - SimStage: when a detection model is live, draw the detected box as a target marker inside the
   arena (position from bbox center X) so "kejar balon" is understandable offline; when a
   classification model is live, show the winning label as a chip above the robot.

BLOCKCODING.TSX
 - Enable the AI toolbar button (remove `disabled`): toggles CvPanel, turns pink with a live dot when
   the camera is on.
 - Stop every MediaStream track on panel close and on unmount — a forgotten track leaves the webcam
   LED on, and parents notice.

DEPENDENCIES (lazy-loaded only): @tensorflow/tfjs, @tensorflow-models/coco-ssd,
@teachablemachine/image, @mediapipe/tasks-vision

CONSTRAINTS
 - Client-only modules; CvPanel imported via next/dynamic({ssr:false}) like BlockCoding.
 - getUserMedia needs a secure context: on plain http over a LAN IP, show an inline hint to use
   https or localhost instead of failing silently.
 - No frame is stored or uploaded, ever.
 - `npm run typecheck` clean; the main bundle must not grow by more than ~30 KB (verify with
   `next build` output) because every model lib is dynamically imported.

ACCEPTANCE
 1. AI button -> panel -> allow camera -> "Stop Go" -> open palm pushes that bar above 80%.
 2. forever [ if % keyakinan open_palm > 60 -> Forward 0.5 s ; else if closed_fist > 60 -> Stop All ]
    starts/stops the 2D robot with your hand; same program with a board connected moves the real one.
 3. "Balloon Detector": boxes render, and Bounding Box Center X reads ~50 centred, <30 left, >70 right.
 4. Close the panel -> webcam LED off, CPU idle, a running program keeps going with AI values at 0.
 5. Missing /models folder -> stop_go still works via MediaPipe; other entries greyed out, no crash.
 6. Open a project saved with the old ai_object_detected block -> loads as ai_detected, no error.
```

---

## Cara pakai

- **Satu prompt per sesi Claude Code**, lampirkan repo, minta diff per file + cara verifikasi. Jangan gabung A dengan C — A mengubah kontrak param, C yang membuktikannya.
- **Prompt A wajib pertama.** Selama `BlockCoding.tsx` belum meng-import `src/runtime/*`, semua pekerjaan simulator berikutnya tidak akan kelihatan sama sekali di layar — persis yang kamu alami sekarang.
- **Prompt C adalah jawaban untuk "harus dites satu-satu"**: 62 blok jadi 62 test, plus guard yang otomatis gagal kalau ada blok di toolbox yang belum punya test. Itu lebih andal daripada mengklik satu-satu tiap kali ada perubahan.
- **Keputusan yang perlu kamu setujui sebelum A dijalankan:** fungsi ber-nilai-kembali (`procedures_defreturn`) saya sarankan disembunyikan, bukan dipaksakan — memaksanya jalan di sandbox sinkron akan bikin blok bergerak di dalam fungsi tidak bisa ditunggu. Kalau kamu mau tetap ada, bilang, nanti pendekatannya beda (perlu interpreter ekspresi async, jauh lebih besar).
- **AI tetap host-executed.** Robot tidak otonom selama laptop tidak terhubung. Kalau target akhirnya balon dikejar tanpa laptop, itu jalur ESP32-Cam + TFLite Micro/ESP-DL — prompt tersendiri, dan model balon harus dikuantisasi ke int8 dulu.