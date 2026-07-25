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
          <span className="brand-name">Sanzu</span>
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
            <p className="page-sub">Panel kendali bot Telegram kamu</p>
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
        }

        /* ── Sidebar ── */
        .sidebar {
          width: 220px;
          flex-shrink: 0;
          background: var(--panel);
          border-right: 1px solid var(--border-solid);
          display: flex;
          flex-direction: column;
          padding: 28px 20px;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 36px;
        }

        .brand-dot {
          width: 8px; height: 28px;
          background: var(--signal-grad);
          border-radius: 2px;
          box-shadow: 0 0 12px rgba(124, 58, 237, 0.5);
        }

        .brand-name {
          font-family: var(--display);
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .sidebar-nav {
          flex: 1;
        }

        .nav-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-faint);
          margin-bottom: 14px;
        }

        .stat-row {
          display: flex;
          align-items: center;
          background: var(--panel-raised);
          border: 1px solid var(--border-solid);
          border-radius: 12px;
          padding: 14px 16px;
          gap: 16px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-n {
          font-family: var(--mono);
          font-size: 22px;
          font-weight: 700;
          line-height: 1;
        }

        .stat-n.active {
          color: var(--ok);
        }

        .stat-l {
          font-size: 10px;
          color: var(--text-faint);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .stat-divider {
          width: 1px;
          height: 28px;
          background: var(--border-solid);
        }

        .sidebar-foot {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .user-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--panel-raised);
          border: 1px solid var(--border-solid);
          border-radius: 10px;
          padding: 10px 12px;
          overflow: hidden;
        }

        .user-avatar {
          width: 26px; height: 26px;
          border-radius: 50%;
          background: var(--signal-dim);
          color: var(--signal-2);
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .user-email {
          font-size: 11px;
          color: var(--text-dim);
          font-family: var(--mono);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .foot-links {
          display: flex;
          gap: 8px;
        }

        .foot-link {
          flex: 1;
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          padding: 7px;
          border-radius: 8px;
          text-decoration: none;
          cursor: pointer;
          border: none;
          transition: background 0.15s;
        }

        .foot-link.admin {
          background: var(--signal-dim);
          color: var(--signal-2);
        }

        .foot-link.admin:hover {
          background: #2e1a5a;
        }

        .foot-link.logout {
          background: var(--panel-raised);
          color: var(--text-dim);
          border: 1px solid var(--border-solid);
        }

        .foot-link.logout:hover {
          color: var(--danger);
          border-color: var(--danger);
        }

        /* ── Main ── */
        .main {
          flex: 1;
          min-width: 0;
          padding: 36px 40px 80px;
        }

        .topbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 40px;
          flex-wrap: wrap;
        }

        .page-title {
          font-family: var(--display);
          font-size: 24px;
          font-weight: 700;
          margin: 0;
          letter-spacing: -0.02em;
        }

        .page-sub {
          margin: 4px 0 0;
          color: var(--text-dim);
          font-size: 13px;
        }

        .error-banner {
          background: var(--danger-dim);
          border: 1px solid var(--danger);
          color: var(--text);
          padding: 14px 18px;
          border-radius: 10px;
          font-size: 13px;
          margin-bottom: 24px;
        }

        .bot-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        @media (max-width: 768px) {
          .shell { flex-direction: column; }
          .sidebar {
            width: 100%;
            height: auto;
            position: static;
            padding: 20px;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
          }
          .sidebar-brand { margin-bottom: 0; }
          .sidebar-nav { flex: none; }
          .sidebar-foot { flex-direction: row; align-items: center; }
          .main { padding: 24px 20px 60px; }
        }
      `}</style>
    </div>
  );
}
