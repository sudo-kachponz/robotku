// src/components/academy/QuickTutorialModal.tsx
//
// Interactive PPT Quick Tutorial Modal for Robotku Academy — matching reference benchmark screenshots.

import { useState } from 'react';
import refreshImg from '../../assets/refresh.png';
import styles from '../../styles/AcademyDetail.module.css';
import pageStyles from '../../styles/Academy.module.css';

export function QuickTutorialModal({ onClose }: { onClose: () => void }) {
  const [slide, setSlide] = useState(1);
  const TOTAL_SLIDES = 5;

  function next() {
    setSlide((s) => Math.min(s + 1, TOTAL_SLIDES));
  }

  function prev() {
    setSlide((s) => Math.max(s - 1, 1));
  }

  return (
    <div className={styles.tutorialModalOverlay} onClick={onClose}>
      <div className={styles.tutorialModalCard} onClick={(e) => e.stopPropagation()}>
        {/* Top Close Button */}
        <button className={styles.tutorialCloseBtn} onClick={onClose} aria-label="Tutup Tutorial">
          ✕
        </button>

        {/* Slide Stage */}
        <div className={styles.tutorialStage}>
          {slide === 1 && (
            <div className={styles.tutorialSlideContent}>
              <img
                src={typeof refreshImg === 'string' ? refreshImg : refreshImg.src}
                alt="Maskot Robotku"
                className={styles.tutorialMascotImg}
              />
              <div className={styles.tutorialTextGroup}>
                <span className={styles.tutorialTag}>SELAMAT DATANG</span>
                <h2 className={styles.tutorialHeading}>Welcome to Robotku Academy!</h2>
                <p className={styles.tutorialSub}>
                  Klik panah di bawah atau geser slide untuk mengikuti panduan cepat 30 detik.
                </p>
              </div>
            </div>
          )}

          {slide === 2 && (
            <div className={styles.tutorialSlideContent}>
              <div className={styles.tutorialTextGroupCenter}>
                <span className={styles.tutorialTag}>MODUL & MEKANISME</span>
                <h2 className={styles.tutorialHeading}>Robotku Basics & Mechanism Tutorials</h2>
                <p className={styles.tutorialSub}>
                  <strong>Robotku Basics</strong> mencakup 6 materi dasar yang wajib dipahami untuk
                  merakit & memrogram robot pertama kamu. Mekanisme lain dapat dibongkar pasang
                  secara modular!
                </p>
                <div className={styles.tutorialDiagramGrid}>
                  <div className={styles.diagramBox}>
                    <span className={styles.diagramBadge}>BASIC 1-6</span>
                    <h4>Robotku Basics</h4>
                    <p>Konstruksi, Elektronika & Block Coding</p>
                  </div>
                  <div className={styles.diagramBox}>
                    <span className={styles.diagramBadge}>MODULAR</span>
                    <h4>Robotku Mechanisms</h4>
                    <p>Belt & Pulley, Winch, Catapult, Slider & Crank</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {slide === 3 && (
            <div className={styles.tutorialSlideContent}>
              <div className={styles.tutorialTextGroupCenter}>
                <span className={styles.tutorialTag}>KATEGORI FOLDER</span>
                <h2 className={styles.tutorialHeading}>Subject & Use-Case Categorization</h2>
                <p className={styles.tutorialSub}>
                  Semua materi dikelompokkan secara terstruktur berdasarkan mata pelajaran dan topik
                  seperti <strong>Sciences</strong>, <strong>Robotics & Makerspace</strong>,{' '}
                  <strong>AI & Machine Learning</strong>, serta <strong>Sustainability</strong>!
                </p>
                <div className={styles.subjectPillsRow}>
                  <span className={styles.subPill}>🧲 Sciences</span>
                  <span className={styles.subPill}>🛠️ Robotics</span>
                  <span className={styles.subPill}>💻 AI & Coding</span>
                  <span className={styles.subPill}>♻️ Sustainability</span>
                  <span className={styles.subPill}>📐 Maths</span>
                </div>
              </div>
            </div>
          )}

          {slide === 4 && (
            <div className={styles.tutorialSlideContent}>
              <div className={styles.tutorialTextGroupCenter}>
                <span className={styles.tutorialTag}>STRUKTUR PELAJARAN</span>
                <h2 className={styles.tutorialHeading}>Interactive Learning Segments</h2>
                <p className={styles.tutorialSub}>
                  Setiap pelajaran dirancang interaktif dengan 4 segmen utama:
                </p>
                <div className={styles.segmentsFlow}>
                  <div className={styles.segItem}>
                    <span className={styles.segNum}>1</span>
                    <span>Introduksi</span>
                  </div>
                  <span className={styles.segArrow}>→</span>
                  <div className={styles.segItem}>
                    <span className={styles.segNum}>2</span>
                    <span>Slide Materi</span>
                  </div>
                  <span className={styles.segArrow}>→</span>
                  <div className={styles.segItem}>
                    <span className={styles.segNum}>3</span>
                    <span>Aktivitas & Challenge</span>
                  </div>
                  <span className={styles.segArrow}>→</span>
                  <div className={styles.segItem}>
                    <span className={styles.segNum}>4</span>
                    <span>Info & Tips Pengajar</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {slide === 5 && (
            <div className={styles.tutorialSlideContent}>
              <img
                src={typeof refreshImg === 'string' ? refreshImg : refreshImg.src}
                alt="Maskot Robotku Ready"
                className={styles.tutorialMascotImgLarge}
              />
              <div className={styles.tutorialTextGroup}>
                <span className={styles.tutorialTag}>SIAP BELAJAR!</span>
                <h2 className={styles.tutorialHeading}>Kamu Siap Memulai!</h2>
                <p className={styles.tutorialSub}>
                  Pilih pelajaran mana saja, nikmati materi presentasinya, dan langsung uji di
                  Coding Studio!
                </p>
                <button className={pageStyles.btnPink} onClick={onClose} style={{ marginTop: 12 }}>
                  Mulai Belajar Sekarang 🚀
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Slide Navigation Bar */}
        <div className={styles.tutorialFooterBar}>
          <div className={styles.tutorialNavControls}>
            <button className={styles.tutorialNavBtn} onClick={prev} disabled={slide === 1}>
              ❮
            </button>
            <span className={styles.tutorialCounter}>
              {slide} / {TOTAL_SLIDES}
            </span>
            <button
              className={styles.tutorialNavBtn}
              onClick={next}
              disabled={slide === TOTAL_SLIDES}
            >
              ❯
            </button>
          </div>
          <span className={styles.tutorialBrandText}>Robotku Interactive Tutorial</span>
        </div>
      </div>
    </div>
  );
}
