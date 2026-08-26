// src/components/blockcoding/BlockCoding.tsx
//
// The Robotku Block Coding editor — modular React wrapper around Blockly.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import * as Blockly from 'blockly';
import { generateProgramJson } from '../../blockcoding/generateProgram';
import { cvStore } from '../../ai/cvStore';
import { estop } from '../../app/connection';
import { getState } from '../../app/store';
// three.js is a ~600 KB dependency used ONLY by the opt-in 3D beta (default OFF),
// so Simulator/SimulatorSequencer are imported lazily inside the use3D effect and
// kept as type-only imports here to stay off the editor's critical path.
import type { Simulator } from '../../simulator';
import type { SimulatorSequencer } from '../../simulator_sequencer';
import SimStage from './SimStage';
import { ProgramRunner, type RobotSink } from '../../runtime/ProgramRunner';
import { SimSink } from '../../runtime/SimSink';
import { TransportSink } from '../../runtime/TransportSink';
import { FanOutSink } from '../../runtime/FanOutSink';
import { useConnection } from '../../hooks/useConnection';
import {
  loadProjects,
  persistProjects,
  loadUserTemplates,
  persistUserTemplates,
  type RbkProject,
} from '../../app/persistence';
import { showToast } from '../../ui/toast';
import { useBlocklyWorkspace } from './hooks/useBlocklyWorkspace';
import { ErrorBoundary } from '../common/ErrorBoundary';
import TemplateGallery from './TemplateGallery';
import { insertTemplate } from '../../templates/insert';
import { setGalleryOpener } from '../../templates/galleryBridge';
import styles from './BlockCoding.module.css';

// Client-only: the CV panel pulls in camera + (lazily) ML libs.
const CvPanel = dynamic(() => import('./CvPanel'), { ssr: false });

export default function BlockCodingWrapper() {
  return (
    <ErrorBoundary fallbackTitle="Kendala pada Editor Blockly">
      <BlockCodingInner />
    </ErrorBoundary>
  );
}

