// src/components/blockcoding/python/DocsPanel.tsx
//
// Right slide-over docs for a Python snippet (opened from the "?" on a flyout card).
// Content is resolved from the docs registry by slug, so the panel and the standalone
// /docs/reference pages never diverge.

import { getCategoryColor } from '../../../visual/categoryColors';
import { getDoc } from '../../../pythongen/docs/registry';
import type { Snippet } from '../../../pythongen/snippets';
import styles from './DocsPanel.module.css';

export default function DocsPanel({ snippet, onClose }: { snippet: Snippet; onClose: () => void }) {
  const d = getDoc(snippet.docs);
  const color = getCategoryColor(snippet.category);
  return (
    <div className={styles.overlay} onClick={onClose}>
      <aside
        className={styles.panel}
        style={{ ['--cat' as string]: color }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Dokumentasi ${d?.title ?? snippet.label}`}
      >
        <div className={styles.head}>
          <button className={styles.back} onClick={onClose} aria-label="Kembali ke editor">
            ← Kembali
          </button>
          <span className={styles.cat}>{snippet.category}</span>
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
          <p className={styles.body}>Dokumentasi belum tersedia untuk {snippet.label}.</p>
        ) : (
          <>
            <h2 className={styles.title}>{d.title}</h2>
            <p className={styles.body}>{d.summary}</p>
            {d.description && <p className={styles.body}>{d.description}</p>}

            {d.boardNote && <div className={styles.boardNote}>ℹ {d.boardNote}</div>}

            <div className={styles.section}>Signature</div>
            <pre className={styles.code}>
              <span className={styles.sigTag}>PYTHON</span>
              {'\n'}
              {d.signature.python}
              {d.signature.opcode ? `\n\nOPCODE  ${d.signature.opcode}` : ''}
            </pre>

            {d.params && d.params.length > 0 && (
              <>
                <div className={styles.section}>Parameter</div>
                <ul className={styles.params}>
                  {d.params.map((p) => (
                    <li key={p.name}>
                      <code>{p.name}</code>
                      <span className={styles.pType}>{p.type}</span>
                      {p.default ? ` = ${p.default}` : ''} — {p.desc}
                      {p.range ? ` (${p.range})` : ''}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {d.returns && (
              <>
                <div className={styles.section}>Mengembalikan</div>
                <p className={styles.body}>
                  <code className={styles.inlineCode}>{d.returns.type}</code> — {d.returns.desc}
                </p>
              </>
            )}

            {d.examples && d.examples.length > 0 && (
              <>
                <div className={styles.section}>Contoh</div>
                {d.examples.map((ex, i) => (
                  <div key={i}>
                    <div className={styles.exTitle}>{ex.title}</div>
                    <pre className={styles.code}>{ex.python}</pre>
                  </div>
                ))}
              </>
            )}

            {d.notes && d.notes.length > 0 && (
              <>
                <div className={styles.section}>Catatan</div>
                <ul className={styles.params}>
                  {d.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </>
            )}

            {d.seeAlso && d.seeAlso.length > 0 && (
              <>
                <div className={styles.section}>Lihat juga</div>
                <div className={styles.seeAlso}>
                  {d.seeAlso.map((s) => {
                    const rel = getDoc(s);
                    return (
                      <span key={s} className={styles.seeChip}>
                        {rel?.title ?? s}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
