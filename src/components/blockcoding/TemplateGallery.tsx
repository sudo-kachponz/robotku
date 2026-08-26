// src/components/blockcoding/TemplateGallery.tsx
//
// The Template Gallery modal (PROMPT D). A left rail of collections + a searchable
// card grid of animated templates, with a detail sheet offering "Coba di Simulator"
// (load + run) and "Pakai Template" (insert). AI-camera templates stay visible but
// are gated until PROMPT E. Also lists "Template Saya" (user-saved) with rename/delete.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BUILTIN_TEMPLATES } from '../../templates/builtin';
import {
  COLLECTION_LABELS,
  REQUIREMENT_LABELS,
  type BuiltinTemplate,
  type TemplateCollection,
} from '../../templates/types';
import type { BlockSpec } from '../../templates/authoring';
import { buildTemplateWorkspace } from '../../templates/authoring';
import {
  loadUserTemplates,
  persistUserTemplates,
  type UserTemplateRecord,
} from '../../app/persistence';
import { showToast } from '../../ui/toast';
import styles from './TemplateGallery.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Insert the template into the editor (BlockCoding decides replace vs append). */
  onUse: (workspaceJson: object, name: string) => void;
  /** Load the template AND immediately run it in the sim. */
  onTry: (workspaceJson: object) => void;
  /** AI blocks unregistered until PROMPT E → kamera templates are gated. */
  aiEnabled?: boolean;
}

type RailKey = 'semua' | TemplateCollection | 'saya';

const RAIL: Array<{ key: RailKey; label: string }> = [
  { key: 'semua', label: 'Semua' },
  { key: 'gerak-dasar', label: COLLECTION_LABELS['gerak-dasar'] },
  { key: 'sensor', label: COLLECTION_LABELS.sensor },
  { key: 'ai-kamera', label: COLLECTION_LABELS['ai-kamera'] },
  { key: 'seni-suara', label: COLLECTION_LABELS['seni-suara'] },
  { key: 'tantangan', label: COLLECTION_LABELS.tantangan },
  { key: 'saya', label: 'Template Saya' },
];

/** Count blocks in a spec tree (for the "~N blok" chip). */
function countBlocks(program: BlockSpec[]): number {
  let n = 0;
  const walk = (spec: BlockSpec) => {
    n++;
    if (spec.inputs)
      for (const v of Object.values(spec.inputs))
        if (v && typeof v === 'object') walk(v as BlockSpec);
    if (spec.statements) for (const kids of Object.values(spec.statements)) kids.forEach(walk);
  };
  program.forEach(walk);
  return n;
}

