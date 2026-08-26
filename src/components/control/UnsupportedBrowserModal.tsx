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
              <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', color: '#991B1B', fontSize: '13px', marginBottom: '12px', fontWeight: 600 }}>
                ⚠️ <strong>Peringatan HTTP:</strong> Aplikasi dibuka tanpa HTTPS (non-secure context). Browser memblokir fitur Bluetooth & Serial demi keamanan.
              </div>
            )}

            <p className={styles.errorNotice}>
              <strong>Fitur Perangkat Ini:</strong>
            </p>
            <ul style={{ paddingLeft: '18px', fontSize: '13px', lineHeight: '1.6', margin: '4px 0 16px', color: '#334155' }}>
              <li>Web Bluetooth: {caps?.ble ? '✅ Didukung' : '❌ Tidak didukung'}</li>
              <li>Web Serial (USB): {caps?.serial ? '✅ Didukung' : '❌ Tidak didukung'}</li>
              <li>Platform OS: {caps?.platform === 'ios' ? '📱 iOS (iPhone/iPad)' : caps?.platform === 'android' ? '📱 Android' : '💻 Laptop / Desktop'}</li>
            </ul>

            <div style={{ background: '#F0FDF4', border: '1.5px dashed #22C55E', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 6px', color: '#15803D', fontSize: '14px', fontWeight: 800 }}>✨ Mode Belajar Aktif!</h4>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#166534', lineHeight: '1.5' }}>
                Kamu tetap bisa membuat program blok, menjalankan simulasi 2D/3D di layar, dan mengakses seluruh modul Academy di HP ini. Gunakan Chrome di laptop untuk menyambung langsung ke robot fisik.
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
