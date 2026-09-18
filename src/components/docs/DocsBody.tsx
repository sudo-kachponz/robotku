// src/components/docs/DocsBody.tsx
//
// Shared documentation body used by BOTH the in-editor DocsPanel and the standalone
// /docs/reference pages (py2.md §2.5) so content never diverges. Pure presentation
// of a DocEntry + the real block preview.

import BlockPreview from '../blockcoding/python/BlockPreview';
import { getDoc } from '../../pythongen/docs/registry';
import type { DocEntry } from '../../pythongen/docs/types';
import styles from './DocsBody.module.css';

export default function DocsBody({
  entry,
  onNavigate,
}: {
  entry: DocEntry;
  /** Called when a "see also" chip is clicked (panel navigates in place). */
  onNavigate?: (slug: string) => void;
}) {
  return (
    <div className={styles.body}>
      <div className={styles.previewRow}>
        <BlockPreview
          blockType={entry.blockPreview.blockType}
          fields={entry.blockPreview.fields}
          label={entry.title}
          category={entry.category}
        />
      </div>

      <p className={styles.summary}>{entry.summary}</p>
      {entry.description && <p className={styles.text}>{entry.description}</p>}

      {entry.boardNote && <div className={styles.boardNote}>ℹ {entry.boardNote}</div>}

      <div className={styles.section}>Signature</div>
      <pre className={styles.code}>
        <span className={styles.sigTag}>PYTHON</span>
        {'\n'}
        {entry.signature.python}
        {entry.signature.opcode ? `\n\nOPCODE  ${entry.signature.opcode}` : ''}
      </pre>

      {entry.params && entry.params.length > 0 && (
        <>
          <div className={styles.section}>Parameter</div>
          <ul className={styles.params}>
            {entry.params.map((p) => (
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

      {entry.returns && (
        <>
          <div className={styles.section}>Mengembalikan</div>
          <p className={styles.text}>
            <code className={styles.inlineCode}>{entry.returns.type}</code> — {entry.returns.desc}
          </p>
        </>
      )}

      {entry.examples && entry.examples.length > 0 && (
        <>
          <div className={styles.section}>Contoh</div>
          {entry.examples.map((ex, i) => (
            <div key={i}>
              <div className={styles.exTitle}>{ex.title}</div>
              {ex.desc && <p className={styles.text}>{ex.desc}</p>}
              <pre className={styles.code}>{ex.python}</pre>
            </div>
          ))}
        </>
      )}

      {entry.notes && entry.notes.length > 0 && (
        <>
          <div className={styles.section}>Catatan</div>
          <ul className={styles.params}>
            {entry.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </>
      )}

      {entry.seeAlso && entry.seeAlso.length > 0 && (
        <>
          <div className={styles.section}>Lihat juga</div>
          <div className={styles.seeAlso}>
            {entry.seeAlso.map((s) => {
              const rel = getDoc(s);
              return (
                <button
                  key={s}
                  className={styles.seeChip}
                  onClick={() => onNavigate?.(s)}
                  type="button"
                >
                  {rel?.title ?? s}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
