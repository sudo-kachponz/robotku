// src/components/control/UnsupportedBrowserModal.tsx
//
// Unsupported Browser / Platform Capability Modal.

import { useEffect, useState } from 'react';
import cantConnectImg from '../../assets/cantconnect.png';
import { getCapabilities, type BrowserCapabilities } from '../../transport/capabilities';
import styles from './UnsupportedBrowserModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function UnsupportedBrowserModal({ isOpen, onClose }: Props) {
  const [caps, setCaps] = useState<BrowserCapabilities | null>(null);

  useEffect(() => {
    setCaps(getCapabilities());
  }, []);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modalCard}
        role="dialog"
        aria-label="Informasi Kapabilitas Perangkat"
        onClick={(e) => e.stopPropagation()}
      >
        <button className={styles.closeBtn} onClick={onClose} aria-label="Tutup modal">
          ✕
        </button>

        <h2 className={styles.modalTitle}>Status Koneksi Perangkat</h2>

        <div className={styles.modalContent}>
          <div className={styles.textContent}>
            {!caps?.secureContext && (
              <div className={styles.warningBox}>
                ⚠️ <strong>Peringatan HTTP:</strong> Aplikasi dibuka tanpa HTTPS (non-secure context). Browser memblokir fitur Bluetooth & Serial demi keamanan.
              </div>
            )}

            <div className={styles.sectionHeader}>
              Fitur Perangkat Ini:
            </div>

            <div className={styles.featureList}>
              <div className={styles.featureItem}>
                <span className={styles.featureLabel}>Web Bluetooth</span>
                <span className={caps?.ble ? styles.badgeSuccess : styles.badgeError}>
                  {caps?.ble ? '✅ Didukung' : '❌ Tidak didukung'}
                </span>
              </div>

              <div className={styles.featureItem}>
                <span className={styles.featureLabel}>Web Serial (USB)</span>
                <span className={caps?.serial ? styles.badgeSuccess : styles.badgeError}>
                  {caps?.serial ? '✅ Didukung' : '❌ Tidak didukung'}
                </span>
              </div>

              <div className={styles.featureItem}>
                <span className={styles.featureLabel}>Platform OS</span>
                <span className={styles.badgeInfo}>
                  {caps?.platform === 'ios'
                    ? '📱 iOS (iPhone/iPad)'
                    : caps?.platform === 'android'
                      ? '📱 Android'
                      : '💻 Laptop / Desktop'}
                </span>
              </div>
            </div>

            <div className={styles.learningModeCard}>
              <h4 className={styles.learningModeTitle}>
                ✨ Mode Belajar Aktif!
              </h4>
              <p className={styles.learningModeText}>
                Kamu tetap bisa membuat program blok, menjalankan simulasi 2D/3D di layar, dan
                mengakses seluruh modul Academy di HP ini. Gunakan Chrome di laptop untuk menyambung
                langsung ke robot fisik.
              </p>
            </div>
          </div>

          <div className={styles.mascotWrapper}>
            <img
              src={typeof cantConnectImg === 'string' ? cantConnectImg : cantConnectImg.src}
              alt="Ilustrasi Status Koneksi Robotku"
              className={styles.mascotImg}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
