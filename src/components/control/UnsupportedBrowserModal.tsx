// src/components/control/UnsupportedBrowserModal.tsx
//
// Unsupported Browser Modal — displays when Web Bluetooth API is unavailable
// or disabled on the current browser. Translated into Indonesian with
// Robotku Design System identity & mascot.

import cantConnectImg from '../../assets/cantconnect.png';
import styles from './UnsupportedBrowserModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function UnsupportedBrowserModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modalCard}
        role="dialog"
        aria-label="Browser Tidak Didukung"
        onClick={(e) => e.stopPropagation()}
      >
        <button className={styles.closeBtn} onClick={onClose} aria-label="Tutup modal">
          ✕
        </button>

        <h2 className={styles.modalTitle}>Browser Tidak Didukung</h2>

        <div className={styles.modalContent}>
          <div className={styles.textContent}>
            <p className={styles.errorNotice}>
              <strong>Galat Bluetooth:</strong> Web Bluetooth API telah dinonaktifkan atau tidak didukung pada browser ini.
            </p>

            <p className={styles.helpLink}>
              Cek{' '}
              <a
                href="https://caniuse.com/web-bluetooth"
                target="_blank"
                rel="noreferrer"
                className={styles.anchor}
              >
                di sini
              </a>{' '}
              untuk melihat apakah browser kamu mendukung fitur ini.
            </p>
          </div>

          <div className={styles.mascotWrapper}>
            <img
              src={typeof cantConnectImg === 'string' ? cantConnectImg : cantConnectImg.src}
              alt="Ilustrasi Bluetooth Tidak Dapat Terhubung"
              className={styles.mascotImg}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
