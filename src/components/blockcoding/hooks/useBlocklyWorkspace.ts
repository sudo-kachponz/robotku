// src/components/blockcoding/hooks/useBlocklyWorkspace.ts
//
// Hook for managing Blockly workspace lifecycle, events, dynamic scale, orientation, and toolbox visibility.

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { initializeAstroidEditor } from '../../../core';
import { getAstroidToolbox } from '../../../toolbox';
import { getRobotkuTheme } from '../../../visual/theme';
import { RobotkuCategory } from '../RobotkuCategory';
import { takePendingWorkspace } from '../../../app/editorBridge';
import { onTelemetry } from '../../../app/connection';
import { ingestTelemetry } from '../../../runtime/telemetryCache';
import { getCategoryTint } from '../../../visual/categoryColors';
import { registerTemplatesFlyout } from '../../../categories/templates';
import { subscribe } from '../../../app/store';
import { profileFromHello, robotkuEsp32V3 } from '../../../domain/boardProfile';
import type { RobotInfo } from '../../../transport';

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

export function useBlocklyWorkspace(blocklyDivRef: React.RefObject<HTMLDivElement | null>) {
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [telemetry, setTelemetry] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  // Phones start with the category sidebar collapsed — otherwise the 145px toolbox
  // crowds the blocks. The toolbox toggle opens it on demand.
  const [showToolbox, setShowToolbox] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 768,
  );

  const toggleToolbox = useCallback(() => {
    setShowToolbox((prev) => {
      const next = !prev;
      const ws = workspaceRef.current;
      if (ws) {
        const toolbox = ws.getToolbox();
        if (toolbox) {
          toolbox.setVisible(next);
          Blockly.svgResize(ws);
        }
      }
      return next;
    });
  }, []);

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

    // Initial scale dynamic based on viewport width
    const w = window.innerWidth;
    const startScale = w < 480 ? 0.45 : w < 1024 ? 0.6 : 0.75;

    const workspace = Blockly.inject(blocklyDiv, {
      theme: getRobotkuTheme(),
      toolbox: getAstroidToolbox(),
      renderer: 'zelos',
      toolboxPosition: 'start',
      trashcan: false,
      zoom: {
        controls: false,
        wheel: true,
        startScale,
        maxScale: 1.25,
        minScale: 0.35,
        scaleSpeed: 1.05,
        pinch: true,
      },
      grid: { spacing: 22, length: 2, colour: '#C6CAFF', snap: true },
      move: { scrollbars: true, drag: true, wheel: true },
    });
    workspaceRef.current = workspace;

    // Match the mobile default: hide the toolbox so blocks fill the screen.
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      workspace.getToolbox()?.setVisible(false);
      Blockly.svgResize(workspace);
    }

    // Templates category is a custom flyout (gallery button + comment block).
    registerTemplatesFlyout(workspace);

    const pending = takePendingWorkspace();
    Blockly.serialization.workspaces.load((pending as object) ?? INITIAL_WORKSPACE_JSON, workspace);

    workspace.addChangeListener((event: Blockly.Events.Abstract) => {
      if (event.type !== Blockly.Events.TOOLBOX_ITEM_SELECT) return;
      const name = (event as any).newItem as string;
      const tint = getCategoryTint(name);
      document.documentElement.style.setProperty('--flyout-bg-color', tint);
    });

    // P1 live guard: when a robot connects, rebuild the toolbox from its
    // HELLO_ACK capabilities/ports; on disconnect, fall back to the static V3 profile.
    let lastRobotInfo: RobotInfo | null = null;
    const unsubStore = subscribe((s) => {
      if (s.robotInfo === lastRobotInfo) return;
      lastRobotInfo = s.robotInfo;
      const profile = s.robotInfo
        ? profileFromHello(s.robotInfo.capabilities, s.robotInfo.ports)
        : robotkuEsp32V3;
      workspace.updateToolbox(getAstroidToolbox(profile));
    });

    const unsubTelemetry = onTelemetry((msg) => {
      ingestTelemetry(msg);
      const line = typeof msg === 'string' ? msg : JSON.stringify(msg);
      // Cap each line at 500 chars — a runaway firmware line can be megabytes.
      const capped = line.length > 500 ? line.slice(0, 500) + '…' : line;
      setTelemetry((prev) => [...prev.slice(-200), capped]);
    });

    const onResize = () => {
      if (workspaceRef.current) {
        Blockly.svgResize(workspaceRef.current);
      }
    };

    const onOrientationChange = () => {
      onResize();
      setTimeout(onResize, 100);
      setTimeout(onResize, 300);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrientationChange);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onResize);
    }
    const raf = requestAnimationFrame(onResize);
    setIsLoaded(true);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrientationChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', onResize);
      }
      cancelAnimationFrame(raf);
      unsubStore();
      unsubTelemetry();
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [blocklyDivRef]);

  return { workspaceRef, telemetry, setTelemetry, isLoaded, showToolbox, toggleToolbox };
}
