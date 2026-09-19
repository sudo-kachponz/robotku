// src/components/blockcoding/python/PyFlyout.tsx
//
// HTML flyout for Python mode (matches Blockly's flyout behavior:
// rail stays visible; clicking a category or searching opens a spacious flyout drawer next to it).
// Each card: click to insert snippet, drag to drop into editor, or press "?" for docs.

import { useState } from 'react';
import { useAppTheme } from '../../../theme/themeManager';
import { getCategoryColor } from '../../../visual/categoryColors';
import { categoryIconSvg } from '../../../visual/categoryIcons';
import { SNIPPETS, SNIPPET_CATEGORIES, type Snippet } from '../../../pythongen/snippets';
import styles from './PyFlyout.module.css';

const DRAG_MIME = 'application/x-robotku-snippet';

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  if (name === 'Search') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    );
  }
  const markup = categoryIconSvg(name);
  if (!markup) return <span className={styles.dot} />;
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
  const { theme: currentTheme } = useAppTheme();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const searching = query.length > 0;

  const isOpen = searching || activeCat !== null;
  const currentCategory = activeCat || SNIPPET_CATEGORIES[0];
  const catColor = searching
    ? (currentTheme === 'space' ? '#38BDF8' : '#EC2D8F')
    : getCategoryColor(currentCategory, currentTheme);

  const cards = searching
    ? SNIPPETS.filter(
        (s) =>
          s.label.toLowerCase().includes(query) ||
          s.desc.toLowerCase().includes(query) ||
          s.py.toLowerCase().includes(query),
      )
    : activeCat
      ? SNIPPETS.filter((s) => s.category === activeCat)
      : [];

  const handleCategoryClick = (c: string) => {
    if (activeCat === c && !searching) {
      setActiveCat(null);
    } else {
      setActiveCat(c);
      setQ('');
    }
  };

  const handleClose = () => {
    setActiveCat(null);
    setQ('');
  };

  const formatCodePreview = (code: string) => {
    return code.replace(/\$\{\d+:([^}]+)\}/g, '$1');
  };

  const renderCard = (s: Snippet) => {
    const c = getCategoryColor(s.category, currentTheme);
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
          <code className={styles.cardCode}>{formatCodePreview(s.py)}</code>
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
      {/* Category Rail (Toolbox) */}
      <div className={styles.rail}>
        {/* Search Bar at top of rail */}
        <div className={styles.railSearch}>
          <input
            type="text"
            className={styles.railSearchInput}
            placeholder="Search..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Cari blok Python"
          />
          {q ? (
            <button
              type="button"
              className={styles.railSearchClear}
              onClick={() => setQ('')}
              aria-label="Hapus pencarian"
              title="Hapus"
            >
              ✕
            </button>
          ) : (
            <svg
              className={styles.railSearchIcon}
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
        </div>

        {/* Categories List */}
        <div className={styles.railList}>
          {SNIPPET_CATEGORIES.map((c) => {
            const isSelected = !searching && c === activeCat;
            const color = getCategoryColor(c, currentTheme);
            return (
              <button
                key={c}
                className={`${styles.railBtn} ${isSelected ? styles.railActive : ''}`}
                style={{ ['--cat' as string]: color }}
                onClick={() => handleCategoryClick(c)}
                title={`Kategori ${c}`}
                aria-expanded={isSelected}
              >
                <span className={styles.railIcon}>
                  <CategoryIcon name={c} />
                </span>
                <span className={styles.railLabel}>{c}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Flyout Drawer / Panel */}
      {isOpen && (
        <>
          <div className={styles.backdrop} onClick={handleClose} />
          <div className={styles.drawer} style={{ ['--cat' as string]: catColor }}>
            <div className={styles.drawerHead}>
              <div className={styles.drawerTitleRow}>
                <div className={styles.drawerTitle}>
                  <span className={styles.drawerIcon}>
                    <CategoryIcon name={searching ? 'Search' : currentCategory} />
                  </span>
                  <span className={styles.drawerTitleText}>
                    {searching ? `Pencarian ("${q}")` : currentCategory}
                  </span>
                  <span className={styles.drawerCount}>{cards.length}</span>
                </div>
                <button
                  className={styles.closeBtn}
                  onClick={handleClose}
                  aria-label="Tutup panel blok"
                  title="Tutup"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className={styles.cards}>
              {cards.length === 0 ? (
                <div className={styles.noResult}>
                  {searching ? `Tidak ada blok yang cocok dengan "${q}".` : 'Tidak ada blok dalam kategori ini.'}
                </div>
              ) : (
                cards.map(renderCard)
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
