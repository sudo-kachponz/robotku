# Robotku — Prompt Fitur "Port Control" (layout board + 8 slider, label Anticlockwise/Neutral/Clockwise)

Mengubah tampilan mode **Port Control** agar sama seperti referensi: **ilustrasi board di kiri (besar)** + **8 slider horizontal ditumpuk vertikal di kanan** (nomor 1–8), dengan keterangan arah **Anticlockwise · Neutral · Clockwise** (kiri = anticlockwise, tengah = neutral, kanan = clockwise). Perintah `SET_PORT` yang sudah ada tidak diubah.

> Wajib: terapkan `PROMPT_Robotku_DesignSystem_Reference.md` (Plus Jakarta Sans, token `--rk-*`/DS). File yang disentuh sudah ada — **jangan bikin ulang**:
>
> - `src/components/modes/PortMode.tsx` (8 slider −100..100, `setPort` throttled ~20 Hz, Digit1–8 + SHIFT invert, spring ke 0 saat lepas).
> - `src/styles/ModeControls.module.css` (`.portGrid`, `.portItem`, `.portLabel`, `.portSlider`, `.portValue`).
> - `src/hooks/useDrive.ts` (`setPort`).
>   Saat ini layout-nya grid 4 kolom tanpa board dan tanpa label arah — ubah ke layout referensi di bawah.

---

## PROMPT (salin ke Claude Code)

```
GOAL
Rework the Port Control mode (src/components/modes/PortMode.tsx + ModeControls.module.css) to match the reference: a LARGE board illustration on the left and 8 full-width horizontal sliders stacked vertically on the right, each labeled 1–8, with direction labels "Anticlockwise · Neutral · Clockwise" (left = anticlockwise, center = neutral, right = clockwise). Keep the existing behavior (setPort throttled ~20 Hz, Digit1–8 keybinds, SHIFT to invert, spring back to Neutral/0 on release). DO NOT rebuild from scratch — edit the existing files. Use DS tokens (--rk-*, Plus Jakarta Sans).

LAYOUT & SIZE (match reference)
- Title "Port Control" large (~34px/800); red "NO DEVICE CONNECTED" pill floating top-center (from ControlLayout; keep). Immersive Robotku background (not white).
- Two-column body:
  * LEFT: board illustration, centered, ~clamp(320px, 34vw, 480px) wide — the SAME visual size as reference (clearly large, not tiny).
  * RIGHT: a vertical stack of 8 slider rows, width ~min(560px, 44vw).
- On narrow screens, stack (board on top, sliders below).

SLIDER ROWS (right column)
- One HEADER row above the 8 sliders, aligned to the slider track, showing three labels at LEFT / CENTER / RIGHT:
    "Anticlockwise"        "Neutral"        "Clockwise"
  (small caps, --rk-on-muted). Optionally add 3 tick marks under them (left, center, right).
- Each of the 8 rows: a BIG port NUMBER on the far left (1..8, ~22px/800, --rk-on), then a full-width horizontal slider.
  * Range min=-100 (Anticlockwise) … 0 (Neutral, center) … +100 (Clockwise).
  * Center DETENT: a subtle vertical tick at the middle of the track marking Neutral.
  * Track styling like the reference (rounded, filled toward the driven side). Prefer CENTER-OUT fill: from the center detent toward the thumb, colored by direction (e.g., indigo #4F46E5 for clockwise / pink #EC2D8F for anticlockwise), remaining track = light/gray; thumb = white circle with shadow. (If simpler, match the reference's left-fill look but keep the center tick + labels.)
  * On release (pointerup / keyup) the slider SNAPS back to 0 (Neutral) and sends setPort(port, 0) — continuous-rotation servo semantics. Keep the value readout (or omit if it clutters; reference has none).
- Keep keybinds: Digit1..8 drive that port to +100 (Clockwise), SHIFT+Digit = -100 (Anticlockwise); release → 0. Keep setPort throttled ~20 Hz on drag, forced send on release.

BOARD ILLUSTRATION (left)
- Add src/assets/port-board.svg (or inline SVG) resembling the Robotku kit board (top view): white rounded PCB, the ESP32/module area, the S / V / G port headers for ports 1–4 and 5–8 (yellow/red/black rows like reference), SW1–SW4 buttons, USB, and the "21" label. Keep it clean and readable at the size above.
- NICE TOUCH (optional but preferred): when a slider for port N is moved, HIGHLIGHT the matching S/V/G row on the board (glow/outline) so kids see which physical port they're driving. Add ids like #port-1..#port-8 in the SVG to target.

CLARITY CHECKLIST (match reference)
- Board is large and centered-left; sliders are long and clearly spaced; big port numbers; the three direction labels are visible. Nothing cramped. Everything uses DS tokens + Plus Jakarta Sans.

ACCEPTANCE
- Port Control shows board (left) + 8 vertical sliders (right) with Anticlockwise/Neutral/Clockwise labels; center = Neutral with a detent; dragging left drives anticlockwise, right drives clockwise; releasing snaps to Neutral and stops the port.
- setPort still fires (throttled) and Digit1..8 (+SHIFT) still work; with no device the UI still moves (visual). Optional: active port highlights on the board.
- Layout/size/clarity match the reference; immersive Robotku background; no console errors.

Show diffs for PortMode.tsx, ModeControls.module.css, and the new port-board.svg. Keep useDrive.setPort as the integration point.
```

---

## Catatan

- Semantik slider: **kiri = Anticlockwise (−100), tengah = Neutral (0), kanan = Clockwise (+100)**; lepas → balik ke Neutral (servo continuous). Ini sekaligus menjawab "paling kiri ada keterangan anti-clockwise, neutral, clockwise" — labelnya dipasang sebagai header sejajar posisi kiri/tengah/kanan track, plus detent di tengah.
- Fill **center-out** (dari tengah ke arah thumb) lebih jelas untuk arah putaran daripada fill kiri biasa; tapi kalau kamu mau persis referensi (fill biru dari kiri), tetap tambah tick Neutral + label.
- Kalau kamu mau board-nya benar-benar mirip PCB Robotku (bukan SVG generik), kirim foto/aset board top-view-nya — saya buatkan SVG-nya dengan id `#port-1..#port-8` yang siap di-highlight.
