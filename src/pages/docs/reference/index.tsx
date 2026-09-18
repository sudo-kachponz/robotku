// src/pages/docs/reference/index.tsx
//
// Reference index (py2.md §2.5): every API grouped by category with a client-side
// fuzzy search. Fully static — data baked at build from the docs registry.

import { useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import type { GetStaticProps } from 'next';
import { docsByCategory } from '../../../pythongen/docs/registry';
import { getCategoryColor } from '../../../visual/categoryColors';
import styles from './reference.module.css';

interface Item {
  slug: string;
  title: string;
  summary: string;
}
interface Cat {
  name: string;
  color: string;
  items: Item[];
}

export const getStaticProps: GetStaticProps = async () => {
  const byCat = docsByCategory();
  const categories: Cat[] = Object.entries(byCat).map(([name, entries]) => ({
    name,
    color: getCategoryColor(name),
    items: entries.map((e) => ({ slug: e.slug, title: e.title, summary: e.summary })),
  }));
  return { props: { categories } };
};

export default function ReferenceIndex({ categories }: { categories: Cat[] }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!query) return categories;
    return categories
      .map((c) => ({
        ...c,
        items: c.items.filter(
          (i) =>
            i.title.toLowerCase().includes(query) ||
            i.summary.toLowerCase().includes(query) ||
            i.slug.toLowerCase().includes(query),
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, query]);

  const firstMatch = filtered[0]?.items[0]?.slug;

  return (
    <>
      <Head>
        <title>Referensi Python — Robotku</title>
        <meta name="description" content="Dokumentasi semua blok & fungsi Python Robotku." />
      </Head>
      <main className={styles.page}>
        <div className={styles.container}>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <span>Docs</span>
            <span>›</span>
            <span className={styles.crumbNow}>Referensi</span>
          </nav>
          <h1 className={styles.title}>Referensi Python</h1>
          <p className={styles.lead}>Semua blok & fungsi yang bisa kamu pakai di mode Python.</p>

          <form
            className={styles.searchRow}
            onSubmit={(e) => {
              e.preventDefault();
              if (firstMatch) window.location.href = `/docs/reference/${firstMatch}/`;
            }}
          >
            <input
              className={styles.search}
              placeholder="Cari… (mis. forward, sensor, tunggu)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </form>

          {filtered.length === 0 && <p className={styles.empty}>Tidak ada hasil untuk “{q}”.</p>}

          {filtered.map((c) => (
            <section key={c.name} className={styles.catSection}>
              <h2 className={styles.catTitle} style={{ ['--cat' as string]: c.color }}>
                {c.name}
              </h2>
              <div className={styles.grid}>
                {c.items.map((i) => (
                  <Link
                    key={i.slug}
                    href={`/docs/reference/${i.slug}/`}
                    className={styles.card}
                    style={{ ['--cat' as string]: c.color }}
                  >
                    <span className={styles.cardTitle}>{i.title}</span>
                    <span className={styles.cardSummary}>{i.summary}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
