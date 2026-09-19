// src/components/blockcoding/BlockCoding.tsx
//
// The Robotku Block Coding editor — modular React wrapper around Blockly.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import * as Blockly from 'blockly';
import { generateProgramJson } from '../../blockcoding/generateProgram';
import { cvStore } from '../../ai/cvStore';
import { estop, autoConnect } from '../../app/connection';
import { getState } from '../../app/store';
import SimStage from './SimStage';
import { ProgramRunner, type RobotSink } from '../../runtime/ProgramRunner';
import { SimSink, closeSharedAudio } from '../../runtime/SimSink';
import { profileFromHello, robotkuEsp32V3 } from '../../domain/boardProfile';
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
import { buildTemplateWorkspace, type BlockSpec } from '../../templates/authoring';
import { setGalleryOpener, setLcdBlockInserter } from '../../templates/galleryBridge';
import Tour from './Tour';
import ProblemsPanel from './python/ProblemsPanel';
import { generatePython } from '../../pythongen';
import { parsePython, CompileError } from '../../pythongen/compile';
import { getDoc } from '../../pythongen/docs/registry';
import { generateProgram } from '../../blockcoding/generateProgram';
import { unsupportedOpcodesInProgram } from '../../blockcoding/blockOpcodes';
import type { PyProblem, PyEditorApi } from './python/PyEditor';
import type { Snippet } from '../../pythongen/snippets';
import { CopyIcon, CheckIcon, SearchIcon } from './sim/SimIcons';
import { searchToolboxBlocks } from '../../blockcoding/searchBlocks';
import { useAppTheme } from '../../theme/themeManager';
import styles from './BlockCoding.module.css';

const PyEditor = dynamic(() => import('./python/PyEditor'), { ssr: false });
const PyFlyout = dynamic(() => import('./python/PyFlyout'), { ssr: false });
const DocsPanel = dynamic(() => import('./python/DocsPanel'), { ssr: false });

// Client-only: the CV panel pulls in camera + (lazily) ML libs.
const CvPanel = dynamic(() => import('./CvPanel'), { ssr: false });

interface BlockCodingProps {
  viewMode?: 'blocks' | 'python';
  setViewMode?: (m: 'blocks' | 'python') => void;
  canLeavePythonRef?: { current: () => boolean };
  canLeaveBlocksRef?: { current: () => boolean };
}

export default function BlockCodingWrapper({
  viewMode = 'blocks',
  setViewMode,
  canLeavePythonRef,
  canLeaveBlocksRef,
}: BlockCodingProps) {
  return (
    <ErrorBoundary fallbackTitle="Kendala pada Editor Blockly">
      <BlockCodingInner
        viewMode={viewMode}
        setViewMode={setViewMode}
        canLeavePythonRef={canLeavePythonRef}
        canLeaveBlocksRef={canLeaveBlocksRef}
      />
    </ErrorBoundary>
  );
}

