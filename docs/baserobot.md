# Robotku — Prompt Fitur "Base Robot" (simulasi gerak mengikuti tombol)

Menyempurnakan mode **Base Robot** versi kita agar: ada **ilustrasi robot 2D** yang **ikut bergerak sesuai tombol** (klik/hold kiri → belok kiri, kanan → belok kanan, atas → maju, bawah → mundur, Grab/Release → animasi capit), **seukuran & sejelas referensi**. Perintah hardware yang sudah ada TIDAK diubah — simulasi hanya lapisan visual di atasnya.

> Wajib: terapkan `PROMPT_Robotku_DesignSystem_Reference.md` (Plus Jakarta Sans, token `--rk-*`/DS). File yang disentuh sudah ada di repo — **jangan bikin ulang dari nol**:
>
> - `src/components/modes/BaseMode.tsx` (D-pad + Grab/Release, pakai `useDrive` → `driveGroup/stopGroup/setGripper`; keybind W/A/S/D + panah + Q/E).
> - `src/components/modes/HoldButton.tsx` (press-and-hold: `onStart`/`onStop` saat ditekan/dilepas, `activeClassName`).
> - `src/styles/ModeControls.module.css` (`.wrap`, `.dpad` grid 3×3 76px, `.ctrlBtn`, `.armRow`).
> - `src/components/control/ControlLayout.tsx` (chrome: judul, badge, Connect, fullscreen, dock).
>   Saat ini BaseMode BELUM punya ilustrasi robot (hanya label "BASE") dan BELUM ada animasi.

---

## PROMPT (salin ke Claude Code)

