// src/pages/academy/lessons/[id].tsx
//
// ROUTE /academy/lessons/:id — Full Screen Presentation (PPT) Mode matching reference benchmark.
// Fullscreen slide canvas, floating swipe prompt, bottom slide navigation, and quick access tabs.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import page from '../../../styles/Academy.module.css';
import styles from '../../../styles/AcademyDetail.module.css';
import { getLesson, type Lesson } from '../../../data/lessons';
import {
  loadLessonProgress,
  saveLessonProgress,
  type LessonProgress,
} from '../../../academy/store';

export default function LessonDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined);
  const [progress, setProgress] = useState<LessonProgress>({});
  const [slideIndex, setSlideIndex] = useState(0);
  const [showPrompt, setShowPrompt] = useState(true);
  const [activeTab, setActiveTab] = useState<'ppt' | 'video' | 'practice'>('ppt');

  const TOTAL_SLIDES = 8; // stub for presentation slide count

  useEffect(() => {
    if (typeof id !== 'string') return;
    let alive = true;
    (async () => {
      const [l, p] = await Promise.all([getLesson(id), loadLessonProgress(id)]);
      if (!alive) return;
      setLesson(l ?? null);
      setProgress(p);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  async function mark(patch: Partial<LessonProgress>) {
    if (typeof id !== 'string') return;
    setProgress(await saveLessonProgress(id, patch));
  }

  function nextSlide() {
    setSlideIndex((i) => {
      const next = Math.min(i + 1, TOTAL_SLIDES - 1);
      if (next === TOTAL_SLIDES - 1 && !progress.slidesViewed) void mark({ slidesViewed: true });
      return next;
    });
  }

  function prevSlide() {
    setSlideIndex((i) => Math.max(i - 1, 0));
  }

  if (lesson === undefined) {
    return (
      <div className={`${page.page} ${page.loading}`}>
        <div className={page.loadingText}>Memuat presentasi…</div>
      </div>
    );
  }

  if (lesson === null) {
    return (
      <div className={page.page}>
        <div className={styles.wrap}>
          <Link href="/academy/lessons" className={styles.backLink}>
            ← Kembali ke Semua Pelajaran
          </Link>
          <h1 className={styles.title}>Pelajaran tidak ditemukan</h1>
        </div>
      </div>
    );
  }

  const content = lesson.content ?? {};
  const title = lesson.number ? `${lesson.number}. ${lesson.title}` : lesson.title;

  return (
    <>
      <Head>
        <title>{`${lesson.title} — Robotku Academy Presentation`}</title>
      </Head>
      <div className={styles.pptFullscreenPage}>
        {/* Floating Top Banner Prompt */}
        {showPrompt && (
          <div className={styles.floatingPrompt}>
            <span>Swipe or press right to see more!</span>
            <button
              className={styles.promptClose}
              onClick={() => setShowPrompt(false)}
              aria-label="Tutup petunjuk"
            >
              ✕
            </button>
          </div>
        )}

        {/* Top Header Bar */}
        <header className={styles.pptHeader}>
          <div className={styles.pptHeaderLeft}>
            <button
              className={styles.backBtn}
              onClick={() => router.push('/academy/lessons')}
              title="Kembali ke Katalog"
            >
              ←
            </button>
            <img
              src="/brand/Robotku-Mascot-Logo-Horizontal.png"
              alt="Robotku School"
              className={styles.pptLogo}
            />
            <span className={styles.pptTitle}>ROBOTKU ACADEMY ({title})</span>
          </div>

          <div className={styles.pptHeaderRight}>
            <div className={styles.modeTabs}>
              <button
                className={`${styles.modeTab} ${activeTab === 'ppt' ? styles.modeTabActive : ''}`}
                onClick={() => setActiveTab('ppt')}
              >
                📊 PPT
              </button>
              {content.videoEmbed && (
                <button
                  className={`${styles.modeTab} ${activeTab === 'video' ? styles.modeTabActive : ''}`}
                  onClick={() => setActiveTab('video')}
                >
                  🎬 Video
                </button>
              )}
              <Link
                className={`${styles.modeTab} ${styles.modeTabPink}`}
                href={{
                  pathname: '/control/modes/code',
                  query: content.practiceProjectId
                    ? { project: content.practiceProjectId }
                    : undefined,
                }}
              >
                ⚡ Praktik Studio
              </Link>
            </div>
            <button
              className={styles.closeFullscreenBtn}
              onClick={() => router.push('/academy/lessons')}
              title="Tutup Presentasi"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Main Presentation Stage */}
        <main className={styles.pptStage}>
          {activeTab === 'ppt' ? (
            <div className={styles.slideCanvas}>
              {content.slides ? (
                <iframe
                  className={styles.slideIframe}
                  src={content.slides}
                  title="Slide Pelajaran"
                  allowFullScreen
                />
              ) : (
                <div className={styles.slidePlaceholder}>
                  <div className={styles.slideSlideCover}>
                    <h2 className={styles.slideCoverTitle}>Robotku Academy</h2>
                    <h1 className={styles.slideCoverMain}>{title}</h1>
                    <p className={styles.slideCoverSub}>
                      ({lesson.levelType} · Lesson {lesson.number ?? 1})
                    </p>
                    <div className={styles.slideCoverMascot}>🤖</div>
                    <p className={styles.slideNotice}>(15 minutes)</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.slideCanvas}>
              {content.videoEmbed ? (
                <iframe
                  className={styles.slideIframe}
                  src={content.videoEmbed}
                  title="Video Pelajaran"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className={styles.slidePlaceholder}>
                  <p>Video materi belum tersedia untuk pelajaran ini.</p>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Bottom Navigation Control Bar */}
        <footer className={styles.pptControlBar}>
          <div className={styles.pptNavGroup}>
            <button
              className={styles.navArrowBtn}
              onClick={prevSlide}
              disabled={slideIndex === 0}
              title="Slide Sebelumnya"
            >
              ❮
            </button>
            <span className={styles.navCounter}>
              {slideIndex + 1} / {TOTAL_SLIDES}
            </span>
            <button
              className={styles.navArrowBtn}
              onClick={nextSlide}
              disabled={slideIndex === TOTAL_SLIDES - 1}
              title="Slide Berikutnya"
            >
              ❯
            </button>
          </div>

          <div className={styles.pptBrandGroup}>
            <span className={styles.googleSlidesBrand}>Google Slides</span>
          </div>
        </footer>
      </div>
    </>
  );
}