function BlockCodingInner({
  viewMode,
  setViewMode,
  canLeavePythonRef,
  canLeaveBlocksRef,
}: BlockCodingProps) {
  const { connState, robotInfo } = useConnection();
  const connected = connState === 'connected';

  // Auto-reconnect to an already-granted robot on load — no click needed.
  useEffect(() => {
    void autoConnect();
  }, []);

  const blocklyDivRef = useRef<HTMLDivElement | null>(null);
  const { workspaceRef, telemetry, setTelemetry, showToolbox, toggleToolbox } =
    useBlocklyWorkspace(blocklyDivRef);

  const simSinkRef = useRef<SimSink | null>(null);
  if (!simSinkRef.current) simSinkRef.current = new SimSink();
  const runnerRef = useRef<ProgramRunner | null>(null);
  if (!runnerRef.current) runnerRef.current = new ProgramRunner(simSinkRef.current);
  const runningBlockIdRef = useRef<string | null>(null);

  // Mirror mode: the on-screen robot adopts the connected board's real capabilities
  // (a 1-servo bench board mirrors as 1-servo), reverting to the static V3 offline.
  useEffect(() => {
    simSinkRef.current?.setProfile(
      connected && robotInfo
        ? profileFromHello(robotInfo.capabilities, robotInfo.ports)
        : robotkuEsp32V3,
    );
  }, [connected, robotInfo]);

  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [scope, setScope] = useState<Record<string, unknown>>({});
  const [showMonitor, setShowMonitor] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showCvPanel, setShowCvPanel] = useState(false);
  const aiNoticeShownRef = useRef(false);
  const [showSim, setShowSim] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024,
  );
  const DEFAULT_SIM_WIDTH = 520;
  const MIN_SIM_WIDTH = 340;
  const [simWidth, setSimWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rk_sim_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 320 && parsed <= 1200) return parsed;
      }
    }
    return DEFAULT_SIM_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);

  const DEFAULT_TOOLBOX_WIDTH = 320;
  const MIN_TOOLBOX_WIDTH = 180;
  const MAX_TOOLBOX_WIDTH = 560;
  const [toolboxWidth, setToolboxWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rk_tb_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_TOOLBOX_WIDTH && parsed <= MAX_TOOLBOX_WIDTH) {
          return parsed;
        }
      }
    }
    return DEFAULT_TOOLBOX_WIDTH;
  });
  const [isTbResizing, setIsTbResizing] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutLang, setTutLang] = useState<'id' | 'en'>('id');
  const [pyBuffer, setPyBuffer] = useState('');
  const [pyProblems, setPyProblems] = useState<PyProblem[]>([]);
  const [pyCopied, setPyCopied] = useState(false);
  const pyApiRef = useRef<PyEditorApi | null>(null);
  const [docsSnippet, setDocsSnippet] = useState<Snippet | null>(null);
  const [conversionWarn, setConversionWarn] = useState<{
    from: 'blocks' | 'python';
    to: 'blocks' | 'python';
  } | null>(null);
  const { theme: currentTheme, setTheme: setAppTheme, themes } = useAppTheme();
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [blockSearchQuery, setBlockSearchQuery] = useState('');

  const handleBlockSearch = useCallback(
    (query: string) => {
      setBlockSearchQuery(query);
      const ws = workspaceRef.current;
      if (!ws) return;

      const flyout = ws.getFlyout?.() || (ws.getToolbox?.() as any)?.getFlyout?.();
      const q = query.trim();

      if (!q) {
        if (flyout) {
          flyout.hide?.();
        }
        return;
      }

      const profile =
        connected && robotInfo
          ? profileFromHello(robotInfo.capabilities, robotInfo.ports)
          : robotkuEsp32V3;

      const results = searchToolboxBlocks(q, profile);
      if (flyout) {
        if (results.length > 0) {
          flyout.show([
            { kind: 'label', text: `Pencarian "${q}" (${results.length} blok)` },
            ...results,
          ]);
        } else {
          flyout.show([
            { kind: 'label', text: `Tidak ada blok yang cocok dengan "${q}"` },
          ]);
        }
      }
    },
    [workspaceRef, connected, robotInfo],
  );

  // Clear block search query when a category is explicitly clicked
  useEffect(() => {
    const ws = workspaceRef.current;
    if (!ws) return;
    const onToolboxSelect = (event: Blockly.Events.Abstract) => {
      if (event.type === Blockly.Events.TOOLBOX_ITEM_SELECT) {
        setBlockSearchQuery('');
      }
    };
    ws.addChangeListener(onToolboxSelect);
    return () => ws.removeChangeListener(onToolboxSelect);
  }, [workspaceRef]);

  // Re-seed Python from blocks ONLY when the blocks actually changed (in Blocks
  // mode) — never clobber the user's typed Python on a plain toggle round-trip (§H).
  const blocksDirtyRef = useRef(true);
  useEffect(() => {
    if (viewMode !== 'blocks') return;
    const ws = workspaceRef.current;
    if (!ws) return;
    const mark = () => {
      blocksDirtyRef.current = true;
    };
    ws.addChangeListener(mark);
    return () => ws.removeChangeListener(mark);
  }, [viewMode, workspaceRef]);

  // Entering Python mode seeds the editor from blocks (Blocks -> Python) only if
  // the blocks changed since last time (or the buffer is empty).
  useEffect(() => {
    if (viewMode !== 'python') return;
    const ws = workspaceRef.current;
    if (!ws) return;
    setPyBuffer((prev) => {
      if (blocksDirtyRef.current || prev === '') {
        blocksDirtyRef.current = false;
        return generatePython(ws);
      }
      return prev;
    });
  }, [viewMode, workspaceRef]);

  // In Python mode the editor text is the source of truth: debounce-parse it back
  // into the workspace (Python -> Blocks) so Run/Blocks stay in sync, and surface
  // parser + board-support problems. Events are disabled during the reload so it
  // doesn't retrigger the flyout-insert listener below.
  useEffect(() => {
    if (viewMode !== 'python') return;
    const ws = workspaceRef.current;
    if (!ws) return;
    const id = setTimeout(() => {
      try {
        const json = buildTemplateWorkspace(parsePython(pyBuffer));
        Blockly.Events.disable();
        try {
          Blockly.serialization.workspaces.load(json, ws);
        } finally {
          Blockly.Events.enable();
        }
        const profile =
          connected && robotInfo
            ? profileFromHello(robotInfo.capabilities, robotInfo.ports)
            : robotkuEsp32V3;
        const unsupported = unsupportedOpcodesInProgram(generateProgram(ws), profile);
        setPyProblems(
          unsupported.map((op) => ({
            line: 1,
            message: `Perangkat aktif belum mendukung: ${op}`,
            severity: 'warning' as const,
          })),
        );
      } catch (e) {
        const err = e as CompileError;
        setPyProblems([
          { line: err?.line ?? 1, message: err?.message ?? String(e), severity: 'error' },
        ]);
      }
    }, 500);
    return () => clearTimeout(id);
  }, [pyBuffer, viewMode, workspaceRef, connected, robotInfo]);

  const openDocsBySlug = useCallback((slug: string) => {
    const d = getDoc(slug);
    setDocsSnippet({
      id: slug,
      category: d?.category ?? '',
      label: d?.title ?? slug,
      desc: d?.summary ?? '',
      py: '',
      docs: slug,
    });
  }, []);

  const jumpToPyLine = useCallback((line: number) => {
    const view = pyApiRef.current?.view;
    if (!view) return;
    const n = Math.max(1, Math.min(line, view.state.doc.lines));
    const l = view.state.doc.line(n);
    view.dispatch({ selection: { anchor: l.from, head: l.to }, scrollIntoView: true });
    view.focus();
  }, []);

  const copyPython = useCallback(() => {
    navigator.clipboard?.writeText(pyBuffer).then(
      () => {
        setPyCopied(true);
        setTimeout(() => setPyCopied(false), 1500);
      },
      () => {},
    );
  }, [pyBuffer]);

  // Guard the navbar toggle: block a switch to Blocks while the Python has a parse
  // error, and pop a confirm modal instead of silently dropping to old blocks (§H).
  const pyHasError = pyProblems.some((p) => p.severity === 'error');
  if (canLeavePythonRef) {
    canLeavePythonRef.current = () => {
      if (pyHasError) {
        setConversionWarn({ from: 'python', to: 'blocks' });
        return false;
      }
      return true;
    };
  }

  if (canLeaveBlocksRef) {
    canLeaveBlocksRef.current = () => {
      const ws = workspaceRef.current;
      if (ws) {
        try {
          generatePython(ws);
        } catch {
          setConversionWarn({ from: 'blocks', to: 'python' });
          return false;
        }
      }
      return true;
    };
  }

  // Auto-open the tutorial the first time only; the "?" button reopens it anytime.
  useEffect(() => {
    try {
      if (!localStorage.getItem('robotku.tutorialSeen')) setShowTutorial(true);
    } catch {}
  }, []);
  const closeTutorial = useCallback(() => {
    setShowTutorial(false);
    try {
      localStorage.setItem('robotku.tutorialSeen', '1');
    } catch {}
  }, []);

  const attachRunner = useCallback(
    (runner: ProgramRunner) => {
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
    },
    [workspaceRef],
  );

  const pickSink = useCallback((): RobotSink => {
    const transport = getState().transport;
    if (connected && transport) {
      const t = new TransportSink(transport);
      return showSim ? new FanOutSink([t, simSinkRef.current!]) : t;
    }
    return simSinkRef.current!;
  }, [connected, showSim]);

  // Re-fit Blockly when the sim panel opens/closes — on mobile the sim sheet shrinks
  // the Blockly area (blocklySimOpen) so they stack; wait out the sheet transition,
  // then a resize event drives Blockly.svgResize (handled in the workspace hook).
  useEffect(() => {
    const id = setTimeout(() => window.dispatchEvent(new Event('resize')), 320);
    return () => clearTimeout(id);
  }, [showSim]);

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

  // Let OLED Animator & LED Panel insert block sequences directly into Blockly.
  useEffect(() => {
    setLcdBlockInserter((program, label) => {
      // Python mode: convert the same block program to Python and drop it in the
      // editor, so OLED/LED "Pasang ke Blok Code" works identically in Python.
      if (viewMode === 'python') {
        const api = pyApiRef.current;
        if (!api) {
          showToast('Buka tab Python dulu!', 'warn');
          return;
        }
        try {
          const tmp = new Blockly.Workspace();
          Blockly.serialization.workspaces.load(buildTemplateWorkspace(program) as any, tmp);
          const py = generatePython(tmp).trim();
          tmp.dispose();
          api.insertSnippet(py + '\n');
          showToast(label ?? 'Kode Python berhasil dipasang!', 'success');
        } catch (err) {
          console.error('Failed to insert python:', err);
          showToast('Gagal memasang kode Python', 'error');
        }
        return;
      }
      const ws = workspaceRef.current;
      if (!ws) {
        showToast('Buka tab Blok Kode untuk memasang blok!', 'warn');
        return;
      }
      try {
        const wsJson = buildTemplateWorkspace(program);
        insertTemplate(ws, wsJson as any, 'append');
        showToast(label ?? 'Blok berhasil dipasang ke Blok Kode!', 'success');
      } catch (err) {
        console.error('Failed to insert block sequence:', err);
        showToast('Gagal memasang blok ke Blok Kode', 'error');
      }
    });
    return () => setLcdBlockInserter(null);
  }, [workspaceRef, viewMode]);

  // Camera on? (drives the AI button's live dot). Stop the camera on unmount so a
  // forgotten MediaStream can never leave the webcam LED on.
  const cameraOn = useSyncExternalStore(
    cvStore.subscribe,
    () => cvStore.isOn(),
    () => false,
  );
  useEffect(
    () => () => {
      cvStore.stop();
      closeSharedAudio();
    },
    [],
  );

  // Resizable simulator drawer handle (Drag border to widen/shrink)
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const isDesktop = window.innerWidth >= 1024;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const maxW = Math.min(1200, window.innerWidth - 420);
      let newW: number;
      if (isDesktop) {
        newW = Math.max(MIN_SIM_WIDTH, Math.min(maxW, clientX - 16));
      } else {
        newW = Math.max(MIN_SIM_WIDTH, Math.min(maxW, window.innerWidth - clientX - 76));
      }
      setSimWidth(newW);
      if (typeof window !== 'undefined') {
        localStorage.setItem('rk_sim_width', newW.toString());
      }
      if (workspaceRef.current) {
        Blockly.svgResize(workspaceRef.current);
      }
    };

    const onEnd = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      if (workspaceRef.current) {
        Blockly.svgResize(workspaceRef.current);
      }
      window.dispatchEvent(new Event('resize'));
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  }, [workspaceRef]);

  const handleResetSimWidth = useCallback(() => {
    setSimWidth(DEFAULT_SIM_WIDTH);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rk_sim_width', DEFAULT_SIM_WIDTH.toString());
    }
    if (workspaceRef.current) {
      setTimeout(() => Blockly.svgResize(workspaceRef.current!), 50);
    }
    window.dispatchEvent(new Event('resize'));
  }, [workspaceRef]);

  // Resizable category toolbox / sidebar handle (Drag right border to stretch/shrink)
  const handleTbResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsTbResizing(true);
      const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const initialWidth = toolboxWidth;

      const onMove = (moveEvent: MouseEvent | TouchEvent) => {
        const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const deltaX = clientX - startX;
        const maxW = Math.min(MAX_TOOLBOX_WIDTH, window.innerWidth - 300);
        const newW = Math.max(MIN_TOOLBOX_WIDTH, Math.min(maxW, initialWidth + deltaX));
        setToolboxWidth(newW);
        if (typeof window !== 'undefined') {
          localStorage.setItem('rk_tb_width', newW.toString());
        }
        if (workspaceRef.current) {
          Blockly.svgResize(workspaceRef.current);
        }
      };

      const onEnd = () => {
        setIsTbResizing(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
        if (workspaceRef.current) {
          Blockly.svgResize(workspaceRef.current);
        }
        window.dispatchEvent(new Event('resize'));
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove);
      window.addEventListener('touchend', onEnd);
    },
    [toolboxWidth, workspaceRef],
  );

  const handleTbResetWidth = useCallback(() => {
    setToolboxWidth(DEFAULT_TOOLBOX_WIDTH);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rk_tb_width', DEFAULT_TOOLBOX_WIDTH.toString());
    }
    if (workspaceRef.current) {
      setTimeout(() => Blockly.svgResize(workspaceRef.current!), 50);
    }
  }, [workspaceRef]);

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
    try {
      commands = JSON.parse(json);
    } catch {
      commands = [];
    }

    // AI programs are host-executed (inference in the browser); the board only
    // ever receives motion. Say so ONCE in the monitor so it's not a mystery.
    const usesAi =
      json.includes('GET_AI_DATA') || json.includes('AI_CAMERA') || json.includes('AI_SET_MODEL');
    if (usesAi && !aiNoticeShownRef.current) {
      aiNoticeShownRef.current = true;
      setShowMonitor(true);
      setTelemetry((prev) => [
        ...prev.slice(-200),
        'ℹ️ Program AI dijalankan dari browser; robot menerima perintah gerak saja.',
      ]);
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
  }, [generateCode, showSim, pickSink, attachRunner, speed]);

  const handleStop = useCallback(() => {
    void estop();
    runnerRef.current?.stop();
    simSinkRef.current?.stopAll();
    simSinkRef.current?.setRunning(false);
    simSinkRef.current?.setStatus(null);
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
    // In Python mode download the .py source; in Blocks mode the .rbk workspace.
    const [content, type, name] =
      viewMode === 'python'
        ? [pyBuffer, 'text/x-python', 'program.py']
        : [
            JSON.stringify(Blockly.serialization.workspaces.save(workspace), null, 2),
            'application/json',
            'program.rbk',
          ];
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, [workspaceRef, viewMode, pyBuffer]);

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
      // Additive: remember the Python source + mode when saved from Python view.
      ...(viewMode === 'python' ? { mode: 'python' as const, python: pyBuffer } : {}),
    };
    const list = await loadProjects();
    await persistProjects([project, ...list]);
    showToast(`Tersimpan: ${project.name}`, 'success');
  }, [workspaceRef, viewMode, pyBuffer]);

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
  const handleUseTemplate = useCallback(
    (workspaceJson: object, name: string) => {
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
    },
    [workspaceRef],
  );

  const handleTryTemplate = useCallback(
    (workspaceJson: object) => {
      const ws = workspaceRef.current;
      if (!ws) return;
      insertTemplate(ws, workspaceJson, 'replace');
      setShowSim(true);
      setTimeout(() => handleRun(), 80);
    },
    [workspaceRef, handleRun],
  );

  // ▶ on a docs example: load its blocks (confirm if a program exists) then run in the
  // simulator, reusing the existing insertTemplate + run path (no new runtime).
  const runDocExample = useCallback(
    (blocks: BlockSpec[]) => {
      const ws = workspaceRef.current;
      if (!ws) return;
      let mode: 'replace' | 'append' = 'replace';
      if (ws.getAllBlocks(false).length > 1) {
        mode = window.confirm(
          'Muat contoh ini?\n\nOK = Ganti program yang ada\nBatal = Tambahkan di samping',
        )
          ? 'replace'
          : 'append';
      }
      insertTemplate(ws, buildTemplateWorkspace(blocks), mode);
      setDocsSnippet(null);
      setViewMode?.('blocks');
      setShowSim(true);
      setTimeout(() => handleRun(), 120);
    },
    [workspaceRef, handleRun, setViewMode],
  );

  const handleSaveTemplate = useCallback(async () => {
    const ws = workspaceRef.current;
    if (!ws) return;
    const selected = (Blockly as any).getSelected?.() ?? (Blockly as any).common?.getSelected?.();
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
      <div
        className={`${styles.editor} ${showSim ? styles.simOpen : ''} ${showToolbox ? styles.toolboxOpen : ''} ${viewMode === 'python' ? styles.pythonMode : ''} ${isTbResizing ? styles.tbResizing : ''} ${isResizing ? styles.resizing : ''}`}
        style={{
          '--tb-w': `${toolboxWidth}px`,
          '--sim-w': `${simWidth}px`,
        } as React.CSSProperties}
      >
        <div ref={blocklyDivRef} className={`${styles.blockly} ${showSim ? styles.blocklySimOpen : ''}`} />

        {/* Right Resize Drag Handle for Category Sidebar / Toolbox (Drag right to stretch) */}
        {showToolbox && (
          <div
            className={`${styles.tbResizeHandle} ${isTbResizing ? styles.tbResizing : ''}`}
            onMouseDown={handleTbResizeStart}
            onTouchStart={handleTbResizeStart}
            onDoubleClick={handleTbResetWidth}
            title="Tarik ke kanan untuk memperlebar daftar kategori (Klik ganda untuk reset)"
          />
        )}

        {viewMode === 'blocks' && showToolbox && (
          <div className={styles.blocksSearch}>
            <div className={styles.blocksSearchInputWrap}>
              <input
                type="text"
                className={styles.blocksSearchInput}
                placeholder="Search..."
                value={blockSearchQuery}
                onChange={(e) => handleBlockSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    handleBlockSearch('');
                  }
                }}
                aria-label="Cari blok kode"
              />
              {blockSearchQuery ? (
                <button
                  type="button"
                  className={styles.blocksSearchClear}
                  onClick={() => handleBlockSearch('')}
                  aria-label="Hapus pencarian"
                  title="Hapus"
                >
                  ✕
                </button>
              ) : (
                <SearchIcon className={styles.blocksSearchIcon} size={15} />
              )}
            </div>
            <button
              type="button"
              className={styles.sidebarCollapseBtn}
              onClick={toggleToolbox}
              title="Sembunyikan Kategori (–)"
              aria-label="Sembunyikan Kategori"
            >
              –
            </button>
          </div>
        )}

        {viewMode === 'python' && (
          <div className={styles.pyPanel}>
            <div className={styles.pyHead}>
              <span>main.py</span>
              <button
                onClick={copyPython}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                {pyCopied ? (
                  <>
                    <CheckIcon size={12} />
                    <span>Disalin</span>
                  </>
                ) : (
                  <>
                    <CopyIcon size={12} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className={styles.pyBody}>
              {showToolbox && (
                <div className={styles.pyFlyoutWrap}>
                  <PyFlyout
                    onInsert={(py) => pyApiRef.current?.insertSnippet(py)}
                    onToggleCollapse={toggleToolbox}
                  />
                </div>
              )}
              <div className={styles.pyEditorWrap}>
                <PyEditor
                  value={pyBuffer}
                  onChange={setPyBuffer}
                  problems={pyProblems}
                  onReady={(api) => {
                    pyApiRef.current = api;
                  }}
                  onOpenDocs={openDocsBySlug}
                />
              </div>
            </div>
            {pyProblems.length > 0 ? (
              <ProblemsPanel problems={pyProblems} onJump={jumpToPyLine} />
            ) : (
              <div className={styles.pyHint}>
                Klik / seret kartu dari kiri ke editor, atau ketik langsung. Tekan “?” untuk bantuan. Tersinkron ke mode Blocks.
              </div>
            )}
          </div>
        )}

        {/* Plus button to expand the Blockly Categories Sidebar when closed */}
        {!showToolbox && (
          <button
            className={`${styles.toolboxToggle} ${styles.toolboxToggleClosed}`}
            onClick={toggleToolbox}
            title="Tampilkan Kategori Blok (+)"
            aria-label="Tampilkan Kategori Blok"
          >
            +
          </button>
        )}

        <div className={styles.toolbar}>
          <button
            className={`${styles.tbBtn} ${showToolbox ? styles.tbActive : ''}`}
            onClick={toggleToolbox}
            title={showToolbox ? 'Tutup Sidebar Blok' : 'Buka Sidebar Blok'}
          >
            <SidebarIcon /> <span>Sidebar</span>
          </button>
          <button
            className={`${styles.tbBtn} ${styles.run}`}
            onClick={handleRun}
            title="Run"
            data-tour="run"
          >
            <PlayIcon /> <span>Run</span>
          </button>
          <button
            className={`${styles.tbBtn} ${styles.stop}`}
            onClick={handleStop}
            disabled={!running && !connected}
            title="Stop (failsafe)"
            data-tour="stop"
          >
            <StopIcon /> <span>Stop</span>
          </button>
          <button
            className={`${styles.tbBtn} ${showSim ? styles.tbActive : ''}`}
            onClick={() => setShowSim((v) => !v)}
            title={showSim ? 'Tutup Simulator' : 'Buka Simulator'}
            data-tour="simulator"
          >
            <SimIcon /> <span>Simulator</span>
          </button>
          <button
            className={`${styles.tbBtn} ${showCvPanel || cameraOn ? styles.tbActive : ''}`}
            onClick={() => setShowCvPanel((v) => !v)}
            title="Computer Vision (kamera AI)"
            data-tour="ai"
          >
            <AiIcon /> <span>AI</span>
            {cameraOn && <span className={styles.tbLiveDot} />}
          </button>
          <button
            className={`${styles.tbBtn} ${showGallery ? styles.tbActive : ''}`}
            onClick={() => setShowGallery(true)}
            title="Galeri Template"
            data-tour="templates"
          >
            <TemplatesIcon /> <span>Templates</span>
          </button>
          <button
            className={styles.tbBtn}
            onClick={handleSaveTemplate}
            title="Simpan blok terpilih sebagai template"
          >
            <SaveTemplateIcon /> <span>+ Template</span>
          </button>
          <button
            className={styles.tbBtn}
            onClick={handleSave}
            title="Simpan ke Projects"
            data-tour="save"
          >
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
          <button
            className={`${styles.tbBtn} ${showThemePicker ? styles.tbActive : ''}`}
            onClick={() => setShowThemePicker((v) => !v)}
            title="Pilih Tema (Theme)"
            data-tour="theme"
          >
            <PaletteIcon /> <span>Tema</span>
          </button>
          <button
            className={styles.tbBtn}
            onClick={() => setShowTutorial(true)}
            title="Bantuan / Help"
          >
            <HelpIcon /> <span>Bantuan</span>
          </button>
        </div>

        {showThemePicker && (
          <div className={styles.themePickerOverlay} onClick={() => setShowThemePicker(false)}>
            <div className={styles.themePickerMenu} onClick={(e) => e.stopPropagation()}>
              <div className={styles.themePickerHead}>
                <span>Pilih Tema IDE</span>
                <button onClick={() => setShowThemePicker(false)} aria-label="Tutup">✕</button>
              </div>
              <div className={styles.themePickerList}>
                {themes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`${styles.themePickerItem} ${currentTheme === t.id ? styles.themePickerItemActive : ''}`}
                    onClick={() => {
                      setAppTheme(t.id);
                      setShowThemePicker(false);
                    }}
                  >
                    <div className={styles.themePickerItemSwatches}>
                      {t.swatch.map((c, i) => (
                        <span key={i} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <span className={styles.themePickerItemName}>{t.label}</span>
                    {currentTheme === t.id && <span className={styles.themePickerCheck}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {conversionWarn && (
          <div className={styles.conversionOverlay} onClick={() => setConversionWarn(null)}>
            <div className={styles.conversionModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.conversionHeader}>
                <h3>Oops, there is a problem converting your code.</h3>
              </div>
              <div className={styles.conversionBody}>
                <p>
                  {conversionWarn.from === 'python'
                    ? 'We are unable to convert your Python code back to blocks. You can keep working in Python or discard your changes and go back to the previous Blocks version.'
                    : 'We are unable to convert your Blocks code to Python. You can keep working in Blocks or discard your changes and proceed to Python.'}
                </p>
              </div>
              <div className={styles.conversionActions}>
                <button
                  type="button"
                  className={styles.conversionDiscardBtn}
                  onClick={() => {
                    const warn = conversionWarn;
                    setConversionWarn(null);
                    if (warn.from === 'python') {
                      const ws = workspaceRef.current;
                      if (ws) {
                        try {
                          const py = generatePython(ws);
                          setPyBuffer(py);
                        } catch {}
                        setPyProblems([]);
                      }
                      setViewMode?.('blocks');
                    } else {
                      setViewMode?.('python');
                    }
                  }}
                >
                  <span>
                    {conversionWarn.from === 'python'
                      ? 'Discard and go to Blocks'
                      : 'Discard and go to Python'}
                  </span>
                  <span className={styles.btnIcon}>✕</span>
                </button>
                <button
                  type="button"
                  className={styles.conversionStayBtn}
                  onClick={() => setConversionWarn(null)}
                >
                  <span>
                    {conversionWarn.from === 'python' ? 'Stay in Python' : 'Stay in Blocks'}
                  </span>
                  <span className={styles.btnIcon}>✓</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {showTutorial && <Tour lang={tutLang} onLang={setTutLang} onClose={closeTutorial} />}

        {docsSnippet && (
          <DocsPanel
            snippet={docsSnippet}
            onClose={() => setDocsSnippet(null)}
            onRunExample={runDocExample}
          />
        )}

        <div
          className={`${styles.simCard} ${showSim ? '' : styles.simHidden} ${isResizing ? styles.resizing : ''}`}
          style={{ '--sim-w': `${simWidth}px` } as React.CSSProperties}
          data-tour="sim-panel"
        >
          {/* Resize Drag Handle */}
          {showSim && (
            <div
              className={styles.simResizeHandle}
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
              onDoubleClick={handleResetSimWidth}
              title="Tarik untuk memperlebar / memperkecil simulator (Klik ganda untuk reset)"
            >
              <div className={styles.simResizeBadge}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="8 18 2 12 8 6" />
                  <polyline points="16 6 22 12 16 18" />
                </svg>
              </div>
            </div>
          )}

          <div className={styles.simHead}>
            <span>{connected ? `Robot · ${robotInfo?.board ?? ''}` : 'Simulator'}</span>
            <div className={styles.simHeadActions}>
              <button
                className={styles.simToggle}
                onClick={() => setShowSim((v) => !v)}
                title={showSim ? 'Tutup simulator' : 'Buka simulator'}
              >
                {showSim ? '–' : '+'}
              </button>
            </div>
          </div>

          {showSim && (
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
          )}
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
    MOVE_TIMED: 'Gerak',
    TURN_TIMED: 'Belok',
    STEER_TIMED: 'Setir',
    CLAW_TIMED: 'Capit',
    STOP: 'Berhenti',
    STOP_ALL: 'Berhenti Semua',
    WAIT: 'Tunggu',
    WAIT_UNTIL: 'Tunggu sampai',
    DISPLAY_MATRIX: 'LED Matrix',
    DISPLAY_TEXT: 'Teks LED',
    SET_LED_BRIGHTNESS: 'Kecerahan',
    CLEAR_MATRIX: 'Hapus Matrix',
    LCD_SHAPE: 'Bentuk LCD',
    LCD_TEXT: 'Teks LCD',
    LCD_CLEAR: 'Hapus LCD',
    SET_LED_COLOR: 'Warna LED',
    DISPLAY_ICON: 'Ikon',
    PLAY_TONE: 'Nada',
    PLAY_SOUND_EFFECT: 'Efek Suara',
    PLAY_INTERNAL_SOUND: 'Suara',
    RECORD_AUDIO: 'Rekam',
    PLAY_RECORDING: 'Putar Rekaman',
    SET_VOLUME: 'Volume',
    SET_BPM: 'BPM',
    STOP_SOUNDS: 'Stop Suara',
    SET_ANALOG: 'Set Analog',
    SET_DIGITAL: 'Set Digital',
    RESET_DISTANCE: 'Reset Jarak',
    RESET_HEADING: 'Reset Arah',
    SET_HEAD_POSITION: 'Kepala',
    SET_GRIPPER: 'Capit',
    META_SET_VAR: 'Set Variabel',
    META_CALL: 'Panggil Fungsi',
  };
  return map[command] ?? command;
}

function SidebarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
function SaveIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M8 3v6h7V3M8 21v-6h8v6" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}
function MonitorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}
function SimIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <path d="M7 9l3 3-3 3M13 15h4" />
    </svg>
  );
}
function TemplatesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function SaveTemplateIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
function AiIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M8 5l1.5-2h5L16 5" />
    </svg>
  );
}
function HelpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.2 9.2a2.8 2.8 0 015.4 1c0 1.9-2.6 2.2-2.6 4.1" />
      <circle cx="12" cy="17.6" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.8-.4-1.2 0-.9.8-1.7 1.7-1.7H16c3.3 0 6-2.7 6-6 0-5.5-4.5-10-10-10z" />
    </svg>
  );
}
