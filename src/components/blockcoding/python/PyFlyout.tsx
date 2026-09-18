// src/components/blockcoding/python/PyFlyout.tsx
//
// HTML flyout for Python mode (Blockly's SVG flyout can't drop into a text editor).
// Reuses the block category colours + icons. Each card: click to insert its Python
// snippet at the cursor, drag to drop it into the editor, or press "?" for docs.

import { useState } from 'react';
import { getCategoryColor } from '../../../visual/categoryColors';
import { categoryIconSvg } from '../../../visual/categoryIcons';
import { SNIPPETS, SNIPPET_CATEGORIES, type Snippet } from '../../../pythongen/snippets';
import styles from './PyFlyout.module.css';

const DRAG_MIME = 'application/x-robotku-snippet';

function Icon({ name }: { name: string }) {
  const markup = categoryIconSvg(name);
  if (!markup) return <span className={styles.dot} />;
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
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

export default function PyFlyout({
  onInsert,
  onDocs,
}: {
  onInsert: (py: string) => void;
  onDocs: (s: Snippet) => void;
}) {
  const [cat, setCat] = useState<string>(SNIPPET_CATEGORIES[0]);
  const color = getCategoryColor(cat);
  const cards = SNIPPETS.filter((s) => s.category === cat);

  return (
    <div className={styles.flyout}>
      <div className={styles.rail}>
        {SNIPPET_CATEGORIES.map((c) => (
          <button
            key={c}
            className={`${styles.railBtn} ${c === cat ? styles.railActive : ''}`}
            style={{ ['--cat' as string]: getCategoryColor(c) }}
            onClick={() => setCat(c)}
            title={c}
          >
            <span className={styles.railIcon}>
              <Icon name={c} />
            </span>
            <span className={styles.railLabel}>{c}</span>
          </button>
        ))}
      </div>

      <div className={styles.cards} style={{ ['--cat' as string]: color }}>
        {cards.map((s) => (
          <div
            key={s.id}
            className={styles.card}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_MIME, s.py);
              e.dataTransfer.effectAllowed = 'copy';
              // colored chip ghost instead of the default block screenshot
              const ghost = document.createElement('div');
              ghost.textContent = s.label;
              ghost.className = styles.ghost;
              ghost.style.setProperty('--cat', color);
              document.body.appendChild(ghost);
              e.dataTransfer.setDragImage(ghost, 12, 12);
              setTimeout(() => ghost.remove(), 0);
            }}
            onClick={() => onInsert(s.py)}
            title="Klik untuk menyisipkan · seret ke editor"
          >
            <div className={styles.cardMain}>
              <span className={styles.chip}>{s.label}</span>
              <span className={styles.cardDesc}>{s.desc}</span>
            </div>
            <button
              className={styles.help}
              onClick={(e) => {
                e.stopPropagation();
                onDocs(s);
              }}
              title="Bantuan / dokumentasi"
              aria-label={`Bantuan ${s.label}`}
            >
              ?
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
