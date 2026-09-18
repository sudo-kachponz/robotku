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
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const searching = query.length > 0;

  const cards = searching
    ? SNIPPETS.filter(
        (s) =>
          s.label.toLowerCase().includes(query) ||
          s.desc.toLowerCase().includes(query) ||
          s.py.toLowerCase().includes(query),
      )
    : SNIPPETS.filter((s) => s.category === cat);

  const renderCard = (s: Snippet) => {
    const c = getCategoryColor(s.category);
    return (
      <div
        key={s.id}
        className={styles.card}
        style={{ ['--cat' as string]: c }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_MIME, s.py);
          e.dataTransfer.effectAllowed = 'copy';
          const ghost = document.createElement('div');
          ghost.textContent = s.label;
          ghost.className = styles.ghost;
          ghost.style.setProperty('--cat', c);
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
    );
  };

  return (
    <div className={styles.flyout}>
      {!searching && (
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
      )}

      <div className={styles.right}>
        <form
          className={styles.searchRow}
          onSubmit={(e) => {
            e.preventDefault();
            if (cards[0]) onDocs(cards[0]);
          }}
        >
          <input
            className={styles.search}
            placeholder="Cari blok…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>
        <div className={styles.cards} style={{ ['--cat' as string]: getCategoryColor(cat) }}>
          {cards.length === 0 ? (
            <div className={styles.noResult}>Tidak ada hasil.</div>
          ) : (
            cards.map(renderCard)
          )}
        </div>
      </div>
    </div>
  );
}
