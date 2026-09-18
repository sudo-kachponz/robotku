# Python Mode (ala MakeCode micro:bit) — Riset & Desain

Status: **Tahap 1 (riset + keputusan dialek + peta blok)** — menunggu review sebelum koding.
Acuan: `py.md` (spec task). Aturan arsitektur C1–C5 di spec bersifat mengikat.

---

## 1. Temuan riset (repo — sudah diverifikasi, bukan tebakan)

- Generator di repo **tidak** menghasilkan JavaScript. Tiap `javascriptGenerator.forBlock[type]`
  mengembalikan **potongan JSON command** diakhiri `;`, mis.
  `{"command":"MOVE_TIMED","params":{"direction":"forward","speed":70,"duration_ms":1000,"left":"P1","right":"P2","_bid":"..."}};`
- Control flow dikodekan **datar** sebagai opcode `META_*` (bukan indentasi):
  `META_START_LOOP/END_LOOP`, `META_START_INFINITE_LOOP`, `META_IF/ELSE_IF/ELSE/END_IF`,
  `META_BREAK_LOOP/CONTINUE_LOOP`, `META_SET_VAR`, `META_CALL`, `META_FUNC_DEF/FUNC_END`, `META_RETURN`.
- `ProgramRunner` mengeksekusi array datar itu dengan `pc + loopStack + ifStack`.
- Peta blok→opcode tunggal sudah ada: `src/blockcoding/blockOpcodes.ts` (`BLOCK_OPCODE`) +
  `unsupportedOpcodesInProgram()`; board guard `isSupported()` di `src/domain/boardProfile.ts`.
- `_bid` disuntik ke `params._bid` untuk highlight blok berjalan (via `stampBlockIdsIntoCommands` di `core.ts`).
- Reporter (blok output) mengeluarkan ekspresi `getSensorValue("{...GET_SENSOR_DATA...}")`, boolean dibungkus `(... === 1)`.
- **Belum ada apa pun soal Python/monaco/codemirror** di `src/` (dikonfirmasi).
- `servo_single` memancarkan **dua** command (SET_PORT nyala, lalu SET_PORT 0). Satu baris Python → 2 command.
- `audio_play_melody` mengembang jadi **N** command `PLAY_TONE`. Satu baris Python → banyak command.
- `display_matrix` masih terdefinisi tapi **tidak** ada di toolbox aktif (OLED, bukan matrix).

## 2. Referensi eksternal (perlu diverifikasi ulang saat implementasi drag-drop)

- **microbit-foundation/python-editor-v3** — pola drag snippet dari sidebar HTML ke editor teks +
  auto-indent (inti Bagian G). Editornya CodeMirror 6. Ini rujukan utama untuk drag-drop.
- **microsoft/pxt** & **pxt-microbit** — perilaku flyout, integrasi Monaco, snippet builder, docs per blok.
- **microbit-foundation/micropython-microbit-v2** — gaya penamaan API.
> Nama path repo bisa berubah; cek langsung sebelum meniru. Yang ditiru: **layout + perilaku**, bukan branding biru Microsoft. Warna/ikon/font tetap dari `src/visual/*` + `src/theme/tokens.css` (C4).

## 3. Keputusan editor teks: **CodeMirror 6** (bukan Monaco)

Alasan (akan dicatat di PR):
1. **Bundle jauh lebih kecil** (~200 KB vs Monaco ~2 MB+). Robotku disajikan sebagai static export
   di VPS 1 GB dan bandwidth adalah kendala nyata (lihat `deploy/VPS.md`). Monaco juga butuh web-worker +
   AMD loader yang merepotkan dengan `output: 'export'`.
2. **Drag-drop presisi**: CM6 `view.posAtCoords({x,y})` + `dispatch(changes)` cukup untuk insertion
   indicator, indentasi, dan **satu drop = satu undo** (transaksi tunggal). Placeholder antar-parameter
   via `@codemirror/autocomplete` snippet (`snippet()` + `Tab`).
