// src/components/academy/FolderGroup.tsx
//
// A "folder" panel for the FOLDER view: a rounded indigo-tinted container with
// a folder-TAB on the top-left (group title + emoji). Collapsible via the tab;
// the open/closed state is remembered by the parent (persisted to IndexedDB).

import type { Group, Lesson } from '../../data/lessons';
import styles from '../../styles/Academy.module.css';
import { LessonTile } from './LessonTile';

export function FolderGroup({
  group,
  lessons,
  open,
  onToggle,
  onLocked,
}: {
  group: Group;
  lessons: Lesson[];
  open: boolean;
  onToggle: () => void;
  onLocked?: (lesson: Lesson) => void;
}) {
  return (
    <section className={styles.folder}>
      <button className={styles.folderTab} onClick={onToggle} aria-expanded={open}>
        {group.emoji && <span className={styles.folderEmoji}>{group.emoji}</span>}
        <span>{group.title}</span>
        <span className={styles.folderCount}>({lessons.length})</span>
        <svg
          className={`${styles.folderChevron} ${open ? styles.folderChevronOpen : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open &&
        (lessons.length === 0 ? (
          <p className={styles.folderEmpty}>Tidak ada pelajaran yang cocok di folder ini.</p>
        ) : (
          <div className={styles.tileGrid}>
            {lessons.map((l) => (
              <LessonTile key={l.id} lesson={l} emoji={group.emoji} onLocked={onLocked} />
            ))}
          </div>
        ))}
    </section>
  );
}
