// src/pages/academy/lessons/[id].tsx
//
// ROUTE /academy/lessons/:id — lesson detail shell (ringkas).
// Renders the lesson's content channels — slides (Google Slides / PDF.js target),
// video (YouTube no-cookie), a "Praktikkan di Coding Studio" deep-link, and an
// optional quiz — plus a progress bar. Progress (slides viewed / video ≥90% /
// quiz passed) is tracked in IndexedDB. Full authoring is out of scope here.

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
  progressPercent,
  type LessonProgress,
} from '../../../academy/store';
import { StatusChip, LevelChip } from '../../../components/academy/chips';

export default function LessonDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined);
  const [progress, setProgress] = useState<LessonProgress>({});
  const [slideIndex, setSlideIndex] = useState(0);

  const TOTAL_SLIDES = 8; // stub — real count comes from the slide source later.

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
        <div className={page.loadingText}>Memuat pelajaran…</div>
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
          <p className={styles.emptyNote}>Periksa kembali tautan yang kamu buka.</p>
        </div>
      </div>
    );
  }

  const content = lesson.content ?? {};
  const pct = progressPercent(progress);
  const title = lesson.number ? `${lesson.number}. ${lesson.title}` : lesson.title;

  return (
    <>
      <Head>
        <title>{`${lesson.title} — Robotku Academy`}</title>
      </Head>
      <div className={page.page}>
        <div className={styles.wrap}>
          <Link href="/academy/lessons" className={styles.backLink}>
            ← Kembali ke Semua Pelajaran
          </Link>

          <div className={styles.head}>
            <div className={styles.headMain}>
              <h1 className={styles.title}>{title}</h1>
              <div className={styles.metaRow}>
                <LevelChip level={lesson.levelType} />
                <StatusChip status={lesson.status} />
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className={styles.progress}>
            <div className={styles.progressTop}>
              <span className={styles.progressLabel}>Kemajuan belajar</span>
              <span className={styles.progressPct}>{pct}%</span>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Slides */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Materi (Slide)</h2>
              {progress.slidesViewed && <span className={styles.done}>✓ Selesai dilihat</span>}
            </div>
            <div className={styles.media}>
              {content.slides ? (
                <iframe
                  className={styles.mediaFrame}
                  src={content.slides}
                  title="Slide pelajaran"
                  allowFullScreen
                />
              ) : (
                <div className={styles.mediaPlaceholder}>
                  <SlidesIcon />
                  <span className={styles.mediaHint}>
                    Penampil slide (konversi .pptx→.pdf via PDF.js atau embed Google Slides) akan
                    tampil di sini.
                  </span>
                </div>
              )}
            </div>
            <div className={styles.slideNav}>
              <button className={`${page.btnOutline} ${page.btnSm}`} onClick={prevSlide} disabled={slideIndex === 0}>
                ← Sebelumnya
              </button>
              <span className={styles.slideCounter}>
                Slide {slideIndex + 1} / {TOTAL_SLIDES}
              </span>
              <button
                className={`${page.btnPrimary} ${page.btnSm}`}
                onClick={nextSlide}
                disabled={slideIndex === TOTAL_SLIDES - 1}
              >
                Berikutnya →
              </button>
            </div>
          </section>

          {/* Video */}
          {content.videoEmbed && (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Video</h2>
                {progress.videoWatched && <span className={styles.done}>✓ Ditonton</span>}
              </div>
              <div className={styles.media}>
                <iframe
                  className={styles.mediaFrame}
                  src={content.videoEmbed}
                  title="Video pelajaran"
                  allow="accelerometer; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className={styles.slideNav}>
                <span className={styles.slideCounter}>
                  Progres video dilacak sampai ≥ 90% (stub).
                </span>
                <button
                  className={`${page.btnPrimary} ${page.btnSm}`}
                  onClick={() => mark({ videoWatched: true })}
                >
                  Tandai selesai ditonton
                </button>
              </div>
            </section>
          )}

          {/* Practice deep-link */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Praktik</h2>
            <p className={styles.emptyNote} style={{ marginBottom: 14 }}>
              Terapkan pelajaran ini langsung di Coding Studio.
            </p>
            <div className={styles.practiceRow}>
              <Link
                className={page.btnPink}
                href={{
                  pathname: '/control/modes/code',
                  query: content.practiceProjectId
                    ? { project: content.practiceProjectId }
                    : undefined,
                }}
              >
                Praktikkan di Coding Studio →
              </Link>
            </div>
          </section>

          {/* Quiz (optional) */}
          {content.quizId && (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Kuis</h2>
                {progress.quizPassed && <span className={styles.done}>✓ Lulus</span>}
              </div>
              <p className={styles.emptyNote} style={{ marginBottom: 14 }}>
                Kuis singkat untuk menguji pemahaman (shell — implementasi menyusul).
              </p>
              <button
                className={`${page.btnPrimary} ${page.btnSm}`}
                onClick={() => mark({ quizPassed: true })}
              >
                Tandai kuis lulus
              </button>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function SlidesIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
