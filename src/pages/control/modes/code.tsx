// src/pages/control/modes/code.tsx
//
// Block Coding mode. The editor imports `blockly` + three.js (both browser-only),
// so it is loaded client-side via next/dynamic({ ssr: false }).

import dynamic from 'next/dynamic';
import ControlLayout from '../../../components/control/ControlLayout';

const BlockCoding = dynamic(
  () => import('../../../components/blockcoding/BlockCoding'),
  {
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
  },
);

export default function CodePage() {
  return (
    <ControlLayout title="Block Coding" fullBleed>
      <BlockCoding />
    </ControlLayout>
  );
}