3. **Bahasa custom** `robotku-python` via `@codemirror/language` (StreamLanguage) + autocomplete dari `apiMap`.
4. **Lazy-load** lewat `next/dynamic({ssr:false})` + import dinamis di dalam effect (pola three.js di
   `BlockCoding.tsx`) → bundle mode Blok tidak ikut membesar (DoD).

Dependensi baru: `@codemirror/state @codemirror/view @codemirror/language @codemirror/autocomplete @codemirror/commands @codemirror/lint`. (Perlu persetujuan — satu-satunya penambahan dependency.)

## 4. Keputusan dialek Python — **faithful & round-trippable**

Sketsa dialek di `py.md §D` bagus untuk rasa, tapi generator asli membawa params lebih kaya. Karena
**C1/C2 mewajibkan command hasil kompilasi identik byte-untuk-byte** dengan `generateProgram()`, dialek
final harus membawa cukup info agar `blocks→python→commands` == `blocks→commands`. Prinsip:

- **Keyword arguments dengan default = default field blok** → baris pendek untuk kasus umum, tetap lossless.
- **Enum tetap string** (`speed="medium"`, `direction="clockwise"`, `unit="cm"`) — compiler memetakan ke
  angka/opcode via `apiMap` (mis. `SPEED_ENUM`).
- **Nada tetap nama** (`"C4"`) bukan Hz, karena blok menyimpan nama nada.
- **Warna tetap hex** (`"#ff0000"`); compiler pecah ke `r,g,b` (deterministik dua arah).
- **Durasi** = argumen detik (float); compiler kalikan 1000 → `duration_ms`/`secs` sesuai opcode.
- Satu baris boleh → banyak command (`robot.servo`, `audio.melody`) — didokumentaslikan; parity test menjaga.

`src/pythongen/apiMap.ts` = **sumber tunggal**: `blockType ↔ pyFn ↔ opcode ↔ bentuk params ↔ docs`.
Dipakai oleh generator, compiler, autocomplete, dan docs. Test gagal bila ada type di `BLOCK_OPCODE`
tanpa baris `apiMap`.

---

## 5. Peta lengkap blok → Python → opcode (72 generator)

Notasi: `<sec>`/`<expr>` = slot ekspresi (boleh angka/variabel/reporter). Field enum → keyword arg.

### Movement — `src/categories/motors.ts`
| block | Python | opcode | params |
|---|---|---|---|
| move_forward | `robot.forward(<sec>, speed="medium")` | MOVE_TIMED | direction="forward", speed(enum→int), duration_ms, left="P1", right="P2" |
| move_reverse | `robot.reverse(<sec>, speed="medium")` | MOVE_TIMED | direction="backward", … |
| move_left | `robot.turn("left", <sec>, speed="medium")` | TURN_TIMED | direction="left", speed, duration_ms, left, right |
| move_right | `robot.turn("right", <sec>, speed="medium")` | TURN_TIMED | direction="right", … |
| move_steer | `robot.steer(<sec>, steering=0, speed="medium")` | STEER_TIMED | duration_ms, steering(int −100..100), speed, left, right |
| move_claw | `robot.claw(<sec>, speed="medium", direction="clockwise", port="P1")` | CLAW_TIMED | duration_ms, direction, speed, port |
| move_stop | `robot.stop(2)` | STOP | wheels(2/4), left, right |
| move_stop_all | `robot.stop_all()` | STOP_ALL | — |
| servo_single | `robot.servo("P1", 100, <sec>)` | SET_PORT ×2 | ⚠ 2 command: {port,value,duration_ms} lalu {port,value:0} |

### Timing — `src/categories/events.ts`
| block | Python | opcode | params |
|---|---|---|---|
| program_start | (akar program, tanpa baris) | — | hat block |
| timing_wait | `wait(<sec>)` | WAIT | duration_ms |
| timing_wait_until | `wait_until(<expr>)` | WAIT_UNTIL | condition |

