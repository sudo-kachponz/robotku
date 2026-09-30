// src/pages/ai-labs/index.tsx
//
// AI Labs "Fira". FiraShell only touches canvas/window inside useEffect (SSR-safe),
// so it's imported directly — the egg shell renders server-side and the pixel loop
// starts on the client after hydration. Step 2: cangkang + mesin piksel, mode
// WAJAH + JAM. Lihat docs/AI-LABS.md.

import FiraShell from '../../components/ailabs/FiraShell';

export default function AiLabsPage() {
  return <FiraShell />;
}
