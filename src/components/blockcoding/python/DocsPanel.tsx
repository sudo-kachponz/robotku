// src/components/blockcoding/python/DocsPanel.tsx
//
// Right slide-over docs for a Python snippet (opened from the "?" on a flyout card).

import { getCategoryColor } from '../../../visual/categoryColors';
import type { Snippet } from '../../../pythongen/snippets';
import styles from './DocsPanel.module.css';

export default function DocsPanel({ snippet, onClose }: { snippet: Snippet; onClose: () => void }) {
  const d = snippet.doc;
  const color = getCategoryColor(snippet.category);
  return (
    <div className={styles.overlay} onClick={onClose}>
      <aside
        className={styles.panel}
        style={{ ['--cat' as string]: color }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Dokumentasi ${d.title}`}
      >
        <div className={styles.head}>
          <button className={styles.back} onClick={onClose}>
            ← Kembali
          </button>
          <span className={styles.cat}>{snippet.category}</span>
        </div>
        <h2 className={styles.title}>{d.title}</h2>
        <p className={styles.body}>{d.body}</p>

        <div className={styles.section}>Contoh</div>
        <pre className={styles.code}>{d.example}</pre>

        {d.params && d.params.length > 0 && (
          <>
            <div className={styles.section}>Parameter</div>
            <ul className={styles.params}>
              {d.params.map((p) => (
                <li key={p.name}>
                  <code>{p.name}</code> — {p.desc}
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}
