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
  registerContinuousToolbox,
} from '@blockly/continuous-toolbox';class RobotkuCategory extends Blockly.ToolboxCategory {
  private iconEl_?: HTMLDivElement;

  override createDom_() {
    super.createDom_();
    if (this.rowDiv_) {
      this.rowDiv_.style.display = 'flex';
      this.rowDiv_.style.flexDirection = 'row';
      this.rowDiv_.style.alignItems = 'center';
      this.rowDiv_.style.justifyContent = 'flex-start';
      this.rowDiv_.style.height = 'auto';
      this.rowDiv_.style.minHeight = '64px';
      this.rowDiv_.style.padding = '14px 20px';
      this.rowDiv_.style.borderLeft = `8px solid ${this.colour_}`;
      this.rowDiv_.style.marginBottom = '8px';
      this.rowDiv_.style.borderRadius = '0';

      const contentContainer = this.rowDiv_.querySelector('.blocklyTreeRowContentContainer') as HTMLElement;
      if (contentContainer) {
        contentContainer.style.display = 'flex';
        contentContainer.style.flexDirection = 'row';
        contentContainer.style.alignItems = 'center';
        contentContainer.style.justifyContent = 'flex-start';
        contentContainer.style.width = '100%';
        contentContainer.style.gap = '14px';
      }
    }
    const labelDiv =
      (this as any).labelDiv_ ||
      (this.rowDiv_ ? (this.rowDiv_.querySelector('.blocklyTreeLabel, .blocklyToolboxCategoryLabel') as HTMLElement) : null);
    if (labelDiv) {
      labelDiv.style.color = this.colour_;
      labelDiv.style.fontSize = '30px';
      labelDiv.style.fontWeight = '800';
      labelDiv.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
      labelDiv.style.marginLeft = '0px';
      labelDiv.style.marginTop = '0px';
      labelDiv.style.marginBottom = '0px';
      labelDiv.style.textAlign = 'left';
      labelDiv.style.lineHeight = '1.2';
    }
    return this.rowDiv_ as HTMLDivElement;
  }

  override createIconDom_() {
    const icon = document.createElement('div');
    icon.classList.add('categoryBubble');
    icon.classList.add('blocklyTreeIcon');
    icon.style.display = 'flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.backgroundColor = 'transparent';
    icon.style.background = 'none';
    icon.style.border = 'none';
    icon.style.borderRadius = '0';
    icon.style.boxShadow = 'none';
    icon.style.width = '36px';
    icon.style.height = '36px';
    icon.style.margin = '0 14px 0 0';
    icon.style.flexShrink = '0';

    const svg = categoryIconSvg(((this as any).name_ as string) || '');
    if (svg) {
      icon.innerHTML = svg;
      icon.style.color = this.colour_;
    } else {
      icon.style.backgroundColor = this.colour_;
      icon.style.borderRadius = '50%';
    }
    this.iconEl_ = icon;
    return icon;
  }

  override setSelected(isSelected: boolean) {
    super.setSelected(isSelected);
    const labelDiv =
      (this as any).labelDiv_ ||
      (this.rowDiv_ ? (this.rowDiv_.querySelector('.blocklyTreeLabel, .blocklyToolboxCategoryLabel') as HTMLElement) : null);
    if (this.rowDiv_) {
      this.rowDiv_.style.backgroundColor = isSelected ? this.colour_ : 'transparent';
      this.rowDiv_.style.borderLeft = `8px solid ${this.colour_}`;
    }
    if (labelDiv) {
      labelDiv.style.color = isSelected ? '#ffffff' : this.colour_;
    }
    if (this.iconEl_ && this.iconEl_.querySelector('svg')) {
      this.iconEl_.style.color = isSelected ? '#ffffff' : this.colour_;
    }
    if (isSelected) {
      const name = (this as any).name_ as string;
      const bg: Record<string, string> = {
        Movement: 'rgba(22, 163, 74, 0.18)',       // Soft low-saturation Green
        Timing: 'rgba(224, 134, 0, 0.18)',         // Soft low-saturation Amber
        Display: 'rgba(59, 130, 246, 0.18)',       // Soft low-saturation Blue
        Audio: 'rgba(249, 115, 22, 0.18)',         // Soft low-saturation Orange
        'Sensors & Data': 'rgba(139, 92, 246, 0.18)', // Soft low-saturation Purple
        'Program Flow': 'rgba(6, 182, 212, 0.18)',  // Soft low-saturation Cyan
        Logic: 'rgba(13, 148, 136, 0.18)',         // Soft low-saturation Teal
        Math: 'rgba(79, 70, 229, 0.18)',           // Soft low-saturation Indigo
        Variables: 'rgba(161, 98, 7, 0.18)',       // Soft low-saturation Brown
        Functions: 'rgba(86, 83, 134, 0.18)',      // Soft low-saturation Ink Slate
        Templates: 'rgba(202, 138, 4, 0.18)',      // Soft low-saturation Gold
        AI: 'rgba(236, 45, 143, 0.18)',            // Soft low-saturation Pink
      };
      if (name && bg[name]) {
        document.documentElement.style.setProperty('--flyout-bg-color', bg[name]);
      }
    }
  }
}

