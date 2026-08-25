// src/components/academy/LessonCard.tsx
//
// Full lesson card for the GRID view. White surface for thumbnail/text
// readability. The whole card is clickable → lesson detail, unless it is a
// subscribe-locked lesson, in which case onLocked() fires instead.

import { useRouter } from 'next/router';
import type { Lesson } from '../../data/lessons';
import styles from '../../styles/Academy.module.css';
import { Thumb } from './Thumb';
import { StatusChip, LevelChip, ConceptChip } from './chips';

export function LessonCard({
  lesson,
  emoji,
  onLocked,
}: {
  lesson: Lesson;
  emoji?: string;
  onLocked?: (lesson: Lesson) => void;
}) {
  const router = useRouter();
  const locked = lesson.status === 'subscribe' || lesson.requiresSubscription;

  const title = lesson.number ? `${lesson.number}. ${lesson.title}` : lesson.title;

  function open() {
    if (locked) onLocked?.(lesson);
    else router.push(`/academy/lessons/${lesson.id}`);
  }

  return (
    <div
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <Thumb src={lesson.thumbnail} alt={lesson.title} emoji={emoji} />
      <div className={styles.cardBody}>
        <div className={styles.cardTitle}>{title}</div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Lesson Level / Type</span>
          <div className={styles.chipRow}>
            <LevelChip level={lesson.levelType} />
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Concepts</span>
          <div className={styles.chipRow}>
            {lesson.concepts.map((c) => (
              <ConceptChip key={c} concept={c} />
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Status</span>
          <div className={styles.chipRow}>
            <StatusChip status={lesson.status} />
          </div>
        </div>
      </div>
    </div>
  );
}
