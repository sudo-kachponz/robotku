// src/components/blockcoding/python/DocsPanel.tsx
//
// In-editor slide-over docs (opened from the "?" on a flyout card). Thin chrome
// around the shared DocsBody so the panel and the /docs/reference page stay identical.

import { useState } from 'react';
import { useAppTheme } from '../../../theme/themeManager';
import { getCategoryColor } from '../../../visual/categoryColors';
import { getDoc } from '../../../pythongen/docs/registry';
import DocsBody from '../../docs/DocsBody';
import type { Snippet } from '../../../pythongen/snippets';
import type { BlockSpec } from '../../../templates/authoring';
import styles from './DocsPanel.module.css';

export default function DocsPanel({
  snippet,
  onClose,
  onRunExample,
}: {
  snippet: Snippet;
  onClose: () => void;
  onRunExample?: (blocks: BlockSpec[]) => void;
}) {
  const { theme: currentTheme } = useAppTheme();
  const [slug, setSlug] = useState(snippet.docs);
  const d = getDoc(slug);
  const category = d?.category ?? snippet.category;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <aside
        className={styles.panel}
        style={{ ['--cat' as string]: getCategoryColor(category, currentTheme) }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Dokumentasi ${d?.title ?? snippet.label}`}
      >
        <div className={styles.head}>
          <button className={styles.back} onClick={onClose} aria-label="Kembali ke editor">
            ← Kembali
          </button>
          <span className={styles.cat}>{category}</span>
          {d && (
            <a
              className={styles.openFull}
              href={`/docs/reference/${d.slug}/`}
              target="_blank"
              rel="noopener noreferrer"
              title="Buka halaman lengkap"
            >
              ↗
            </a>
          )}
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Tutup dokumentasi"
            title="Tutup"
          >
            ✕
          </button>
        </div>

        {!d ? (
          <p className={styles.missing}>Dokumentasi belum tersedia untuk {snippet.label}.</p>
        ) : (
          <>
            <h2 className={styles.title}>{d.title}</h2>
            <DocsBody entry={d} onNavigate={setSlug} onRun={onRunExample} />
          </>
        )}
      </aside>
    </div>
  );
}
