// src/components/academy/MascotHelper.tsx
//
// Dismissible mascot helper bubble shown on first visit to All Lessons. Clicking
// "Tutorial singkat" fires onTour(); dismissal is persisted by the parent.

import styles from '../../styles/Academy.module.css';

export function MascotHelper({
  onDismiss,
  onTour,
}: {
  onDismiss: () => void;
  onTour: () => void;
}) {
  return (
    <div className={styles.helper}>
      <div className={styles.helperBubble}>
        <p className={styles.helperText}>
          Selamat datang! Butuh bantuan? Klik aku untuk tutorial singkat.
        </p>
        <div className={styles.helperActions}>
          <button className={`${styles.btnPrimary} ${styles.btnSm}`} onClick={onTour}>
            Tutorial singkat
          </button>
          <button className={`${styles.btnOutline} ${styles.btnSm}`} onClick={onDismiss}>
            Tutup
          </button>
        </div>
      </div>
      <img className={styles.helperMascot} src="/brand/Pose2.png" alt="Maskot Robotku" />
    </div>
  );
}
