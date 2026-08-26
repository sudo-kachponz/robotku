# Computer Vision models

Drop trained model folders here, one per registry id (see `src/ai/registry.ts`):

```
public/models/
  face_mood/    model.json  metadata.json   (Teachable Machine export)
  rps/          model.json  metadata.json
  red_car/      model.json  metadata.json
  balloon/      model.json  *.bin           (TF.js GraphModel)
  balloon_esp32/model.json  *.bin
```

Notes:

- `stop_go` uses **MediaPipe** and needs no folder — open palm / closed fist work
  out of the box.
- `coco` uses the bundled **COCO-SSD** weights — no folder needed.
- A missing folder isn't an error: the model is greyed out in the panel
  (`registry.probeAvailability` does a `HEAD` on `model.json`).

Train classification models at <https://teachablemachine.withgoogle.com/train/image>
and export as **TensorFlow.js**.
