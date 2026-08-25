// src/pages/academy/lessons/index.tsx
//
// ROUTE /academy/lessons — loading state, then All Lessons with two switchable
// views: FOLDER (grouped by theme) and GRID (flat cards). Level filter + search
// apply to both. Guests see only live Basics; a valid code unlocks everything.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../../../styles/Academy.module.css';
import {
  getGroups,
  getLessons,
  type Group,
  type Lesson,
} from '../../../data/lessons';
import {
  loadSession,
  loadFolderState,
  setFolderOpen,
  loadHelperDismissed,
  setHelperDismissed,
} from '../../../academy/store';
import { AcademyTopBar } from '../../../components/academy/AcademyTopBar';
import { FolderGroup } from '../../../components/academy/FolderGroup';
import { LessonCard } from '../../../components/academy/LessonCard';
import { MascotHelper } from '../../../components/academy/MascotHelper';
import {
  LevelSelect,
  SearchBox,
  ViewToggle,
  type ViewMode,
} from '../../../components/academy/controls';
import { SubscribeModal } from '../../../components/academy/SubscribeModal';

import refreshImg from '../../../assets/refresh.png';

export default function AllLessons() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(false);

  const [groups, setGroups] = useState<Group[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [view, setView] = useState<ViewMode>('folder');
  const [level, setLevel] = useState('All');
  const [query, setQuery] = useState('');

  const [folderOpen, setFolderOpenState] = useState<Record<string, boolean>>({});
  const [showHelper, setShowHelper] = useState(false);
  const [locked, setLocked] = useState<Lesson | null>(null);

  // Gate check + initial load (with a short, calming loading beat).
  useEffect(() => {
    let alive = true;
    (async () => {
      const session = await loadSession();
      if (!session.mode) {
        router.replace('/academy');
        return;
      }
      const isGuest = session.mode === 'guest';
      const [gs, ls, folders, helperDismissed] = await Promise.all([
        getGroups(),
        getLessons({ guest: isGuest }),
        loadFolderState(),
        loadHelperDismissed(),
      ]);
      if (!alive) return;
      setGuest(isGuest);
      setGroups(gs);
      setLessons(ls);
      setFolderOpenState(folders);
      setShowHelper(!helperDismissed);
      // Give the loading mascot a brief, deliberate moment.
      setTimeout(() => alive && setLoading(false), 650);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-side filtered view of the already-loaded (access-scoped) lessons.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return lessons.filter((l) => {
      if (level !== 'All' && l.levelType !== level) return false;
      if (needle) {
        const hay = `${l.title} ${l.concepts.join(' ')}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [lessons, level, query]);

  const byGroup = useMemo(() => {
    const map: Record<string, Lesson[]> = {};
    for (const l of filtered) (map[l.group] ??= []).push(l);
    return map;
  }, [filtered]);

  // Groups that actually have lessons for the current access scope.
  const visibleGroups = useMemo(
    () => groups.filter((g) => lessons.some((l) => l.group === g.id)),
    [groups, lessons],
  );

  function isOpen(groupId: string) {
    return folderOpen[groupId] ?? true; // default expanded
  }

  function toggleFolder(groupId: string) {
    const next = !isOpen(groupId);
    setFolderOpenState((s) => ({ ...s, [groupId]: next }));
    void setFolderOpen(groupId, next);
  }

  function dismissHelper() {
    setShowHelper(false);
    void setHelperDismissed(true);
  }

  if (loading) {
    return (
      <>
        <Head>
          <title>Robotku Academy — Memuat…</title>
        </Head>
        <div className={`${styles.page} ${styles.loading}`}>
          <img
            className={styles.loadingMascot}
            src={typeof refreshImg === 'string' ? refreshImg : refreshImg.src}
            alt="Maskot Robotku sedang memuat pelajaran"
          />
          <div className={styles.loadingText}>
            <span>Menyiapkan pelajaran</span>
            <span className={styles.dots} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Robotku Academy — Semua Pelajaran</title>
      </Head>
      <div className={styles.page}>
        <AcademyTopBar org={guest ? 'Tamu' : 'Robotku School'} />

        <div className={styles.container}>
          <div className={styles.pageHead}>
            <h1 className={styles.pageTitle}>Semua Pelajaran</h1>
            <p className={styles.pageSub}>
              {guest
                ? 'Mode tamu — menampilkan Robotku Basics gratis. Masukkan kode akses untuk seluruh materi.'
                : 'Jelajahi seluruh katalog Robotku Academy berdasarkan tema atau level.'}
            </p>
          </div>

          <div className={styles.controls}>
            <LevelSelect value={level} onChange={setLevel} />
            <SearchBox value={query} onChange={setQuery} />
            <ViewToggle value={view} onChange={setView} />
          </div>

          {view === 'folder' ? (
            <div>
              {visibleGroups.map((g) => (
                <FolderGroup
                  key={g.id}
                  group={g}
                  lessons={byGroup[g.id] ?? []}
                  open={isOpen(g.id)}
                  onToggle={() => toggleFolder(g.id)}
                  onLocked={setLocked}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className={styles.folderEmpty}>Tidak ada pelajaran yang cocok dengan filter.</p>
          ) : (
            <div className={styles.gridWrap}>
              {filtered.map((l) => {
                const g = groups.find((gr) => gr.id === l.group);
                return (
                  <LessonCard key={l.id} lesson={l} emoji={g?.emoji} onLocked={setLocked} />
                );
              })}
            </div>
          )}
        </div>

        {showHelper && (
          <MascotHelper
            onDismiss={dismissHelper}
            onTour={() => {
              dismissHelper();
              alert(
                'Tutorial singkat:\n• Gunakan Folder untuk menjelajah per tema.\n• Gunakan Grid untuk melihat semua kartu.\n• Saring dengan Level atau cari nama pelajaran.',
              );
            }}
          />
        )}

        {locked && (
          <SubscribeModal
            lesson={locked}
            onClose={() => setLocked(null)}
          />
        )}
      </div>
    </>
  );
}
