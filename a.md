ROLE
Fix five specific defects in the Robotku Block Coding module. Do not add features. Show diffs per file. After each fix, state how to verify.

FIX 1 — Category icons (currently just colored dots; must be real icons like the reference)
- Install lucide-react. In the sidebar category list, render an icon per category (stroke = category color, size ~26, strokeWidth 2.5), label in category color, large Plus Jakarta Sans.
- Icon map (lucide-react names):
  Movement → LifeBuoy (steering-wheel look; or use the inline steering-wheel SVG below)
  Timing → Clock
  Display → Lightbulb
  Audio → Volume2
  Sensors & Data → Ruler
  Program Flow → Network
  Logic → Shuffle
  Math → Calculator
  Variables → Variable
  Functions → SquareFunction   (fallback: FunctionSquare)
  Templates → ClipboardList
  AI → BrainCircuit
- Optional steering-wheel SVG for Movement (if you prefer a true wheel):
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.4"/><path d="M12 5v4.6M4.2 16l4-2.3M19.8 16l-4-2.3"/></svg>
- Selected category row = filled pill in the category color with white icon+label; unselected = transparent with colored icon+label.

FIX 2 — WebGL "context limit reached" (the recurring THREE error) — THIS IS THE MAIN BUG
Root cause: Simulator creates a WebGLRenderer with no teardown; React StrictMode/HMR re-mounts leak contexts.
Do ALL of the following:
(a) Add Simulator.dispose() and call it on unmount:
    dispose() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.controls?.dispose?.();
      this.scene?.traverse((o:any) => {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
        for (const m of mats) { for (const k in m) { const v:any=(m as any)[k]; if (v?.isTexture) v.dispose(); } m.dispose?.(); }
      });
      this.renderer?.dispose?.();
      this.renderer?.forceContextLoss?.();
      this.renderer?.domElement?.remove();
      (this.renderer as any) = null;
    }
(b) In BlockCoding.tsx, create the Simulator once and dispose in cleanup; guard against double-init:
    const simRef = useRef<Simulator|null>(null);
    useEffect(() => {
      if (simRef.current) return;                       // guard StrictMode double-invoke
      try { simRef.current = new Simulator(containerRef.current!); }
      catch (e) { setSimError(true); console.warn('3D sim disabled:', e); }
      return () => { simRef.current?.dispose(); simRef.current = null; };
    }, []);
(c) Make renderer creation defensive: wrap `new THREE.WebGLRenderer({antialias:true})` in try/catch; on failure set a flag and DO NOT throw repeatedly. Add a context-loss listener that preventDefault and shows the fallback ONCE:
    this.renderer.domElement.addEventListener('webglcontextlost', (ev)=>{ ev.preventDefault(); this.onContextLost?.(); }, false);
(d) MAKE THE 3D SIMULATOR OPT-IN (lazy): do NOT auto-instantiate on page load. Only create it when the user opens a "Simulator" panel/toggle, and dispose it when the panel closes. Default state = simulator OFF (hardware/streaming is the primary path). This alone removes the context pressure.
(e) The fallback message ("3D Simulator unavailable…") must render at most once, calm, inside the panel — not spam the console or the UI. Running a program must still work (stream to transport / log) even when the simulator is off or failed.

FIX 3 — 404 assets
- Copy the astroid-webview `public/` assets into this app's `public/` (keep same relative paths): Cyberpunk.hdr, rubber_tiles_diff_2k.jpg, rubber_tiles_nor_gl_2k.jpg, rubber_tiles_rough_2k.jpg, rocks_ground_09_diff_2k.jpg, plastered_wall_05_diff_2k.jpg, the robot .glb, icons/*.png (happy/sad/confused/mad), sounds/*.mp3 (beep/siren/success/error), levels*.json.
- Also make ALL asset loaders tolerant: HDRLoader/TextureLoader/GLTFLoader/audio loads must have onError handlers that log a single warning and continue (no crash, no repeated 404 spam). Since the simulator is now opt-in (Fix 2d), these only load when the sim is actually opened.

FIX 4 — Blockly warnings
- Continuous toolbox: register the full plugin set and pass it to inject (this removes "Unable to find [category][flyoutinflater]"):
    import { ContinuousToolbox, ContinuousFlyout, ContinuousMetrics } from '@blockly/continuous-toolbox';
    primaryWorkspace = Blockly.inject(blocklyDiv, {
      ...workspaceConfig,
      plugins: {
        toolbox: ContinuousToolbox,
        flyoutsVerticalToolbox: ContinuousFlyout,
        metricsManager: ContinuousMetrics,
      },
    });
  (Port whatever registration exists in the original main.ts; ensure it runs in the React mount.)
- Idempotent block definitions (removes "controls_repeat_ext overwrites previous definition" and makes HMR-safe): before each defineBlocksWithJsonArray, filter out types already present:
    function defineOnce(defs:any[]) {
      const fresh = defs.filter(d => !Blockly.Blocks[d.type]);
      if (fresh.length) Blockly.defineBlocksWithJsonArray(fresh);
    }
  Replace direct defineBlocksWithJsonArray calls in categories/*.ts with defineOnce. Ensure category modules are imported exactly once (from a single index).
- Replace deprecated API: `workspace.getAllVariables()` → `workspace.getVariableMap().getAllVariables()`.

FIX 5 — Remove the "NO DEVICE CONNECTED" navbar band (the full-width bar is unwanted)
- Delete the full-width band/bar that wraps the badge under the header. Render the badge as a FLOATING pill: absolutely positioned, top-center over the canvas, transparent background, only the rounded red pill (dot + "NO DEVICE CONNECTED"); green pill "CONNECTED · <board>" when connected. No bar, no background strip — it should float like the reference. Ensure it doesn't overlap the toolbox/first blocks (small top offset, pointer-events none except the pill).

ACCEPTANCE
- Console clean: no WebGL "context limit" errors on repeated navigation/HMR; no flyoutinflater error; no block-overwrite warning; no getAllVariables deprecation; no asset 404s (or, if sim closed, no asset requests at all).
- Sidebar shows proper category icons (not dots), colored per category, large.
- 3D simulator is off by default; opening it creates exactly one context; closing/leaving disposes it; failure shows a single calm message and never blocks Run.
- "NO DEVICE CONNECTED" is a floating pill with no surrounding bar.
- Running a program still streams commands / simulates without needing the 3D sim.

Start by fixing Fix 2 (WebGL lifecycle + opt-in) and Fix 4 (toolbox registration) first — they cause the console spam — then 3, 1, 5. Show diffs.