```
GOAL
Upgrade the Base Robot mode (src/components/modes/BaseMode.tsx) to include a 2D robot illustration that VISUALLY SIMULATES motion in response to the controls, matching the reference screenshot's size and clarity. Keep sending the real transport commands (driveGroup/stopGroup/setGripper via useDrive) unchanged — the animation is an overlay that runs whether or not a device is connected.

DO NOT rebuild from scratch. Edit the existing files: BaseMode.tsx, HoldButton.tsx (reuse as-is), ModeControls.module.css, ControlLayout.tsx (only if needed for sizing). Use the DS tokens (--rk-*, Plus Jakarta Sans).

LAYOUT & SIZE (match the reference exactly)
- Screen: title "Base Robot" (large, ~34px/800), red "NO DEVICE CONNECTED" pill floating top-center (no bar), Connect (bottom-right, green when connected), Fullscreen (bottom-left) — already provided by ControlLayout; keep.
- Body: a horizontal cluster — ROBOT STAGE on the left-center, CONTROL PAD on the right (like the reference). On narrow screens, stack (robot above controls).
- ROBOT STAGE: a fixed-size stage (~clamp(240px, 30vw, 360px) wide, 1:1-ish) containing the robot illustration centered. The robot illustration itself ~ min(320px, 26vw) wide — the SAME visual size as the reference (do not shrink it; it must be clearly visible).
- CONTROL PAD = a 3×3 grid (like reference), buttons ~110px squares, gap ~16px, radius --r-lg, background --rk-surface-3, white icons ~40px, box-shadow --rk-shadow, press state scale(0.96) + lighten:
    row1: [Grab]   [▲ Up]   [Release]
    row2: [◀ Left] (empty)  [▶ Right]
    row3: (empty)  [▼ Down] (empty)
  Grab/Release buttons: a hand/claw icon (large) with a small label ("Grab"/"Release") ABOVE the icon, exactly like the reference. Arrows are big solid triangles.
- Keep keybinds: W/↑ forward, S/↓ backward, A/← left, D/→ right, Q grab, E release (HoldButton already binds these).

ROBOT ILLUSTRATION (2D, top-down, animatable)
- Add src/assets/base-robot.svg (or an inline SVG component) — a top-down view of the Robotku kit: a central board/battery body, two side WHEELS (left & right), and a front GRIPPER/claw. Give animatable groups with ids: #wheelL, #wheelR (with spoke lines so spinning is visible), #gripperL, #gripperR (claw arms). Style with DS-adjacent colors (grey chassis, indigo/pink accents). Keep it clean and readable at the size above. (If a nicer kit illustration asset exists, use it, but it MUST expose wheels + gripper groups to animate.)

MOTION SIMULATION (the core request — image follows the pressed button)
- Maintain a pose for the robot: { x, y, heading } (px, px, degrees) and a motion intent { fwd: -1|0|1, turn: -1|0|1 }.
- Wire intent to the SAME HoldButton onStart/onStop that already drive the robot:
    Up:    onStart → motion.fwd=+1 (and forward() transport); onStop → motion.fwd=0 (and stopWheels()).
    Down:  onStart → motion.fwd=-1 (and backward());          onStop → motion.fwd=0.
    Left:  onStart → motion.turn=-1 (and turnLeft());          onStop → motion.turn=0.
    Right: onStart → motion.turn=+1 (and turnRight());         onStop → motion.turn=0.
  (Keep the existing transport calls; just also set the motion intent.)
- Run one requestAnimationFrame loop (mounted once) that integrates motion into pose:
    heading += turn * 90 * dt;                 // 90°/sec turn rate
    const r = heading * Math.PI/180;
    x += Math.sin(r) * fwd * 150 * dt;         // 150 px/sec along heading
    y -= Math.cos(r) * fwd * 150 * dt;
    // clamp inside the stage so it never flies off:
    x = clamp(x, -stageHalfW*0.55, stageHalfW*0.55);
    y = clamp(y, -stageHalfH*0.55, stageHalfH*0.55);
    robotEl.style.transform = `translate(${x}px, ${y}px) rotate(${heading}deg)`;
  So: holding Up drives forward along the robot's current heading; Left/Right rotate the heading (turn in place); Down reverses. The illustration genuinely moves and turns, following the buttons. Pose persists between presses (it roams the stage, clamped), giving a real "driving" feel.
- WHEELS: while fwd !== 0, add a class that CSS-animates #wheelL/#wheelR spinning (direction = sign of fwd); when turning in place, spin wheels opposite directions (left back / right fwd for a left turn) for realism. Stop spinning when idle.
- GRIPPER (Grab/Release):
    Grab (Q):    onStart → setGripper(false)+driveGroup(arms,+); animate #gripperL/#gripperR CLOSING (rotate/translate inward) and hold closed.
    Release (E): onStart → setGripper(true)+driveGroup(arms,-); animate gripper OPENING.
  Use a small state (gripperOpen boolean) + CSS transition on the gripper groups.
- Motion runs regardless of connection (visual feedback even with NO DEVICE). Use rAF + transform (GPU-friendly); dispose the rAF on unmount. Respect prefers-reduced-motion (reduce/stop animation but still show state).

CLARITY / SIZING CHECKLIST (must match reference)
- Robot illustration is LARGE and centered (not tiny). Buttons are LARGE (~110px) with big icons and readable labels. Title large. Nothing cramped.
- Everything uses DS tokens & Plus Jakarta Sans; the control-screen background stays the immersive Robotku surface (don't turn it white).

ACCEPTANCE
- Pressing/holding ▲ moves the robot forward along its heading with wheels spinning; ▼ reverses; ◀/▶ rotate the robot in place; Grab/Release animate the claw. Releasing stops motion (pose stays where it is, clamped in-stage).
- Keyboard W/A/S/D + arrows + Q/E drive the same animation.
- Real transport commands still fire (works with hardware); with no device, the simulation still animates.
- Robot image and controls match the reference size/clarity; layout is robot-left / controls-right (stacked on mobile). No console errors; rAF cleaned up on unmount.

Show diffs for BaseMode.tsx, ModeControls.module.css, and the new base-robot.svg (or SVG component). Keep HoldButton and useDrive as the integration points.
```

---

## Catatan

- Simulasi ini **kinematik sederhana** (heading + posisi, di-clamp dalam stage) — cukup untuk “gambar mengikuti gerak tombol” tanpa perlu WebGL/3D (jadi tidak kena masalah WebGL context yang kemarin).
- Perintah asli (`driveGroup/stopGroup/setGripper`) tetap jalan, jadi begitu robot tersambung, **animasi & robot fisik bergerak bareng**.
- Kalau kamu mau ilustrasi robotnya benar-benar mirip kit Robotku (bukan SVG generik), kirim gambar/aset robot top-down-nya; nanti saya bisa bikinkan SVG-nya dengan grup `#wheelL/#wheelR/#gripper` yang siap dianimasikan.