function BlockCodingInner() {
  const { connState, robotInfo } = useConnection();
  const connected = connState === 'connected';

  const blocklyDivRef = useRef<HTMLDivElement | null>(null);
  const simDivRef = useRef<HTMLDivElement | null>(null);
  const { workspaceRef, telemetry, setTelemetry, showToolbox, toggleToolbox } = useBlocklyWorkspace(blocklyDivRef);

  const simulatorRef = useRef<Simulator | null>(null);
  const sequencerRef = useRef<SimulatorSequencer | null>(null);

  const simSinkRef = useRef<SimSink | null>(null);
  if (!simSinkRef.current) simSinkRef.current = new SimSink();
  const runnerRef = useRef<ProgramRunner | null>(null);
  if (!runnerRef.current) runnerRef.current = new ProgramRunner(simSinkRef.current);
  const runningBlockIdRef = useRef<string | null>(null);

  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [scope, setScope] = useState<Record<string, unknown>>({});
  const [showMonitor, setShowMonitor] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showCvPanel, setShowCvPanel] = useState(false);
  const aiNoticeShownRef = useRef(false);
  const [showSim, setShowSim] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [use3D, setUse3D] = useState(false);
  const [simError, setSimError] = useState(false);
  const [sim3DLoading, setSim3DLoading] = useState(false);
  const [reduced, setReduced] = useState(false);

  const attachRunner = useCallback((runner: ProgramRunner) => {
    runner.onStep = (_pc, cmd) => {
      simSinkRef.current?.setStatus(cmd ? commandLabel(cmd.command) : null);
      const ws = workspaceRef.current;
      if (!ws) return;
      const prev = runningBlockIdRef.current;
      if (prev) ws.getBlockById(prev)?.getSvgRoot()?.classList.remove('blocklyRunningBlock');
      const bid = cmd?.params?._bid as string | undefined;
      if (bid) {
        ws.getBlockById(bid)?.getSvgRoot()?.classList.add('blocklyRunningBlock');
        runningBlockIdRef.current = bid;
      } else {
        runningBlockIdRef.current = null;
      }
    };
    runner.onScopeChange = (s) => setScope({ ...s });
    runner.onStatus = ({ loopIteration }) => simSinkRef.current?.setLoopIteration(loopIteration);
  }, [workspaceRef]);

  const pickSink = useCallback((): RobotSink => {
    const transport = getState().transport;
    if (connected && transport) {
      const t = new TransportSink(transport);
      return showSim && !use3D ? new FanOutSink([t, simSinkRef.current!]) : t;
    }
    return simSinkRef.current!;
  }, [connected, showSim, use3D]);

  // Prefers reduced motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Let the Templates flyout button open the gallery.
  useEffect(() => {
    setGalleryOpener(() => setShowGallery(true));
    return () => setGalleryOpener(null);
  }, []);

  // Camera on? (drives the AI button's live dot). Stop the camera on unmount so a
  // forgotten MediaStream can never leave the webcam LED on.
  const cameraOn = useSyncExternalStore(
    cvStore.subscribe,
    () => cvStore.isOn(),
    () => false,
  );
  useEffect(() => () => cvStore.stop(), []);

  // Lazy 3D Simulator (opt-in). three.js (~600 KB) is dynamically imported HERE so
  // it never ships to a child who just uses the 2D sim (the default).
  useEffect(() => {
    if (!showSim || !use3D) return;
    const container = simDivRef.current;
    if (!container || simulatorRef.current) return;

    let simulator: Simulator | null = null;
    let cancelled = false;
    setSim3DLoading(true);

    (async () => {
      const [{ Simulator }, { SimulatorSequencer }] = await Promise.all([
        import('../../simulator'),
        import('../../simulator_sequencer'),
      ]);
      if (cancelled || !simDivRef.current) return;

      try {
        simulator = new Simulator(container);
      } catch {
        setSimError(true);
        setSim3DLoading(false);
        return;
      }
      if (simulator.initFailed) {
        setSimError(true);
        setSim3DLoading(false);
        simulator.dispose();
        return;
      }
      setSimError(false);
      setSim3DLoading(false);
      simulator.onContextLost = () => setSimError(true);
      simulator.loadRobotModel('/Asteria-DashMinimal.glb').catch(() => {});

      const sequencer = new SimulatorSequencer(simulator);
      simulator.sequencerVirtualPosition = sequencer.virtualPosition;
      simulatorRef.current = simulator;
      sequencerRef.current = sequencer;
    })();

    return () => {
      cancelled = true;
      simulator?.dispose();
      simulatorRef.current = null;
      sequencerRef.current = null;
    };
  }, [showSim, use3D]);

  // Unsaved work guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const ws = workspaceRef.current;
      if (ws && ws.getAllBlocks(false).length > 1) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [workspaceRef]);

  const generateCode = useCallback((): string => {
    const workspace = workspaceRef.current;
    if (!workspace) return '[]';
    return generateProgramJson(workspace);
  }, [workspaceRef]);

  const handleRun = useCallback(() => {
    const json = generateCode();
    let commands: any[] = [];
    try { commands = JSON.parse(json); } catch { commands = []; }

    // AI programs are host-executed (inference in the browser); the board only
    // ever receives motion. Say so ONCE in the monitor so it's not a mystery.
    const usesAi = json.includes('GET_AI_DATA') || json.includes('AI_CAMERA') || json.includes('AI_SET_MODEL');
    if (usesAi && !aiNoticeShownRef.current) {
      aiNoticeShownRef.current = true;
      setShowMonitor(true);
      setTelemetry((prev) => [...prev.slice(-200), 'ℹ️ Program AI dijalankan dari browser; robot menerima perintah gerak saja.']);
    }

    if (use3D && showSim && sequencerRef.current) {
      setRunning(true);
      sequencerRef.current.runCommandSequence(commands).finally(() => setRunning(false));
      return;
    }

    if (runnerRef.current?.isRunning) runnerRef.current.stop();

    const runner = new ProgramRunner(pickSink());
    attachRunner(runner);
    runner.setSpeed(speed);
    simSinkRef.current?.setSpeed(speed);
    runnerRef.current = runner;
    setPaused(false);
    setRunning(true);
    simSinkRef.current?.setRunning(true);
    runner.run(commands).finally(() => {
      if (runnerRef.current === runner) {
        setRunning(false);
        setPaused(false);
        simSinkRef.current?.setRunning(false);
        simSinkRef.current?.setStatus(null);
      }
    });
  }, [generateCode, showSim, use3D, pickSink, attachRunner, speed]);

  const handleStop = useCallback(() => {
    void estop();
    runnerRef.current?.stop();
    simSinkRef.current?.stopAll();
    simSinkRef.current?.setRunning(false);
    simSinkRef.current?.setStatus(null);
    sequencerRef.current?.stopSequence();
    setRunning(false);
    setPaused(false);
  }, []);

  const handleSpeed = useCallback((mult: number) => {
    setSpeed(mult);
    runnerRef.current?.setSpeed(mult);
    simSinkRef.current?.setSpeed(mult);
  }, []);

  const handlePauseToggle = useCallback(() => {
    const runner = runnerRef.current;
    if (!runner?.isRunning) return;
    if (runner.isPaused) {
      runner.resume();
      setPaused(false);
    } else {
      runner.pause();
      setPaused(true);
    }
  }, []);

  const handleStepOne = useCallback(() => {
    const runner = runnerRef.current;
    if (!runner) return;
    if (!runner.isPaused) {
      runner.pause();
      setPaused(true);
    }
    runner.step();
  }, []);

  const handleReset = useCallback(() => {
    runnerRef.current?.stop();
    simSinkRef.current?.reset();
    setRunning(false);
    setPaused(false);
    setScope({});
  }, []);

  const handleDownload = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const json = Blockly.serialization.workspaces.save(workspace);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'program.rbk';
    a.click();
    URL.revokeObjectURL(url);
  }, [workspaceRef]);

  const handleSave = useCallback(async () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const name = window.prompt('Nama project:', 'Program Robotku');
    if (!name) return;
    const project: RbkProject = {
      id: `p_${Date.now()}`,
      name: name.trim(),
      workspace: Blockly.serialization.workspaces.save(workspace),
      savedAt: Date.now(),
    };
    const list = await loadProjects();
    await persistProjects([project, ...list]);
    showToast(`Tersimpan: ${project.name}`, 'success');
  }, [workspaceRef]);

  const handleShare = useCallback(async () => {
    const json = generateCode();
    try {
      await navigator.clipboard.writeText(json);
      showToast('Program disalin ke clipboard!', 'info');
    } catch {
      /* ignore */
    }
  }, [generateCode]);

  // --- Templates ---------------------------------------------------------
  const handleUseTemplate = useCallback((workspaceJson: object, name: string) => {
    const ws = workspaceRef.current;
    if (!ws) return;
    let mode: 'replace' | 'append' = 'replace';
    if (ws.getAllBlocks(false).length > 1) {
      const replace = window.confirm(
        `Muat "${name}"?\n\nOK = Ganti program yang ada\nBatal = Tambahkan di samping`,
      );
      mode = replace ? 'replace' : 'append';
    }
    insertTemplate(ws, workspaceJson, mode);
    showToast(`Template dimuat: ${name}`, 'success');
  }, [workspaceRef]);

  const handleTryTemplate = useCallback((workspaceJson: object) => {
    const ws = workspaceRef.current;
    if (!ws) return;
    insertTemplate(ws, workspaceJson, 'replace');
    setShowSim(true);
    setTimeout(() => handleRun(), 80);
  }, [workspaceRef, handleRun]);

  const handleSaveTemplate = useCallback(async () => {
    const ws = workspaceRef.current;
    if (!ws) return;
    const selected =
      (Blockly as any).getSelected?.() ?? (Blockly as any).common?.getSelected?.();
    if (!selected || selected.type === 'program_start') {
      showToast('Pilih satu blok dulu untuk disimpan sebagai template', 'info');
      return;
    }
    const name = window.prompt('Nama template:', 'Template Saya');
    if (!name) return;
    const savedBlock = Blockly.serialization.blocks.save(selected, { addNextBlocks: true });
    const full = Blockly.serialization.workspaces.save(ws) as { variables?: unknown[] };
    const workspace = {
      blocks: { languageVersion: 0, blocks: [savedBlock] },
      variables: full.variables ?? [],
    };
    const list = await loadUserTemplates();
    await persistUserTemplates([
      { id: `t_${Date.now()}`, name: name.trim(), savedAt: Date.now(), workspace },
      ...list,
    ]);
    showToast(`Tersimpan di Template Saya: ${name}`, 'success');
  }, [workspaceRef]);

  return (
    <div className={styles.wrap}>
      <div className={styles.editor}>
        <div ref={blocklyDivRef} className={styles.blockly} />

        <div className={styles.toolbar}>
          <button
            className={`${styles.tbBtn} ${showToolbox ? styles.tbActive : ''}`}
            onClick={toggleToolbox}
            title={showToolbox ? 'Tutup Sidebar Blok' : 'Buka Sidebar Blok'}
          >
            <SidebarIcon /> <span>Sidebar</span>
          </button>
          <button className={`${styles.tbBtn} ${styles.run}`} onClick={handleRun} title="Run">
            <PlayIcon /> <span>Run</span>
          </button>
          <button
            className={`${styles.tbBtn} ${styles.stop}`}
            onClick={handleStop}
            disabled={!running && !connected}
            title="Stop (failsafe)"
          >
            <StopIcon /> <span>Stop</span>
          </button>
          <button
            className={`${styles.tbBtn} ${showSim ? styles.tbActive : ''}`}
            onClick={() => setShowSim((v) => !v)}
            title={showSim ? 'Tutup Simulator' : 'Buka Simulator'}
          >
            <SimIcon /> <span>Simulator</span>
          </button>
          <button
            className={`${styles.tbBtn} ${showCvPanel || cameraOn ? styles.tbActive : ''}`}
            onClick={() => setShowCvPanel((v) => !v)}
            title="Computer Vision (kamera AI)"
          >
            <AiIcon /> <span>AI</span>
            {cameraOn && <span className={styles.tbLiveDot} />}
          </button>
          <button
            className={`${styles.tbBtn} ${showGallery ? styles.tbActive : ''}`}
            onClick={() => setShowGallery(true)}
            title="Galeri Template"
          >
            <TemplatesIcon /> <span>Templates</span>
          </button>
          <button className={styles.tbBtn} onClick={handleSaveTemplate} title="Simpan blok terpilih sebagai template">
            <SaveTemplateIcon /> <span>+ Template</span>
          </button>
          <button className={styles.tbBtn} onClick={handleSave} title="Simpan ke Projects">
            <SaveIcon /> <span>Save</span>
          </button>
          <button className={styles.tbBtn} onClick={handleShare} title="Share (copy JSON)">
            <ShareIcon /> <span>Share</span>
          </button>
          <button className={styles.tbBtn} onClick={handleDownload} title="Download .rbk">
            <DownloadIcon /> <span>Download</span>
          </button>
          <button
            className={`${styles.tbBtn} ${showMonitor ? styles.tbActive : ''}`}
            onClick={() => setShowMonitor((v) => !v)}
            title="Serial Monitor"
          >
            <MonitorIcon /> <span>Monitor</span>
          </button>
        </div>

        <div className={`${styles.simCard} ${showSim ? '' : styles.simHidden}`}>
          <div className={styles.simHead}>
            <span>{connected ? `Robot · ${robotInfo?.board ?? ''}` : 'Simulator'}</span>
            <div className={styles.simHeadActions}>
              {showSim && (
                <label className={styles.simSwitch} title="Simulator 3D (beta, memakai WebGL)">
                  <input type="checkbox" checked={use3D} onChange={(e) => setUse3D(e.target.checked)} />
                  <span>3D (beta)</span>
                </label>
              )}
              <button
                className={styles.simToggle}
                onClick={() => setShowSim((v) => !v)}
                title={showSim ? 'Tutup simulator' : 'Buka simulator'}
              >
                {showSim ? '–' : '+'}
              </button>
            </div>
          </div>
          {showSim &&
            (use3D ? (
              simError ? (
                <div className={styles.simError}>
                  Simulator 3D tidak tersedia (WebGL). Program tetap berjalan di 2D.
                </div>
              ) : (
                <>
                  <div ref={simDivRef} className={styles.simCanvas} />
                  {sim3DLoading && <div className={styles.simError}>Menyiapkan 3D…</div>}
                </>
              )
            ) : (
              <SimStage
                sink={simSinkRef.current!}
                reduced={reduced}
                running={running}
                paused={paused}
                speed={speed}
                scope={scope}
                onSpeed={handleSpeed}
                onPauseToggle={handlePauseToggle}
                onStepOne={handleStepOne}
                onReset={handleReset}
              />
            ))}
        </div>

        <TemplateGallery
          open={showGallery}
          onClose={() => setShowGallery(false)}
          onUse={handleUseTemplate}
          onTry={handleTryTemplate}
          aiEnabled
        />

        <CvPanel open={showCvPanel} onClose={() => setShowCvPanel(false)} />

        {showMonitor && (
          <div className={styles.monitor}>
            <div className={styles.monitorHead}>
              <span>Serial Monitor</span>
              <button onClick={() => setTelemetry([])}>Clear</button>
            </div>
            <div className={styles.monitorBody}>
              {telemetry.length === 0 ? (
                <div className={styles.monitorEmpty}>Menunggu telemetry…</div>
              ) : (
                telemetry.map((line, i) => <div key={i}>{line}</div>)
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function commandLabel(command: string): string {
  const map: Record<string, string> = {
    MOVE_TIMED: 'Gerak', TURN_TIMED: 'Belok', STEER_TIMED: 'Setir', CLAW_TIMED: 'Capit',
    STOP: 'Berhenti', STOP_ALL: 'Berhenti Semua', WAIT: 'Tunggu', WAIT_UNTIL: 'Tunggu sampai',
    DISPLAY_MATRIX: 'LED Matrix', DISPLAY_TEXT: 'Teks LED', SET_LED_BRIGHTNESS: 'Kecerahan',
    CLEAR_MATRIX: 'Hapus Matrix', LCD_SHAPE: 'Bentuk LCD', LCD_TEXT: 'Teks LCD', LCD_CLEAR: 'Hapus LCD',
    SET_LED_COLOR: 'Warna LED', DISPLAY_ICON: 'Ikon', PLAY_TONE: 'Nada', PLAY_SOUND_EFFECT: 'Efek Suara',
    PLAY_INTERNAL_SOUND: 'Suara', RECORD_AUDIO: 'Rekam', PLAY_RECORDING: 'Putar Rekaman',
    SET_VOLUME: 'Volume', SET_BPM: 'BPM', STOP_SOUNDS: 'Stop Suara', SET_ANALOG: 'Set Analog',
    SET_DIGITAL: 'Set Digital', RESET_DISTANCE: 'Reset Jarak', RESET_HEADING: 'Reset Arah',
    SET_HEAD_POSITION: 'Kepala', SET_GRIPPER: 'Capit', META_SET_VAR: 'Set Variabel', META_CALL: 'Panggil Fungsi',
  };
  return map[command] ?? command;
}

function SidebarIcon() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></svg>; }
function PlayIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>; }
function StopIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>; }
function SaveIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v6h7V3M8 21v-6h8v6" /></svg>; }
function ShareIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></svg>; }
function DownloadIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>; }
function MonitorIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>; }
function SimIcon() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /><path d="M7 9l3 3-3 3M13 15h4" /></svg>; }
function TemplatesIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>; }
function SaveTemplateIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 8v8M8 12h8" /></svg>; }
function AiIcon() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="12" cy="12" r="3.2" /><path d="M8 5l1.5-2h5L16 5" /></svg>; }
