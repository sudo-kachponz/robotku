import AppShell from '../components/layout/AppShell';

export default function DashboardPage() {
  return (
    <AppShell pageTitle="Dashboard">
      <div style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        <h2 style={{ fontSize: '32px', color: '#2B2680', marginBottom: '16px' }}>Selamat Datang di Dashboard!</h2>
        <p style={{ fontSize: '18px', color: '#4A5568', maxWidth: '600px' }}>
          Ini adalah tampilan contoh (preview) untuk App Shell baru dengan Sidebar putih dan Topbar gradient Indigo-Pink sesuai Robotku Design System.
        </p>
      </div>
    </AppShell>
  );
}
