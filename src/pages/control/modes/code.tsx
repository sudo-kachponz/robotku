// src/pages/control/modes/code.tsx
//
// Block Coding mode. The editor imports `blockly` + three.js (both browser-only),
// so it is loaded client-side via next/dynamic({ ssr: false }).

import { useState } from 'react';
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
  return (
    <ControlLayout
      title="Block Coding"
      fullBleed
      hideDock
      hideCenterBadge
      topRightAction={<ViewToggle mode={viewMode} onChange={setViewMode} />}
    >
      <BlockCoding viewMode={viewMode} />
    </ControlLayout>
  );
}