### Program Flow — `src/categories/control.ts` (Python asli, compiler → META_*)
| block | Python | opcode saat compile |
|---|---|---|
| controls_repeat_ext | `for _ in range(<n>):` | META_START_LOOP{times} … META_END_LOOP |
| controls_forever | `while True:` | META_START_INFINITE_LOOP … META_END_LOOP |
| controls_while | `while <cond>:` | META_START_INFINITE_LOOP; META_IF{!(cond)}; META_BREAK_LOOP; META_END_IF; … META_END_LOOP |
| controls_if | `if <cond>: / elif / else:` | META_IF/ELSE_IF/ELSE/END_IF |
| controls_break | `break` | META_BREAK_LOOP |
| controls_continue | `continue` | META_CONTINUE_LOOP |

### Display — `src/categories/looks.ts`
| block | Python | opcode | params |
|---|---|---|---|
| display_matrix | `display.matrix("0110…", <sec>)` | DISPLAY_MATRIX | pattern(25 int), secs |
| display_text | `display.text("Hi")` | DISPLAY_TEXT | text |
| display_kaomoji | `display.face("(^_^)")` | DISPLAY_TEXT | text (=face) |
| display_set_brightness | `display.brightness(100)` | SET_LED_BRIGHTNESS | value |
| display_clear_matrix | `display.clear()` | CLEAR_MATRIX | — |
| set_led_color | `led.color("#ff0000", <sec>)` | SET_LED_COLOR | r,g,b (dari hex), secs |
| lcd_shape | `lcd.shape("heart", <sec>)` | LCD_SHAPE | shape(enum), secs |
| lcd_text | `lcd.text("Hi", <sec>)` | LCD_TEXT | text, secs |
| lcd_clear | `lcd.clear()` | LCD_CLEAR | — |

### Audio — `src/categories/audio.ts`
| block | Python | opcode | params |
|---|---|---|---|
| audio_record | `audio.record(slot=1, sec=<sec>, wait=True)` | RECORD_AUDIO | slot, secs, wait |
| audio_play_recording | `audio.play_recording(slot=1, wait=True)` | PLAY_RECORDING | slot, wait |
| audio_sound_effect | `audio.sound_effect("short_beep", wait=True)` | PLAY_SOUND_EFFECT | effect, wait |
| audio_play_tone_sec | `audio.tone("C4", <sec>, wait=True)` | PLAY_TONE | note, secs, wait |
| audio_play_tone_beat | `audio.tone_beat("C4", <beats>, wait=True)` | PLAY_TONE | note, beats, wait |
| audio_play_melody | `audio.melody("twinkle")` | PLAY_TONE ×N | ⚠ N command {note,duration_ms} |
| audio_set_volume | `audio.volume(80)` | SET_VOLUME | value |
| audio_stop_sounds | `audio.stop()` | STOP_SOUNDS | — |
| audio_set_bpm | `audio.bpm(120)` | SET_BPM | bpm |

### Sensors & Data — `src/categories/sensors.ts` (reporter = ekspresi)
| block | Python | opcode | params |
|---|---|---|---|
| sensor_button1 | `sensors.button1()` → bool | GET_SENSOR_DATA | sensor="button1" |
| sensor_button2 | `sensors.button2()` → bool | GET_SENSOR_DATA | sensor="button2" |
| sensor_is_recording | `sensors.is_recording()` → bool | GET_SENSOR_DATA | sensor="recording" |
| sensor_get_analog | `sensors.analog("P1")` | GET_SENSOR_DATA | sensor="analog", port |
| sensor_get_digital | `sensors.digital("P1")` | GET_SENSOR_DATA | sensor="digital", port |
| sensor_ultrasonic | `sensors.ultrasonic(port="P1", unit="cm")` | GET_SENSOR_DATA | sensor="ultrasonic", port, unit |
| sensor_temperature | `sensors.temperature(port="P1")` | GET_SENSOR_DATA | sensor="temperature", port |
| sensor_humidity | `sensors.humidity(port="P1")` | GET_SENSOR_DATA | sensor="humidity", port |
| sensor_light | `sensors.light(port="P1")` | GET_SENSOR_DATA | sensor="light", port |
| sensor_distance | `sensors.distance(port="P1")` | GET_SENSOR_DATA | sensor="distance", port |
| sensor_heading | `sensors.heading(port="P1")` | GET_SENSOR_DATA | sensor="heading", port |
| sensor_set_analog | `sensors.set_analog("P1", 128)` | SET_ANALOG | port, value(0..255) |
| sensor_set_digital | `sensors.set_digital("P1", "HIGH")` | SET_DIGITAL | port, value("HIGH"/"LOW") |
| sensor_reset_distance | `sensors.reset_distance("P1")` | RESET_DISTANCE | port |
| sensor_reset_heading | `sensors.reset_heading("P1")` | RESET_HEADING | port |
> ⚠ Semua reporter sensor membawa `port` (dan `unit` utk ultrasonic) di params — dialek Python HARUS
> menerima port agar round-trip. Default port = default field blok.

