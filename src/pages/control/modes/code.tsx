// src/pages/control/modes/code.tsx
//
// Block Coding mode. The editor imports `blockly` + three.js (both browser-only),
// so it is loaded client-side via next/dynamic({ ssr: false }).

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import ControlLayout from '../../../components/control/ControlLayout';
import ViewToggle from '../../../components/blockcoding/ViewToggle';

const BlockCoding = dynamic(() => import('../../../components/blockcoding/BlockCoding'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        color: 'var(--ink-400)',
        fontWeight: 600,
      }}
    >
      Memuat editor…
    </div>
  ),
});

export default function CodePage() {
  // Lifted here so the Blocks/Python toggle can live in the navbar (topRightAction)
  // while BlockCoding reacts to the chosen mode.
  const [viewMode, setViewMode] = useState<'blocks' | 'python'>('blocks');
  // BlockCoding fills these guards to veto switching if code has errors/issues
  // and pop MakeCode-style modal dialogs.
  const canLeavePythonRef = useRef<() => boolean>(() => true);
  const canLeaveBlocksRef = useRef<() => boolean>(() => true);

  const requestMode = (m: 'blocks' | 'python') => {
    if (m === viewMode) return;
    if (m === 'blocks' && viewMode === 'python' && !canLeavePythonRef.current()) return;
    if (m === 'python' && viewMode === 'blocks' && !canLeaveBlocksRef.current()) return;
    setViewMode(m);
  };

  return (
    <ControlLayout
      title="Block Coding"
      fullBleed
      hideDock
      hideCenterBadge
      topRightAction={<ViewToggle mode={viewMode} onChange={requestMode} />}
    >
      <BlockCoding
        viewMode={viewMode}
        setViewMode={setViewMode}
        canLeavePythonRef={canLeavePythonRef}
        canLeaveBlocksRef={canLeaveBlocksRef}
      />
    </ControlLayout>
  );
}

