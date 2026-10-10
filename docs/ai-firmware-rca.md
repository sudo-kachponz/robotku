# AI firmware — root-cause analysis (BLE drop + servo regression)

The AI/TTS firmware work (2.2.1→2.2.6-mk) introduced two regressions vs the stable
2.2.0-mk. All source is in git history — nothing was lost. This maps each version to
its symptom + suspected cause so the RCA can be done by bisecting real commits.

**Status:** `main` HEAD firmware is now **2.2.7-mk** — the **fix candidate** (BUG A +
BUG B fixed, keeps TTS). The **published web flasher is still 2.2.0-mk** (known-stable,
no TTS) until 2.2.7 is verified on hardware via LOCAL flash. So: build `main` locally
to **test the fix**; the stable fallback remains 2.2.0 (`8cdbb32`) on the flasher.

## Version → commit → symptom
| Ver | Commit | Date (WIB) | Change | Result |
|-----|--------|-----------|--------|--------|
| 2.2.0-mk | `8cdbb32` | 2026-10-02 12:29 | servo L=14, no blip, no TTS | **STABLE** (user "Kamis 1 siang") |
| 2.2.1-mk | `69e1d2b` | 2026-10-02 22:26 | `PIN_SERVO_L` 14→33 (schematic guess) | **BUG A**: only servo port 2 moves |
| 2.2.2-mk | `6fd0359` | 2026-10-02 23:20 | + speaker self-test blip on BLE connect | **BUG B** starts: BLE connect→drop (brownout) |
| 2.2.3-mk | `a2641a4` | 2026-10-02 23:30 | blip amplitude 3000→18000 | BUG B worse (louder blip = bigger current spike) |
| 2.2.4-mk | `d5626fd` | 2026-10-02 23:59 | + TTS over BLE: 32 KB static buffer, `TTS_*` handlers, 3 HELLO caps | BUG B persists |
| 2.2.5-mk | `d8ec605` | 2026-10-03 01:22 | removed connect blip, playback `<<7` | BUG B **still** present |
| 2.2.6-mk | `d4222c6` | 2026-10-03 01:44 | lazy-alloc the 32 KB buffer (RAM back to 2.2.0 level) | BUG B **still** present |

## Two independent bugs

### BUG A — only servo port 2 moves
- **Cause (high confidence):** `69e1d2b` changed `PIN_SERVO_L` 14→33 in `pins_makerkit.h` based on a schematic reading. On the real board GPIO33 does not drive the left drive servo; GPIO14 did. 2.2.0 (L=14) drives both.
- **Fix:** `PIN_SERVO_L = 14`. Already correct in the published 2.2.0-mk.
- **Isolation test:** build `8cdbb32` but set only `PIN_SERVO_L=33` → if left servo dies, confirmed.

### BUG B — BLE "connect sebentar terus putus"
- First appeared at 2.2.2 (connect speaker-blip → current spike → brownout → reset → reconnect loop). That explains 2.2.2/2.2.3.
- **But it persists in 2.2.5 (blip removed) and 2.2.6 (buffer lazy-alloc'd, RAM identical to 2.2.0).** So for 2.2.5/2.2.6 the cause is **neither the blip nor the 32 KB buffer**.
- **Remaining connect-time delta vs stable 2.2.0** (everything else is command-/playback-only):
  1. **3 extra opcodes in the HELLO_ACK caps array** (`caps.add("TTS_BEGIN"/"TTS_CHUNK"/"TTS_END")`) → larger HELLO_ACK, more MTU-chunked notifies right at connect. **Prime suspect.**
  2. `#include "mbedtls/base64.h"` → flash size only, unlikely.
- **Caveat:** several of Fajrisya's failing flashes were via the **web flasher, which was itself unreliable** (FTPS stalls / possible corrupt writes). Some "drops" may be bad flashes, not firmware. RCA must use **local flash** to rule that out.

## RCA bisect plan (local flash only)
1. Baseline: build + local-flash `8cdbb32` (2.2.0). Confirm stable (idle 3 min, both servos). This is the control.
2. BUG A: `8cdbb32` + only `PIN_SERVO_L=33` → confirm left servo dies.
3. BUG B: `8cdbb32` + only the 3 `caps.add("TTS_*")` lines (no buffer, no handlers, no blip) → flash → connect, idle 3 min. If it drops → HELLO caps confirmed; fix by gating the web on `fwVersion` instead of advertising extra caps (so HELLO stays 2.2.0-sized).
4. If step 3 is stable, add back pieces one at a time (handlers → lazy buffer) until it drops.

Build any version in isolation:
```
git worktree add /tmp/rca-<ver> <commit>
cd /tmp/rca-<ver>/firmware/robotku-esp32 && pio run -e makerkit
# flash .pio/build/makerkit via pio run -t upload (local, not web)
```

## Fix applied — 2.2.7-mk (needs hardware verification via LOCAL flash)
Per the deep analysis (`~/Downloads/ai-firmware-rca-deep.md`), both bugs fixed on the
2.2.6 TTS base, builds clean for `-e v3` AND `-e makerkit`:
- **BUG A:** `PIN_SERVO_L` restored 33→**14** (+ aux 26→33) in `pins_makerkit.h` — the
  proven 2.2.0 pins; both drive servos move.
- **BUG B (notify storm):** `HELLO_ACK` no longer built/sent in the `onWrite` host-task.
  `HELLO` now just sets `helloPending`; `loop()` calls the new `sendHelloAck()` once the
  MTU is negotiated (>23) — ~3 notifies instead of ~32. Plus `sendTelemetry` now paces
  (`delay(2)`) between chunks so the mbuf pool drains (notify() is `void` in NimBLE 1.4.x,
  so pacing — not a return check — is the lever). `helloPending` reset on disconnect.
- **Verify (local flash, not web):** connect + idle 3 min, 10× connect/disconnect with no
  drop; HELLO_ACK arrives whole (ends `;`), caps include `TTS_*`; both servos move. If
  stable, publish 2.2.7 to the flasher; if not, fall back to 2.2.0 and re-bisect.

## Related
- Deep analysis (mechanism + WiFi plan + prompts): `~/Downloads/ai-firmware-rca-deep.md`
- Feature architecture + file map: `docs/ai-robot-voice.md`
- Web TTS gate that makes older firmware safe: `src/ailabs/robotVoice.ts` (`robotCanSpeak`)
