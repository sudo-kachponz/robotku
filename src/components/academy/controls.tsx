// src/components/academy/controls.tsx
//
// Filter + view controls for the All Lessons page: level dropdown, search box,
// and the Folder/Grid view toggle (active = filled indigo pill).

import styles from '../../styles/Academy.module.css';
import { LEVEL_OPTIONS } from '../../data/lessons';

export type ViewMode = 'folder' | 'grid';

export function LevelSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      className={styles.select}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Pilih Level"
    >
      {LEVEL_OPTIONS.map((opt) => (
        <option key={opt} value={opt}>
          {opt === 'All' ? 'Semua Level' : opt}
        </option>
      ))}
    </select>
  );
}

export function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className={styles.searchBox}>
      <svg
        className={styles.searchIcon}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        className={styles.searchInput}
        type="search"
        placeholder="Cari nama pelajaran…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Cari nama pelajaran"
      />
    </div>
  );
}

export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className={styles.viewToggle} role="group" aria-label="Pilih tampilan">
      <button
        className={`${styles.viewBtn} ${value === 'folder' ? styles.viewBtnActive : ''}`}
        onClick={() => onChange('folder')}
        aria-pressed={value === 'folder'}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
        Folder
      </button>
      <button
        className={`${styles.viewBtn} ${value === 'grid' ? styles.viewBtnActive : ''}`}
        onClick={() => onChange('grid')}
        aria-pressed={value === 'grid'}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        Grid
      </button>
    </div>
  );
}
