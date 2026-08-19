// src/components/blockcoding/BlockCoding.tsx
//
// The Robotku Block Coding editor — a thin React wrapper around the EXISTING
// astroid-webview Blockly boot (we reuse core.ts / toolbox.ts / theme.ts /
// simulator + the {"command":...} generator; we do NOT rewrite Blockly).
//
// This module imports `blockly` and three.js, both of which touch document/window
// at import time, so the page must load it via next/dynamic({ ssr: false }).

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import {
  ContinuousCategory,
  ContinuousToolbox,
  ContinuousFlyout,
  ContinuousMetrics,
} from '@blockly/continuous-toolbox';

import { initializeAstroidEditor } from '../../core';
import { getAstroidToolbox } from '../../toolbox';
import { getRobotkuTheme } from '../../visual/theme';
import { runCommandsOnRobot, setSimulatorRunner } from '../../command_runner';
import { estop, onTelemetry } from '../../app/connection';
import { Simulator } from '../../simulator';
import { SimulatorSequencer } from '../../simulator_sequencer';
import { useConnection } from '../../hooks/useConnection';
import { takePendingWorkspace } from '../../app/editorBridge';
import { loadProjects, persistProjects, type RbkProject } from '../../app/persistence';
import { showToast } from '../../ui/toast';
import styles from './BlockCoding.module.css';

const INITIAL_WORKSPACE_JSON = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'program_start',
        id: 'start_block',
        x: 200,
        y: 100,
        deletable: false,
        movable: false,
        next: { block: { type: 'motor_stop' } },
      },
    ],
  },
};

