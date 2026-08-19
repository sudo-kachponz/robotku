// src/components/control/Placeholder.tsx
//
// Temporary "coming in a later phase" panel, wrapped in the control chrome so the
// dock stays fully navigable while modes/settings/projects are built out.

import ControlLayout from './ControlLayout';

export default function Placeholder({
  title,
  note,
}: {
  title: string;
  note: string;
}) {
  return (
    <ControlLayout title={title}>
      <div
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          color: 'var(--ink-500)',
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: 'var(--ink-900)', fontWeight: 800 }}>{title}</h1>
          <p style={{ maxWidth: '40ch', lineHeight: 1.55 }}>{note}</p>
        </div>
      </div>
    </ControlLayout>
  );
}
