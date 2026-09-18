// src/pages/docs/reference/[...slug].tsx
//
// Standalone reference page for one API (py2.md §2.5). Fully static: paths come from
// the docs registry via getStaticPaths({ fallback: false }); no API route / SSR.
// Body is the shared <DocsBody> (loaded client-only because it pulls in Blockly for
// the block preview), so panel and page are identical. Opens without a robot.

import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { GetStaticPaths, GetStaticProps } from 'next';
import { allSlugs, getDoc } from '../../../pythongen/docs/registry';
import { getCategoryColor } from '../../../visual/categoryColors';
import type { DocEntry } from '../../../pythongen/docs/types';
import styles from './reference.module.css';

const DocsBody = dynamic(() => import('../../../components/docs/DocsBody'), { ssr: false });

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: allSlugs().map((slug) => ({ params: { slug: slug.split('/') } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const slug = ((params?.slug as string[]) ?? []).join('/');
  const entry = getDoc(slug);
  if (!entry) return { notFound: true };
  return { props: { entry } };
};

export default function ReferenceEntryPage({ entry }: { entry: DocEntry }) {
  const router = useRouter();
  const color = getCategoryColor(entry.category);
  return (
    <>
      <Head>
        <title>{`${entry.title} — Referensi Robotku`}</title>
        <meta name="description" content={entry.summary} />
      </Head>
      <main className={styles.page} style={{ ['--cat' as string]: color }}>
        <div className={styles.container}>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link href="/docs/reference/">Docs</Link>
            <span>›</span>
            <Link href="/docs/reference/">Referensi</Link>
            <span>›</span>
            <span className={styles.crumbCat}>{entry.category}</span>
            <span>›</span>
            <span className={styles.crumbNow}>{entry.title}</span>
          </nav>

          <div className={styles.headRow}>
            <h1 className={styles.title}>{entry.title}</h1>
            <button className={styles.print} onClick={() => window.print()} title="Cetak / simpan PDF">
              🖨 Cetak
            </button>
          </div>

          <DocsBody
            entry={entry}
            onNavigate={(slug) => router.push(`/docs/reference/${slug}/`)}
          />

          <div className={styles.footer}>
            <Link href="/docs/reference/" className={styles.backLink}>
              ← Semua referensi
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