### Mechanisms — `src/categories/mechanisms.ts`
| block | Python | opcode | params |
|---|---|---|---|
| mechanism_set_head | `robot.head(pitch=90, yaw=90)` | SET_HEAD_POSITION | pitch, yaw (dua servo) |
| mechanism_set_gripper | `robot.gripper("open")` / `"closed"` | SET_GRIPPER | state ("open"/"closed") |

### Variables — `src/categories/variables.ts`
| block | Python | opcode | params |
|---|---|---|---|
| variables_set | `x = <expr>` | META_SET_VAR | name, value |
| variables_get | `x` | (ekspresi) | nama disanitasi `[^A-Za-z0-9_]→_` |
> ⚠ set memakai nama mentah, get disanitasi — compiler harus sanitasi konsisten dua arah.

### Functions — `src/categories/functions_gen.ts`
| block | Python | opcode |
|---|---|---|
| procedures_defnoreturn | `def name(args):` + body | META_FUNC_DEF … META_FUNC_END |
| procedures_callnoreturn | `name(arg0, …)` | META_CALL |
| procedures_ifreturn | `if <cond>:` `\n    return` (atau `return`) | META_IF; META_RETURN; META_END_IF |
> `procedures_defreturn`/`callreturn` (nilai balik) sengaja tidak digenerate — di luar cakupan.

### AI — `src/categories/ai.ts`
| block | Python | opcode | params |
|---|---|---|---|
| ai_use_model | `ai.use_model("<id>")` | AI_SET_MODEL | model |
| ai_camera_on | `camera.on()` / `camera.off()` | AI_CAMERA | on(bool) |
| ai_detected | `ai.detected("cat")` → bool | GET_AI_DATA | metric="detected", label |
| ai_confidence | `ai.confidence("cat")` | GET_AI_DATA | metric="confidence", label |
| ai_object_count | `ai.object_count("cat")` | GET_AI_DATA | metric="count", label |
| ai_bbox | `ai.bbox("cat", "x")` | GET_AI_DATA | metric="bbox", label, part(x/y/w/h) |
| ai_wait_until_seen | `ai.wait_until_seen("cat")` | WAIT_UNTIL | condition (=detected expr) |
| ai_object_detected | (legacy alias → `ai.detected(...)`) | GET_AI_DATA | hidden, load-only |
| ai_capture_frame | (legacy no-op) | — | hidden, load-only |
> `label="any"` → argumen boleh dikosongkan: `ai.detected()`.

### Templates — `src/categories/templates.ts`
| block | Python | opcode |
|---|---|---|
| templates_comment | `# <teks>` | — (no-op; Python comment) |

### Ditangani native oleh `pythonGenerator` bawaan Blockly (tanpa generator custom)
`logic_boolean`(True/False), `math_arithmetic`(+ − * / **), `math_modulo`(%), `math_constant`(math.pi…),
`math_single`(abs/math.sqrt…), `math_round`, `math_random_int`(random.randint), `text_join`.
⚠ `logic_compare/logic_operation/logic_negate/math_number/text` punya override JS di repo — untuk Python
kita **override ulang** ke operator Python (`== and or not`, literal) via `apiMap`, bukan pakai output JS.
`variables_*`/`procedures_*` juga standar Blockly tapi dioverride ke protokol `META_*` (jangan fallback native).

