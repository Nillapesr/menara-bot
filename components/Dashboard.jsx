'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BotCard from './BotCard';
import AddBotPanel from './AddBotPanel';
import EmptyState from './EmptyState';
import { useAuth } from './AuthContext';

export default function Dashboard() {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user === null) router.push('/login');
  }, [authLoading, user, router]);

  const fetchBots = useCallback(async () => {
    try {
      const res = await fetch('/api/bots');
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setBots(data.bots || []);
    } catch {
      setError('Gagal memuat daftar bot. Cek koneksi ke database.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchBots();
      const interval = setInterval(fetchBots, 8000);
      return () => clearInterval(interval);
    }
  }, [user, fetchBots]);

  const activeCount = bots.filter((b) => b.status === 'active').length;

  if (authLoading || !user) {
    return (
      <div className="loading-screen">
        <div className="loader-inner">
          <span className="loader-dot" />
          <span className="loader-dot" />
          <span className="loader-dot" />
        </div>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--bg);
          }
          .loader-inner {
            display: flex;
            gap: 8px;
          }
          .loader-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            background: var(--signal);
            animation: pulse 1.2s ease-in-out infinite;
          }
          .loader-dot:nth-child(2) { animation-delay: 0.2s; }
          .loader-dot:nth-child(3) { animation-delay: 0.4s; }
          @keyframes pulse {
            0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="shell">
      {/* ─── Sidebar ─── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-dot" />
          <span className="brand-name">Menara</span>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-label">Overview</span>
          <div className="stat-row">
            <div className="stat-item">
              <span className="stat-n">{bots.length}</span>
              <span className="stat-l">Bot</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-n active">{activeCount}</span>
              <span className="stat-l">Aktif</span>
            </div>
          </div>
        </nav>

        <div className="sidebar-foot">
          <div className="user-chip">
            <span className="user-avatar">{user.email?.[0]?.toUpperCase()}</span>
            <span className="user-email">{user.email}</span>
          </div>
          <div className="foot-links">
            {user.role === 'admin' && (
              <a href="/admin" className="foot-link admin">Admin</a>
            )}
            <button onClick={logout} className="foot-link logout">Keluar</button>
          </div>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">Bot Manager</h1>
            <p className="page-sub">Kelola semua bot Telegram kamu di satu tempat</p>
          </div>
          <AddBotPanel onAdded={fetchBots} />
        </header>

        {error && <div className="error-banner">{error}</div>}

        {!loading && bots.length === 0 && !error && <EmptyState />}

        {bots.length > 0 && (
          <section className="bot-list">
            {bots.map((bot) => (
              <BotCard key={bot.id} bot={bot} onChange={fetchBots} />
            ))}
          </section>
        )}
      </main>

      <style jsx>{`
        .shell {
          display: flex;
          min-height: 100vh;
          background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%);
        }

        /* ── Sidebar ── */
        .sidebar {
          width: 260px;
          flex-shrink: 0;
          background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
          border-right: 1px solid rgba(124, 58, 237, 0.1);
          display: flex;
          flex-direction: column;
          padding: 28px 20px;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          box-shadow: inset -1px 0 0 rgba(0, 0, 0, 0.3);
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 40px;
        }

        .brand-dot {
          width: 8px; height: 28px;
          background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
          border-radius: 4px;
          box-shadow: 0 0 20px rgba(124, 58, 237, 0.6);
        }

        .brand-name {
          font-family: 'Inter', sans-serif;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.03em;
          background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .sidebar-nav {
          flex: 1;
        }

        .nav-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 14px;
        }

        .stat-row {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(124, 58, 237, 0.15);
          border-radius: 12px;
          padding: 16px;
          gap: 16px;
          backdrop-filter: blur(10px);
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .stat-n {
          font-family: 'Courier New', monospace;
          font-size: 24px;
          font-weight: 800;
          line-height: 1;
          color: #fff;
        }

        .stat-n.active {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .stat-l {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 600;
        }

        .stat-divider {
          width: 1px;
          height: 32px;
          background: rgba(124, 58, 237, 0.2);
        }

        .sidebar-foot {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-top: 20px;
          border-top: 1px solid rgba(124, 58, 237, 0.1);
        }

        .user-chip {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(124, 58, 237, 0.15);
          border-radius: 12px;
          padding: 11px 14px;
          overflow: hidden;
          backdrop-filter: blur(10px);
        }

        .user-avatar {
          width: 28px; height: 28px;
          border-radius: 8px;
          background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .user-email {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
          font-family: 'Courier New', monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
        }

        .foot-links {
          display: flex;
          gap: 8px;
        }

        .foot-link {
          flex: 1;
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          padding: 9px;
          border-radius: 8px;
          text-decoration: none;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }

        .foot-link.admin {
          background: rgba(124, 58, 237, 0.15);
          color: #a78bfa;
          border: 1px solid rgba(124, 58, 237, 0.25);
        }

        .foot-link.admin:hover {
          background: rgba(124, 58, 237, 0.25);
          border-color: rgba(124, 58, 237, 0.4);
        }

        .foot-link.logout {
          background: rgba(255, 255, 255, 0.04);
          color: rgba(255, 255, 255, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .foot-link.logout:hover {
          color: #ff6b6b;
          border-color: rgba(255, 107, 107, 0.3);
          background: rgba(255, 107, 107, 0.05);
        }

        /* ── Main ── */
        .main {
          flex: 1;
          min-width: 0;
          padding: 40px 50px 80px;
          overflow-y: auto;
        }

        .topbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 30px;
          margin-bottom: 50px;
          flex-wrap: wrap;
        }

        .topbar-left {
          flex: 1;
        }

        .page-title {
          font-family: 'Inter', sans-serif;
          font-size: 32px;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #fff 0%, #e0e7ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .page-sub {
          margin: 8px 0 0;
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
          font-weight: 500;
        }

        .error-banner {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 16px 20px;
          border-radius: 12px;
          font-size: 14px;
          margin-bottom: 28px;
          backdrop-filter: blur(10px);
        }

        .bot-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        @media (max-width: 768px) {
          .shell { flex-direction: column; }
          .sidebar {
            width: 100%;
            height: auto;
            position: static;
            padding: 16px;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 16px;
          }
          .sidebar-brand { margin-bottom: 0; }
          .sidebar-nav { flex: none; }
          .sidebar-foot { 
            flex-direction: row; 
            align-items: center;
            border-top: none;
            padding-top: 0;
            border-left: 1px solid rgba(124, 58, 237, 0.1);
            padding-left: 16px;
          }
          .main { 
            padding: 28px 20px 60px;
          }
          .page-title { font-size: 24px; }
        }
      `}</style>
    </div>
  );
}
