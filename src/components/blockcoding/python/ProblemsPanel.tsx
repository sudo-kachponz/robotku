// src/components/blockcoding/python/ProblemsPanel.tsx
//
// Problems panel (py2.md §2.7): collapsible header with an error-count badge,
// identical messages merged with a ×count, click a row to jump + select in the
// editor, parser errors shown apart from board-guard warnings, and a placeholder
// "Explain with AI" modal (no API call).

import { useMemo, useState } from 'react';
import type { PyProblem } from './PyEditor';
import styles from './ProblemsPanel.module.css';

interface Grouped {
  line: number;
  message: string;
  severity: 'error' | 'warning';
  count: number;
}

function group(problems: PyProblem[], severity: 'error' | 'warning'): Grouped[] {
  const map = new Map<string, Grouped>();
  for (const p of problems) {
    if (p.severity !== severity) continue;
    const key = `${p.line}|${p.message}`;
    const g = map.get(key);
    if (g) g.count++;
    else map.set(key, { line: p.line, message: p.message, severity, count: 1 });
  }
  return [...map.values()];
}

export default function ProblemsPanel({
  problems,
  onJump,
}: {
  problems: PyProblem[];
  onJump: (line: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const [explain, setExplain] = useState<string | null>(null);

  const errors = useMemo(() => group(problems, 'error'), [problems]);
  const warnings = useMemo(() => group(problems, 'warning'), [problems]);
  const errorCount = errors.reduce((n, g) => n + g.count, 0);

  const row = (g: Grouped) => (
    <div key={`${g.severity}|${g.line}|${g.message}`} className={styles.row}>
      <button className={styles.rowMain} onClick={() => onJump(g.line)} type="button">
        <span className={g.severity === 'error' ? styles.icoErr : styles.icoWarn}>
          {g.severity === 'error' ? '⛔' : '⚠'}
        </span>
        <span className={styles.msg}>
          Baris {g.line}: {g.message}
        </span>
        {g.count > 1 && <span className={styles.count}>×{g.count}</span>}
      </button>
      <button
        className={styles.explainBtn}
        onClick={() => setExplain(g.message)}
        type="button"
        title="Explain with AI"
      >
        ✨ AI
      </button>
    </div>
  );

  return (
    <div className={styles.panel}>
      <button className={styles.header} onClick={() => setOpen((v) => !v)} type="button">
        <span className={styles.chevron}>{open ? '▾' : '▸'}</span>
        <span className={styles.title}>Problems</span>
        {errorCount > 0 && <span className={styles.badge}>{errorCount}</span>}
        {warnings.length > 0 && <span className={styles.warnBadge}>{warnings.length} ⚠</span>}
      </button>

      {open && (
        <div className={styles.list}>
          {errors.map(row)}
          {warnings.length > 0 && errors.length > 0 && <div className={styles.divider} />}
          {warnings.map(row)}
        </div>
      )}

      {explain && (
        <div className={styles.modal} onClick={() => setExplain(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3>✨ Explain with AI</h3>
            <p className={styles.modalMsg}>{explain}</p>
            <p className={styles.modalNote}>
              Penjelasan AI akan segera hadir di sini — fitur ini masih dalam pengembangan.
            </p>
            <button className={styles.modalClose} onClick={() => setExplain(null)} type="button">
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
