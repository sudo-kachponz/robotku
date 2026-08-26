# AI — Computer Vision (PROMPT E)

Browser-side inference for the Block Coding editor. The camera is on the
laptop/tablet, **not** on the robot, so a program that uses AI blocks is
**host-executed**: `ProgramRunner` evaluates conditions locally and streams only
motion commands to the board.

## Data flow

```
ai_detected / ai_confidence / ai_bbox / ai_object_count   (blocks, src/categories/ai.ts)
        │  generator emits getSensorValue('{"command":"GET_AI_DATA",...}')
        ▼
ProgramRunner  ── getSensorValue(json) ──▶  SimSink / TransportSink
        │                                        │  GET_AI_DATA branch
        ▼                                        ▼
                                          cvStore.getAiValue(params)
```

`ai_camera_on` / `ai_use_model` stream `AI_CAMERA` / `AI_SET_MODEL`, which the
sinks intercept and forward to `cvStore` (never to the board).

## Pieces

- `types.ts` — dependency-free CV contract (`CvBox` is normalised, x/y = center).
- `registry.ts` — the model catalogue + `probeAvailability` (greys out missing
  folders, never throws).
- `engines/*` — one adapter per backend, **all lazily `await import(...)`-ed** so
  TensorFlow.js / MediaPipe never touch the main bundle. Factory: `engines/index.ts`.
- `cvStore.ts` — singleton: camera (webcam + ESP32-Cam), throttled ~10 fps loop,
  0.6 exponential smoothing, and the getters the blocks resolve through. Every
  getter returns a safe default (0 / null / false) when the camera is off.
- `../components/blockcoding/CvPanel.tsx` — the panel (imported `ssr:false`).

## Adding a model

Add a `CvModelEntry` to `CV_MODELS` and drop its files under
`public/models/<id>/` (see that folder's README). `stop_go` (MediaPipe) and
`coco` (COCO-SSD) ship their own weights and need no folder.