export default function TemplateGallery({ open, onClose, onUse, onTry, aiEnabled = false }: Props) {
  const [rail, setRail] = useState<RailKey>('semua');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<BuiltinTemplate | null>(null);
  const [userTemplates, setUserTemplates] = useState<UserTemplateRecord[]>([]);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Load Template Saya whenever the gallery opens.
  useEffect(() => {
    if (!open) return;
    loadUserTemplates()
      .then(setUserTemplates)
      .catch(() => setUserTemplates([]));
    setSelected(null);
    const t = setTimeout(() => searchRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Esc to close (or back out of the detail sheet first).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (selected) setSelected(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, selected, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BUILTIN_TEMPLATES.filter((t) => {
      if (rail !== 'semua' && rail !== 'saya' && t.collection !== rail) return false;
      if (rail === 'saya') return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [rail, query]);

  const isGated = useCallback(
    (t: BuiltinTemplate) => (t.requires?.includes('kamera') ?? false) && !aiEnabled,
    [aiEnabled],
  );

  const workspaceOf = useCallback(
    (t: BuiltinTemplate): object => buildTemplateWorkspace(t.program),
    [],
  );

  const handleTry = useCallback(
    (t: BuiltinTemplate) => {
      onTry(workspaceOf(t));
      onClose();
    },
    [onTry, onClose, workspaceOf],
  );

  const handleUse = useCallback(
    (json: object, name: string) => {
      onUse(json, name);
      onClose();
    },
    [onUse, onClose],
  );

  const renameUser = useCallback(
    async (rec: UserTemplateRecord) => {
      const name = window.prompt('Nama baru:', rec.name);
      if (!name) return;
      const next = userTemplates.map((u) => (u.id === rec.id ? { ...u, name: name.trim() } : u));
      setUserTemplates(next);
      await persistUserTemplates(next);
    },
    [userTemplates],
  );

  const deleteUser = useCallback(
    async (rec: UserTemplateRecord) => {
      const next = userTemplates.filter((u) => u.id !== rec.id);
      setUserTemplates(next);
      await persistUserTemplates(next);
      showToast(`Dihapus: ${rec.name}`, 'info');
    },
    [userTemplates],
  );

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Galeri Template"
    >
      <div className={styles.modal}>
        <nav className={styles.rail}>
          <div className={styles.railTitle}>Template</div>
          {RAIL.map((r) => (
            <button
              key={r.key}
              className={`${styles.railBtn} ${rail === r.key ? styles.railBtnActive : ''}`}
              onClick={() => {
                setRail(r.key);
                setSelected(null);
              }}
            >
              {r.label}
            </button>
          ))}
        </nav>

        <div className={styles.main}>
          <div className={styles.header}>
            <h2>Galeri Template</h2>
            <input
              ref={searchRef}
              className={styles.search}
              placeholder="Cari template… (mis. balon, kotak, suara)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Cari template"
            />
            <button className={styles.closeBtn} onClick={onClose} aria-label="Tutup">
              ×
            </button>
          </div>

          {rail === 'saya' ? (
            <div className={styles.grid}>
              {userTemplates.length === 0 ? (
                <div className={styles.empty}>
                  Belum ada Template Saya. Pilih blok di editor lalu “Simpan sebagai template”.
                </div>
              ) : (
                userTemplates.map((u) => (
                  <div key={u.id} className={styles.card}>
                    <div className={styles.cardBody}>
                      <div className={styles.cardTitle}>{u.name}</div>
                      <div className={styles.cardDesc}>
                        Disimpan {new Date(u.savedAt).toLocaleDateString('id-ID')}
                      </div>
                      <div className={styles.cardMeta}>
                        <button
                          className={styles.btn + ' ' + styles.btnGhost}
                          onClick={() => handleUse(u.workspace as object, u.name)}
                        >
                          Pakai
                        </button>
                        <span className={styles.overflowMenu}>
                          <button className={styles.miniBtn} onClick={() => renameUser(u)}>
                            Ubah nama
                          </button>
                          <button className={styles.miniBtn} onClick={() => deleteUser(u)}>
                            Hapus
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className={styles.grid}>
              {filtered.length === 0 ? (
                <div className={styles.empty}>
                  Tidak ada template yang cocok. Coba kata kunci lain 🤖
                </div>
              ) : (
                filtered.map((t) => (
                  <button key={t.id} className={styles.card} onClick={() => setSelected(t)}>
                    <span
                      className={styles.thumb}
                      dangerouslySetInnerHTML={{ __html: t.thumbnail }}
                    />
                    <span className={styles.cardBody}>
                      <span className={styles.cardTitle}>{t.name}</span>
                      <span className={styles.cardDesc}>{t.description}</span>
                      <span className={styles.cardMeta}>
                        <span className={styles.dots} aria-label={`Tingkat ${t.difficulty}`}>
                          {[1, 2, 3].map((d) => (
                            <span
                              key={d}
                              className={`${styles.dot} ${d <= t.difficulty ? styles.dotOn : ''}`}
                            />
                          ))}
                        </span>
                        {isGated(t) && <span className={styles.chipAi}>butuh AI</span>}
                        {(t.requires ?? []).map((r) => (
                          <span key={r} className={styles.chipReq + ' ' + styles.chip}>
                            {REQUIREMENT_LABELS[r]}
                          </span>
                        ))}
                        <span className={styles.count}>~{countBlocks(t.program)} blok</span>
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {selected && (
            <DetailSheet
              template={selected}
              gated={isGated(selected)}
              onBack={() => setSelected(null)}
              onTry={() => handleTry(selected)}
              onUse={() => handleUse(workspaceOf(selected), selected.name)}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DetailSheet({
  template,
  gated,
  onBack,
  onTry,
  onUse,
}: {
  template: BuiltinTemplate;
  gated: boolean;
  onBack: () => void;
  onTry: () => void;
  onUse: () => void;
}) {
  return (
    <div className={styles.sheet}>
      <div className={styles.sheetHead}>
        <button className={styles.back} onClick={onBack}>
          ← Kembali
        </button>
        <h3>{template.name}</h3>
      </div>
      <div className={styles.sheetBody}>
        <span
          className={styles.sheetPreview}
          dangerouslySetInnerHTML={{ __html: template.thumbnail }}
        />
        <div>
          <p className={styles.sheetDesc}>{template.description}</p>
          <div className={styles.learnTitle}>Apa yang dipelajari</div>
          <ul className={styles.learn}>
            {template.learn.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className={styles.sheetFoot}>
        {gated ? (
          <button
            className={`${styles.btn} ${styles.btnAi}`}
            disabled
            title="Aktifkan kamera AI di PROMPT E"
          >
            Aktifkan AI dulu
          </button>
        ) : (
          <>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={onTry}>
              ▶ Coba di Simulator
            </button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onUse}>
              Pakai Template
            </button>
          </>
        )}
      </div>
    </div>
  );
}
