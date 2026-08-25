// src/pages/academy/index.tsx
//
// ROUTE /academy — Access Gate.
// Two columns: "Punya kode akses?" (code input + free Basics preview) and
// "Baru di sini?" (continue as guest / contact). Validating a code unlocks the
// full catalog; guests see only live Basics. Session persists to IndexedDB.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../../styles/Academy.module.css';
import { getLessons, type Lesson } from '../../data/lessons';
import { enterAsGuest, unlockWithCode } from '../../academy/store';
import { Thumb } from '../../components/academy/Thumb';
import { LevelChip, ConceptChip } from '../../components/academy/chips';

const CONTACT_EMAIL = 'team@robotku.id';

export default function AcademyGate() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [basics, setBasics] = useState<Lesson[]>([]);

  // Free Basics preview (live Basics only — same set a guest can open).
  useEffect(() => {
    getLessons({ guest: true }).then((ls) => setBasics(ls.slice(0, 6)));
  }, []);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const ok = await unlockWithCode(code);
    setBusy(false);
    if (ok) router.push('/academy/lessons');
    else setError('Kode akses tidak valid. Coba lagi atau lanjut sebagai tamu.');
  }

  async function continueAsGuest() {
    await enterAsGuest();
    router.push('/academy/lessons');
  }

  return (
    <>
      <Head>
        <title>Robotku Academy — Akses</title>
      </Head>
      <div className={styles.page}>
        <div className={styles.gateHeader}>
          <img
            className={styles.gateLogo}
            src="/brand/Robotku-Mascot-Logo-Horizontal.png"
            alt="Robotku Academy"
          />
          <h1 className={styles.gateWelcome}>SELAMAT DATANG DI ROBOTKU ACADEMY!</h1>
        </div>

        <div className={styles.container}>
          <div className={styles.gateGrid}>
            {/* Left — access code + Basics preview */}
            <section className={styles.gateCol}>
              <h2 className={styles.gateColTitle}>Punya Kode Akses?</h2>

              <form onSubmit={submitCode}>
                <div className={styles.codeField}>
                  <input
                    className={styles.codeInput}
                    type={showCode ? 'text' : 'password'}
                    placeholder="Masukkan kode akses"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="off"
                    aria-label="Kode akses"
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowCode((s) => !s)}
                    aria-label={showCode ? 'Sembunyikan kode' : 'Tampilkan kode'}
                  >
                    {showCode ? <EyeOff /> : <Eye />}
                  </button>
                </div>

                {error && <p className={styles.gateError}>{error}</p>}

                <button
                  type="submit"
                  className={`${styles.btnPrimary} ${styles.fullBtn}`}
                  disabled={busy}
                >
                  {busy ? 'Memeriksa…' : 'Akses Robotku Academy!'}
                </button>
              </form>

              <p className={styles.previewLabel}>Pratinjau Robotku Basics (gratis)</p>
              <div className={styles.previewGrid}>
                {basics.map((l) => (
                  <div key={l.id} className={styles.tile}>
                    <Thumb src={l.thumbnail} alt={l.title} emoji="🤖" />
                    <div className={styles.tileBody}>
                      <div className={styles.tileTitle}>
                        {l.number ? `${l.number}. ${l.title}` : l.title}
                      </div>
                      <div className={styles.tileMetaRow}>
                        <LevelChip level={l.levelType} />
                      </div>
                      <div className={styles.tileMetaRow}>
                        {l.concepts.slice(0, 2).map((c) => (
                          <ConceptChip key={c} concept={c} />
                        ))}
                      </div>
                      <span className={styles.publicLink}>Public Link ↗</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Right — guest / contact */}
            <section className={styles.gateCol}>
              <h2 className={styles.gateColTitle}>Baru di sini?</h2>
              <p className={styles.gateColSub}>
                Coba 6 pelajaran Robotku Basics tanpa langganan! Untuk seluruh materi,
                hubungi <strong>{CONTACT_EMAIL}</strong>.
              </p>
              <div className={styles.gateActions}>
                <button className={`${styles.btnOutline} ${styles.fullBtn}`} onClick={continueAsGuest}>
                  Lanjut sebagai Tamu
                </button>
                <a
                  className={`${styles.btnDark} ${styles.fullBtn}`}
                  href={`mailto:${CONTACT_EMAIL}`}
                >
                  Hubungi Kami
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}
