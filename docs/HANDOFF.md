# Handoff — changes that touch files the other agent owns

I (the R1/R2-slice/R3/R6 agent) must not edit `useBlocklyWorkspace.ts`,
`BlockCoding.tsx`, or its split-out presenter/hook files. The items below are ready
on my side but need a small edit in those files to wire in — please apply when you
touch them.

## 1. Use the extracted command-label map (R2 target 1)

`BlockCoding.tsx` has an inline `commandLabel()` + 30-entry map. I moved a typed
version to **`src/blockcoding/commandLabels.ts`** (`commandLabel(command: string)`,
keyed against the real `Opcode` union). Please:

```ts
import { commandLabel } from '../../blockcoding/commandLabels';
```

…and delete the inline `commandLabel` function + its map from `BlockCoding.tsx`.

## 2. Typed runtime commands are available (R2 target 3)

`src/domain/protocol.ts` now exports `RUNTIME_OPCODES`, `Opcode`, `CommandParams`
and `RuntimeCommand`. `src/runtime/*` and `src/blockcoding/*` are now `any`-free and
use these types. If `BlockCoding.tsx` still types `commands: any[]` /
`cmd?.params?._bid as string`, switch to `RuntimeCommand[]` — `parseCommandSegments`
/ `generateProgram` already return `RuntimeCommand[]`.

## 3. Already applied by me before the coordination rule (FYI, no action)

These edits to `BlockCoding.tsx` landed earlier and are intentional — don't revert:

- three.js lazy-load inside the `use3D` effect (`import type` + `await import`) +
  `sim3DLoading` "Menyiapkan 3D…" state (R1 STEP 2).
- `closeSharedAudio()` in the unmount cleanup (R3 #7, module-singleton AudioContext).

## 4. R3 #1 — Blockly listener cleanup on unmount (I did NOT touch this)

`useBlocklyWorkspace.ts` adds a `workspace.addChangeListener(...)` (toolbox tint) and
sets `--flyout-bg-color`; on unmount it disposes the workspace but does not remove
that listener or clear the custom property. Worth adding for the leak audit:

- keep the return of `addChangeListener` and `removeChangeListener` it on cleanup;
- `document.documentElement.style.removeProperty('--flyout-bg-color')`;
- assert `document.querySelectorAll('.blocklyWidgetDiv').length` stays 1 across 20
  mount/unmount cycles.
