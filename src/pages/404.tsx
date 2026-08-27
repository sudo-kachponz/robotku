// src/pages/404.tsx
import Link from 'next/link';

export default function Custom404() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
        backgroundColor: '#F3F4FB',
        fontFamily: 'var(--font-jakarta), sans-serif',
        color: '#1E1B4B',
      }}
    >
      <img
        src="/brand/Robotku-Mascot-Logo-Horizontal.png"
        alt="Robotku Logo"
        style={{ height: '64px', marginBottom: '24px', objectFit: 'contain' }}
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
      <h1 style={{ fontSize: '72px', fontWeight: 900, color: '#4F46E5', margin: 0 }}>404</h1>
      <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '12px 0 8px' }}>
        Halaman Tidak Ditemukan
      </h2>
      <p style={{ fontSize: '15px', color: '#64748B', maxWidth: '400px', marginBottom: '28px' }}>
        Halaman yang Kamu cari mungkin telah dipindahkan atau belum tersedia.
      </p>
      <Link
        href="/"
        style={{
          padding: '14px 28px',
          borderRadius: '14px',
          background: '#4F46E5',
          color: '#FFFFFF',
          fontWeight: 700,
          textDecoration: 'none',
          boxShadow: '0 8px 20px rgba(79, 70, 229, 0.25)',
        }}
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}
