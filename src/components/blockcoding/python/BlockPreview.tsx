// src/components/blockcoding/python/BlockPreview.tsx
//
// Shows the real Blockly block image in docs (py2.md §2.2). Renders + caches the
// block as SVG; falls back to a coloured category chip if rendering fails, and
// re-renders when the app theme changes.

import { useEffect, useState } from 'react';
import { getCategoryColor } from '../../../visual/categoryColors';
import { renderBlockPreviewSvg } from './blockPreview';
import styles from './BlockPreview.module.css';

export default function BlockPreview({
  blockType,
  fields,
  label,
  category,
}: {
  blockType: string;
  fields?: Record<string, unknown>;
  label: string;
  category: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const render = () => {
      const out = renderBlockPreviewSvg(blockType, fields);
      if (alive) setSvg(out);
    };
    render();
    const obs = new MutationObserver(render);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('robotku:themechange', render);
    return () => {
      alive = false;
      obs.disconnect();
      window.removeEventListener('robotku:themechange', render);
    };
  }, [blockType, fields]);

  if (svg) {
    return (
      <div className={styles.wrap} dangerouslySetInnerHTML={{ __html: svg }} aria-label={label} />
    );
  }
  return (
    <div className={styles.wrap}>
      <span className={styles.chip} style={{ background: getCategoryColor(category) }}>
        {label}
      </span>
    </div>
  );
}
