'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';

export default function Dashboard() {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user === null) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const fetchBots = useCallback(async () => {
    try {
      const res = await fetch('/api/bots');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setBots(data.bots || []);
    } catch (e) {
      setError('Gagal memuat daftar bot.');
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
        <div className="spinner" />
        <span>Memuat…</span>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            background: #0f1421;
            color: #64748b;
            font-family: system-ui, sans-serif;
          }
          .spinner {
            width: 2.5rem;
            height: 2.5rem;
            border: 3px solid #1e293b;
            border-top-color: #8b5cf6;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="app">
      {/* ===== SIDEBAR ===== */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">◆</div>
          <span className="brand-text">SanzuCloud</span>
        </div>

        <nav className="sidebar-nav">
          <a href="#" className="nav-link active">
            <span className="nav-icon">🏠</span>
            <span>Dashboard</span>
          </a>
          <a href="#" className="nav-link">
            <span className="nav-icon">🤖</span>
            <span>Bots</span>
          </a>
          <a href="#" className="nav-link">
            <span className="nav-icon">📊</span>
            <span>Analytics</span>
          </a>
          <a href="#" className="nav-link">
            <span className="nav-icon">⚙️</span>
            <span>Settings</span>
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="user-avatar">{user?.email?.charAt(0)?.toUpperCase()}</div>
            <div className="user-info">
              <span className="user-name">{user?.email?.split('@')[0]}</span>
              <span className="user-role">Admin</span>
            </div>
          </div>
          <button onClick={logout} className="logout-btn">Keluar</button>
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <main className="main">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Kelola semua bot Telegram Anda</p>
          </div>
          <div className="topbar-right">
            <button className="btn-new-bot">+ New Bot</button>
          </div>
        </header>

        {/* Stats Cards */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon purple">🤖</div>
            <div>
              <p className="stat-label">Total Bots</p>
              <h2 className="stat-value">{bots.length}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">⚡</div>
            <div>
              <p className="stat-label">Active</p>
              <h2 className="stat-value">{activeCount}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue">👥</div>
            <div>
              <p className="stat-label">Users</p>
              <h2 className="stat-value">1,284</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">📈</div>
            <div>
              <p className="stat-label">Requests</p>
              <h2 className="stat-value">8.2k</h2>
            </div>
          </div>
        </section>

        {/* Error */}
        {error && <div className="error-banner">{error}</div>}

        {/* Bot List */}
        <section className="bot-section">
          <div className="section-header">
            <h3>Bot List</h3>
            <span className="bot-count">{bots.length} bots</span>
          </div>

          {!loading && bots.length === 0 && !error ? (
            <div className="empty-state">
              <div className="empty-icon">🤖</div>
              <p>Belum ada bot terpasang</p>
              <button className="btn-new-bot">+ Tambah Bot</button>
            </div>
          ) : (
            <div className="bot-list">
              {bots.map((bot) => (
                <div key={bot.id} className="bot-item">
                  <div className="bot-info">
                    <div className="bot-avatar">
                      {bot.name?.charAt(0)?.toUpperCase() || 'B'}
                    </div>
                    <div>
                      <div className="bot-name">{bot.name || 'Unnamed Bot'}</div>
                      <div className="bot-username">@{bot.username || 'username'}</div>
                    </div>
                  </div>
                  <div className="bot-status">
                    <span className={`status-badge ${bot.status === 'active' ? 'active' : 'stopped'}`}>
                      {bot.status === 'active' ? '● ACTIVE' : '● STOPPED'}
                    </span>
                  </div>
                  <button className="btn-manage">Manage</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ===== ALL CSS ===== */}
      <style jsx>{`
        /* ===== GLOBAL RESET ===== */
        .app {
          display: flex;
          min-height: 100vh;
          background: #0f1421;
          color: #e2e8f0;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        /* ===== SIDEBAR ===== */
        .sidebar {
          width: 240px;
          background: #151e2f;
          border-right: 1px solid #1e2a3a;
          display: flex;
          flex-direction: column;
          padding: 1.5rem 1rem;
          flex-shrink: 0;
          position: sticky;
          top: 0;
          height: 100vh;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0 0.5rem 1.5rem;
          border-bottom: 1px solid #1e2a3a;
          margin-bottom: 1.5rem;
        }

        .brand-icon {
          font-size: 1.5rem;
          color: #8b5cf6;
        }

        .brand-text {
          font-size: 1.125rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.02em;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          flex: 1;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.625rem 0.75rem;
          border-radius: 0.5rem;
          color: #94a3b8;
          text-decoration: none;
          font-size: 0.875rem;
          transition: all 0.2s;
        }

        .nav-link:hover {
          background: #1e2a3a;
          color: #e2e8f0;
        }

        .nav-link.active {
          background: #1e2a3a;
          color: #8b5cf6;
        }

        .nav-icon {
          font-size: 1.125rem;
        }

        .sidebar-bottom {
          border-top: 1px solid #1e2a3a;
          padding-top: 1rem;
          margin-top: auto;
        }

        .user-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem;
          border-radius: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .user-avatar {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 50%;
          background: #8b5cf6;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.875rem;
          color: #ffffff;
        }

        .user-info {
          display: flex;
          flex-direction: column;
        }

        .user-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: #e2e8f0;
        }

        .user-role {
          font-size: 0.75rem;
          color: #64748b;
        }

        .logout-btn {
          width: 100%;
          padding: 0.5rem;
          background: transparent;
          border: 1px solid #1e2a3a;
          border-radius: 0.5rem;
          color: #94a3b8;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .logout-btn:hover {
          background: #1e2a3a;
          color: #f87171;
          border-color: #f87171;
        }

        /* ===== MAIN ===== */
        .main {
          flex: 1;
          padding: 1.5rem 2rem 3rem;
          overflow-y: auto;
        }

        /* ===== TOPBAR ===== */
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
        }

        .page-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        .page-subtitle {
          color: #64748b;
          font-size: 0.875rem;
          margin: 0.25rem 0 0;
        }

        .btn-new-bot {
          padding: 0.5rem 1.25rem;
          background: #8b5cf6;
          border: none;
          border-radius: 0.5rem;
          color: #ffffff;
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        .btn-new-bot:hover {
          background: #7c3aed;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
        }

        /* ===== STATS GRID ===== */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: #151e2f;
          border: 1px solid #1e2a3a;
          border-radius: 0.75rem;
          padding: 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: all 0.2s;
        }

        .stat-card:hover {
          border-color: #8b5cf6;
          box-shadow: 0 0 24px rgba(139, 92, 246, 0.05);
        }

        .stat-icon {
          width: 2.75rem;
          height: 2.75rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          flex-shrink: 0;
        }

        .stat-icon.purple { background: rgba(139, 92, 246, 0.15); }
        .stat-icon.green { background: rgba(52, 211, 153, 0.15); }
        .stat-icon.blue { background: rgba(59, 130, 246, 0.15); }
        .stat-icon.orange { background: rgba(251, 146, 60, 0.15); }

        .stat-label {
          font-size: 0.75rem;
          color: #64748b;
          margin: 0;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        /* ===== ERROR ===== */
        .error-banner {
          background: rgba(127, 29, 29, 0.3);
          border: 1px solid rgba(248, 113, 113, 0.2);
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          color: #e2e8f0;
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
        }

        /* ===== BOT SECTION ===== */
        .bot-section {
          background: #151e2f;
          border: 1px solid #1e2a3a;
          border-radius: 0.75rem;
          padding: 1.25rem;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #1e2a3a;
        }

        .section-header h3 {
          font-size: 0.875rem;
          font-weight: 600;
          color: #e2e8f0;
          margin: 0;
        }

        .bot-count {
          font-size: 0.75rem;
          color: #64748b;
        }

        /* ===== BOT LIST ===== */
        .bot-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .bot-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: #0f1421;
          border-radius: 0.5rem;
          border: 1px solid transparent;
          transition: all 0.2s;
        }

        .bot-item:hover {
          border-color: #1e2a3a;
        }

        .bot-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .bot-avatar {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 50%;
          background: #1e2a3a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.875rem;
          color: #8b5cf6;
        }

        .bot-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: #e2e8f0;
        }

        .bot-username {
          font-size: 0.75rem;
          color: #64748b;
        }

        .status-badge {
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 0.25rem 0.625rem;
          border-radius: 0.375rem;
          letter-spacing: 0.03em;
        }

        .status-badge.active {
          color: #34d399;
          background: rgba(52, 211, 153, 0.1);
        }

        .status-badge.stopped {
          color: #f87171;
          background: rgba(248, 113, 113, 0.1);
        }

        .btn-manage {
          padding: 0.25rem 1rem;
          background: transparent;
          border: 1px solid #1e2a3a;
          border-radius: 0.375rem;
          color: #94a3b8;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-manage:hover {
          border-color: #8b5cf6;
          color: #8b5cf6;
        }

        /* ===== EMPTY STATE ===== */
        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          color: #64748b;
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: 0.5rem;
        }

        .empty-state .btn-new-bot {
          margin-top: 0.5rem;
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 768px) {
          .app {
            flex-direction: column;
          }

          .sidebar {
            width: 100%;
            height: auto;
            position: relative;
            padding: 1rem;
            flex-direction: row;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.5rem;
          }

          .sidebar-brand {
            border-bottom: none;
            padding: 0;
            margin: 0;
            flex: 1;
          }

          .sidebar-nav {
            flex-direction: row;
            flex: 1;
            gap: 0.25rem;
          }

          .nav-link {
            padding: 0.4rem 0.6rem;
            font-size: 0.75rem;
          }

          .nav-link span:last-child {
            display: none;
          }

          .sidebar-bottom {
            border-top: none;
            padding: 0;
            margin: 0;
          }

          .user-card {
            padding: 0.25rem;
          }

          .user-avatar {
            width: 1.75rem;
            height: 1.75rem;
            font-size: 0.75rem;
          }

          .user-name, .user-role {
            display: none;
          }

          .logout-btn {
            width: auto;
            padding: 0.25rem 0.75rem;
            font-size: 0.7rem;
          }

          .main {
            padding: 1rem;
          }

          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }

          .topbar {
            flex-direction: column;
            gap: 0.75rem;
          }

          .btn-new-bot {
            width: 100%;
            text-align: center;
          }

          .bot-item {
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .bot-info {
            flex: 1;
            min-width: 120px;
          }

          .btn-manage {
            margin-left: auto;
          }
        }

        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