import { initializeAstroidEditor } from '../../core';
import { getAstroidToolbox } from '../../toolbox';
import { getRobotkuTheme } from '../../visual/theme';
import { categoryIconSvg } from '../../visual/categoryIcons';
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
  const [showSim, setShowSim] = useState(false);
  const [simError, setSimError] = useState(false);
  const [telemetry, setTelemetry] = useState<string[]>([]);

  // ---- Boot the editor once, on mount (client only) ----
  useEffect(() => {
    const blocklyDiv = blocklyDivRef.current;
    if (!blocklyDiv) return;

    initializeAstroidEditor();

    Blockly.registry.register(
      Blockly.registry.Type.TOOLBOX_ITEM,
      Blockly.ToolboxCategory.registrationName,
      RobotkuCategory,
      true,
    );

    const workspace = Blockly.inject(blocklyDiv, {
      theme: getRobotkuTheme(),
      toolbox: getAstroidToolbox(),
      renderer: 'zelos',
      toolboxPosition: 'start',
      trashcan: false,
      zoom: { controls: false, wheel: true, startScale: 0.6, maxScale: 1.25, minScale: 0.4, scaleSpeed: 1.05 },
      grid: { spacing: 22, length: 2, colour: '#C6CAFF', snap: true },
      move: { scrollbars: true, drag: true, wheel: true },
    });
    workspaceRef.current = workspace;

    const pending = takePendingWorkspace();
    Blockly.serialization.workspaces.load(
      (pending as object) ?? INITIAL_WORKSPACE_JSON,
      workspace,
    );

    // Per-category light flyout tint with low saturation glass pane (Fix for DS glassmorphism).
    workspace.addChangeListener((event: Blockly.Events.Abstract) => {
      if (event.type !== Blockly.Events.TOOLBOX_ITEM_SELECT) return;
      const name = (event as any).newItem as string;
      const bg: Record<string, string> = {
        Movement: 'rgba(22, 163, 74, 0.16)',       // Soft low-saturation Green
        Timing: 'rgba(224, 134, 0, 0.16)',         // Soft low-saturation Amber
        Display: 'rgba(59, 130, 246, 0.16)',       // Soft low-saturation Blue
        Audio: 'rgba(249, 115, 22, 0.16)',         // Soft low-saturation Orange
        'Sensors & Data': 'rgba(139, 92, 246, 0.16)', // Soft low-saturation Purple
        'Program Flow': 'rgba(6, 182, 212, 0.16)',  // Soft low-saturation Cyan
        Logic: 'rgba(13, 148, 136, 0.16)',         // Soft low-saturation Teal
        Math: 'rgba(79, 70, 229, 0.16)',           // Soft low-saturation Indigo
        Variables: 'rgba(161, 98, 7, 0.16)',       // Soft low-saturation Brown
        Functions: 'rgba(86, 83, 134, 0.16)',      // Soft low-saturation Ink Slate
        Templates: 'rgba(202, 138, 4, 0.16)',      // Soft low-saturation Gold
        AI: 'rgba(236, 45, 143, 0.16)',            // Soft low-saturation Pink
      };
      document.documentElement.style.setProperty(
        '--flyout-bg-color',
        bg[name] || 'rgba(243, 244, 251, 0.65)',
      );
    });

    // NOTE: the 3D simulator is created lazily in its own effect (Fix 2d): it is
    // OFF by default and only spun up when the user opens the Simulator panel.

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
      onTelemetry(() => {});
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, []);

  // ---- Lazy 3D simulator (opt-in). Default OFF; create exactly one WebGL
  // context when the panel opens and dispose it when it closes / unmounts.
  useEffect(() => {
    if (!showSim) return;
    const container = simDivRef.current;
    if (!container || simulatorRef.current) return; // guard StrictMode double-invoke

    let simulator: Simulator | null = null;
    try {
      simulator = new Simulator(container);
    } catch (e) {
      console.warn('3D sim disabled:', e);
      setSimError(true);
      return;
    }
    if (simulator.initFailed) {
      setSimError(true);
      simulator.dispose();
      return;
    }
    setSimError(false);
    simulator.onContextLost = () => setSimError(true);
    simulator.loadRobotModel('/Asteria-DashMinimal.glb').catch(() => {});

    const sequencer = new SimulatorSequencer(simulator);
    simulator.sequencerVirtualPosition = sequencer.virtualPosition;
    simulatorRef.current = simulator;
    sequencerRef.current = sequencer;

    // Route offline Run through the sequencer only while the sim is open.
    setSimulatorRunner((commands: any[]) => {
      setRunning(true);
      sequencer.runCommandSequence(commands).finally(() => setRunning(false));
    });

    return () => {
      setSimulatorRunner(null);
      simulator?.dispose();
      simulatorRef.current = null;
      sequencerRef.current = null;
    };
  }, [showSim]);

  // ---- Generate {"command":...} program from the workspace ----
  const generateCode = useCallback((): string => {
    const workspace = workspaceRef.current;
    if (!workspace) return '[]';
    javascriptGenerator.init(workspace);
    const start = workspace.getTopBlocks(true).find((b) => b.type === 'program_start');
    const first = start?.getNextBlock();
    if (!first) return '[]';
    const code = javascriptGenerator.blockToCode(first) as string;
    // Each statement block emits a `{"command":...};` segment. Skip any segment
    // that isn't valid JSON (e.g. a stray expression from a reused built-in
    // block) so one bad block can't abort the whole Run.
    const commands = code
      .split(';')
      .map((c) => c.trim())
      .filter((c) => c !== '')
      .flatMap((c) => {
        try {
          return [JSON.parse(c)];
        } catch {
          console.warn('Skipping non-JSON command segment:', c);
          return [];
        }
      });
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

        {/* Hint removed */}
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

        {/* 3D simulator card — opt-in (closed by default). Run works without it. */}
        <div className={`${styles.simCard} ${showSim ? '' : styles.simHidden}`}>
          <div className={styles.simHead}>
            <span>{connected ? `Robot · ${robotInfo?.board ?? ''}` : 'Simulator'}</span>
            <button
              className={styles.simToggle}
              onClick={() => setShowSim((v) => !v)}
              title={showSim ? 'Tutup simulator 3D' : 'Buka simulator 3D'}
            >
              {showSim ? '–' : '+'}
            </button>
          </div>
          {showSim && simError ? (
            <div className={styles.simError}>
              Simulator 3D tidak tersedia (WebGL). Menjalankan program tetap berfungsi.
            </div>
          ) : (
            <div ref={simDivRef} className={styles.simCanvas} />
          )}
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
