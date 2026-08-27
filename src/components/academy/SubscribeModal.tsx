// src/components/academy/SubscribeModal.tsx
//
// Shown when a locked (subscribe) lesson is clicked instead of navigating.

import styles from '../../styles/Academy.module.css';
import type { Lesson } from '../../data/lessons';

const CONTACT_EMAIL = 'team@robotku.id';

export function SubscribeModal({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Perlu langganan"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalIcon}>🔒</div>
        <h3 className={styles.modalTitle}>Pelajaran Berlangganan</h3>
        <p className={styles.modalText}>
          &quot;<strong>{lesson.title}</strong>&quot; tersedia untuk anggota berlangganan. Hubungi
          tim Robotku untuk membuka seluruh katalog.
        </p>
        <div className={styles.modalActions}>
          <a className={styles.btnPink} href={`mailto:${CONTACT_EMAIL}`}>
            Hubungi Kami
          </a>
          <button className={styles.btnOutline} onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