export default function BlockCoding() {
  const { connState, robotInfo } = useConnection();
  const connected = connState === 'connected';

  const blocklyDivRef = useRef<HTMLDivElement | null>(null);
  const simDivRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const simulatorRef = useRef<Simulator | null>(null);
  const sequencerRef = useRef<SimulatorSequencer | null>(null);

  const [running, setRunning] = useState(false);
  const [showMonitor, setShowMonitor] = useState(false);
  const [showSim, setShowSim] = useState(true);
  const [telemetry, setTelemetry] = useState<string[]>([]);

  // ---- Boot the editor + simulator once, on mount (client only) ----
  useEffect(() => {
    const blocklyDiv = blocklyDivRef.current;
    if (!blocklyDiv) return;

    initializeAstroidEditor();

    // Custom category renderer (from astroid-webview). Overwrite=true keeps
    // React Strict Mode's double-mount from throwing on re-registration.
    Blockly.registry.register(
      Blockly.registry.Type.TOOLBOX_ITEM,
      Blockly.ToolboxCategory.registrationName,
      ContinuousCategory,
      true,
    );

    const workspace = Blockly.inject(blocklyDiv, {
      theme: getRobotkuTheme(),
      toolbox: getAstroidToolbox(),
      renderer: 'zelos',
      toolboxPosition: 'start',
      // The continuous (Scratch-style) scrolling flyout. Without these three
      // plugins Blockly falls back to the classic vertical toolbox, which is
      // what made this page look "berantakan" vs. the astroid editor.
      plugins: {
        toolbox: ContinuousToolbox,
        flyout: ContinuousFlyout,
        metricsManager: ContinuousMetrics,
      },
      trashcan: false,
      zoom: { controls: false, wheel: true, startScale: 0.6, maxScale: 1.25, minScale: 0.4, scaleSpeed: 1.05 },
      grid: { spacing: 22, length: 2, colour: '#C6CAFF', snap: true },
      move: { scrollbars: true, drag: true, wheel: true },
    });
    workspaceRef.current = workspace;
    // Load a project handed over from the Projects page, else the starter program.
    const pending = takePendingWorkspace();
    Blockly.serialization.workspaces.load(
      (pending as object) ?? INITIAL_WORKSPACE_JSON,
      workspace,
    );

    // Per-category light flyout tint (matches the astroid-webview behaviour).
    workspace.addChangeListener((event: Blockly.Events.Abstract) => {
      if (event.type !== Blockly.Events.TOOLBOX_ITEM_SELECT) return;
      const name = (event as any).newItem as string;
      const bg: Record<string, string> = {
        Motion: 'rgba(238,244,255,.92)', Parts: 'rgba(232,250,250,.92)',
        Looks: 'rgba(244,240,255,.92)', Sound: 'rgba(253,240,248,.92)',
        Control: 'rgba(238,240,255,.92)', Operators: 'rgba(235,250,240,.92)',
        Sensors: 'rgba(244,240,255,.92)',
      };
      document.documentElement.style.setProperty(
        '--flyout-bg-color', bg[name] || 'rgba(255,255,255,.92)',
      );
    });

    // Offline 3D simulator so Run always does something when disconnected.
    let simulator: Simulator | null = null;
    let sequencer: SimulatorSequencer | null = null;
    if (simDivRef.current) {
      simulator = new Simulator(simDivRef.current);
      simulator.loadRobotModel('Asteria-DashMinimal.glb').catch(() => {});
      sequencer = new SimulatorSequencer(simulator);
      simulator.sequencerVirtualPosition = sequencer.virtualPosition;
      simulatorRef.current = simulator;
      sequencerRef.current = sequencer;
    }

    setSimulatorRunner((commands: any[]) => {
      setRunning(true);
      sequencer
        ?.runCommandSequence(commands)
        .finally(() => setRunning(false));
    });

    onTelemetry((msg) => {
      setTelemetry((prev) => [
        ...prev.slice(-200),
        typeof msg === 'string' ? msg : JSON.stringify(msg),
      ]);
    });

    const onResize = () => Blockly.svgResize(workspace);
    window.addEventListener('resize', onResize);
    // Blockly needs a resize once its container has real dimensions.
    const raf = requestAnimationFrame(onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
      setSimulatorRunner(null);
      onTelemetry(() => {});
      workspace.dispose();
      workspaceRef.current = null;
      simulator?.dispose();
      simulatorRef.current = null;
      sequencerRef.current = null;
    };
  }, []);

  // ---- Generate {"command":...} program from the workspace ----
  const generateCode = useCallback((): string => {
    const workspace = workspaceRef.current;
    if (!workspace) return '[]';
    javascriptGenerator.init(workspace);
    const start = workspace.getTopBlocks(true).find((b) => b.type === 'program_start');
    const first = start?.getNextBlock();
    if (!first) return '[]';
    const code = javascriptGenerator.blockToCode(first) as string;
    const commands = code.split(';').filter((c) => c.trim() !== '').map((c) => JSON.parse(c));
    return JSON.stringify(commands);
  }, []);

  const handleRun = useCallback(() => {
    const json = generateCode();
    if (connected) setRunning(true); // simulator path toggles this itself
    runCommandsOnRobot(json);
  }, [connected, generateCode]);

  const handleStop = useCallback(() => {
    void estop();
    sequencerRef.current?.stopSequence();
    setRunning(false);
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
  }, []);

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
  }, []);

  const handleShare = useCallback(async () => {
    const json = generateCode();
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      /* clipboard may be blocked — ignore */
    }
  }, [generateCode]);

  return (
    <div className={styles.wrap}>
      <div className={styles.editor}>
        <div ref={blocklyDivRef} className={styles.blockly} />

        {!connected && (
          <div className={styles.hint}>
            Belum tersambung — <b>Run</b> akan jalan di simulator. Klik Connect
            untuk mengendalikan robot asli.
          </div>
        )}

        {/* Right action toolbar */}
        <div className={styles.toolbar}>
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
          <div className={styles.tbDiv} />
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
          <button className={styles.tbBtn} onClick={() => {}} title="AI (segera hadir)" disabled>
            <SparkIcon /> <span>AI</span>
          </button>
        </div>

        {/* 3D simulator card */}
        <div className={`${styles.simCard} ${showSim ? '' : styles.simHidden}`}>
          <div className={styles.simHead}>
            <span>{connected ? `Robot · ${robotInfo?.board ?? ''}` : 'Simulator'}</span>
            <button className={styles.simToggle} onClick={() => setShowSim((v) => !v)}>
              {showSim ? '–' : '+'}
            </button>
          </div>
          <div ref={simDivRef} className={styles.simCanvas} />
        </div>

        {/* Serial monitor */}
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

/* ---- icons ---- */
function PlayIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>; }
function StopIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>; }
function SaveIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v6h7V3M8 21v-6h8v6" /></svg>; }
function ShareIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></svg>; }
function DownloadIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>; }
function MonitorIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>; }
function SparkIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>; }
