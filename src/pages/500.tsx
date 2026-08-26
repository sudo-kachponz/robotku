// src/pages/500.tsx
import Link from 'next/link';

export default function Custom500() {
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
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: '#1E1B4B',
      }}
    >
      <h1 style={{ fontSize: '72px', fontWeight: 900, color: '#EC2D8F', margin: 0 }}>500</h1>
      <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '12px 0 8px' }}>
        Terjadi Masalah pada Server
      </h2>
      <p style={{ fontSize: '15px', color: '#64748B', maxWidth: '400px', marginBottom: '28px' }}>
        Aplikasi mengalami kendala internal. Silakan coba muat ulang halaman.
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
        }}
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}