---

## 6. Arsitektur (mematuhi C1–C5)

```
Blocks ──pythonGenerator (apiMap)──▶ teks Python ──compile.ts──▶ RuntimeCommand[] ──ProgramRunner──▶ SimSink/Transport
   ▲                                     │
   └──────── compile→AST→build blocks ◀──┘  (toggle Python→Blok, dgn modal peringatan)
```

- **C1**: `compile.ts` menghasilkan `RuntimeCommand[]` identik dgn `generateProgram()`. Run/Stop/Pause/Step/
  Speed/telemetry tak disentuh. **Parity test**: untuk tiap program contoh,
  `blocks→commands` `deepEqual` `blocks→python→commands`.
- **C2**: opcode & params tidak berubah → `opcodeReconciliation.test.ts` tetap hijau.
- **C3**: board guard tetap: opcode tak didukung → problem (warning) via `unsupportedOpcodesInProgram()`,
  kartu flyout Python digreyed persis `guardItem()`.
- **C4**: warna/ikon/font dari `src/visual/*` + `tokens.css`, tanpa hex baru.
- **C5**: editor Blok tetap default; Python = tambahan.
- Highlight: command bawa `params._line` (nomor baris) di jalur Python; `onStep` di `BlockCoding.tsx`
  highlight baris bila `_line` ada, tetap highlight blok bila `_bid` ada (jalur lama tidak dihapus).

Struktur file baru:
```
src/pythongen/
  apiMap.ts        # sumber tunggal blockType↔pyFn↔opcode↔params↔docs
  index.ts         # pythonGenerator (basis blockly/python) + init
  <kategori>.ts    # forBlock per type (72)
  snippets.ts      # snippet flyout {id,category,label,py,docs}
  compile.ts       # tokenizer+parser indentasi → RuntimeCommand[]
  docs/*.md        # docs per blok (Indonesia)
src/components/blockcoding/python/
  PyEditor.tsx     # CodeMirror 6 (lazy), bahasa robotku-python, diagnostics
  PyFlyout.tsx     # flyout HTML: kategori + kartu + drag-drop ke editor
  ProblemsPanel.tsx
  DocsPanel.tsx
```

## 7. Rencana bertahap (tunjukkan hasil tiap tahap, tunggu review) — dari spec §M

1. **(dok ini)** riset + dialek + peta 72 blok ← **sekarang, minta review**
2. `apiMap.ts` + generator Python + parity `blocks→python`
3. `compile.ts` + parity `python→commands` (deep-equal jalur blok)
4. Panel editor read-only (Blok→Python live)
5. Flyout Python + klik-untuk-sisip
6. Drag & drop + insertion indicator
7. Problems panel
8. Docs panel
9. Toggle dua arah + modal peringatan
10. Persistensi (`RbkProject.mode/python`) + export `.py`

## 8. Pertanyaan untuk review (perlu jawaban sebelum Tahap 2)

1. **CodeMirror 6** disetujui (satu-satunya dependency baru), atau tetap ingin Monaco?
2. Dialek **faithful** (keyword args, port di semua sensor, nada nama, hex warna) disetujui? Ini demi
   round-trip lossless & parity test. (Sketsa `py.md §D` yang lebih ringkas tidak bisa round-trip penuh.)
3. Rekonsiliasi: pilot lama (`robot.forward(1, "medium")` positional, `robot.left(...)`) akan **diganti**
   ke dialek final ini (`speed="medium"`, `robot.turn("left", …)`). OK?
4. `servo_single` (2 command) & `audio_melody` (N command): baris Python tunggal → banyak command. Terima?
5. Highlight per-baris via `params._line` di samping `_bid` — OK?
