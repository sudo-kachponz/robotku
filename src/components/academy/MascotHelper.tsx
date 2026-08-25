// src/components/academy/MascotHelper.tsx
//
// Interactive mascot helper bubble using refresh.png mascot asset.
// Clicking the bubble or "Tutorial singkat" triggers the tutorial modal!

import refreshImg from '../../assets/refresh.png';
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
      <div className={styles.helperBubble} onClick={onTour} role="button" tabIndex={0}>
        <p className={styles.helperText}>
          Selamat datang! Butuh bantuan? Klik aku untuk tutorial singkat.
        </p>
        <div className={styles.helperActions}>
          <button
            className={`${styles.btnPrimary} ${styles.btnSm}`}
            onClick={(e) => {
              e.stopPropagation();
              onTour();
            }}
          >
            Tutorial singkat 🚀
          </button>
          <button
            className={`${styles.btnOutline} ${styles.btnSm}`}
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
          >
            Tutup
          </button>
        </div>
      </div>
      <img
        className={styles.helperMascot}
        src={typeof refreshImg === 'string' ? refreshImg : refreshImg.src}
        alt="Maskot Robotku Tutorial"
        onClick={onTour}
        role="button"
      />
    </div>
  );
}
