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
            background: #0f172a;
            color: #94a3b8;
            font-family: ui-monospace, monospace;
            font-size: 0.875rem;
          }
          .spinner {
            width: 2rem;
            height: 2rem;
            border: 2px solid #7c3aed;
            border-top-color: transparent;
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
    <main className="dashboard">
      {/* Header */}
      <header className="header">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <h1>Sanzu Cloud</h1>
            <p>Panel kendali bot Telegram</p>
          </div>
        </div>

        <div className="user-section">
          <div className="stats">
            <div className="stat">
              <span className="stat-number">{bots.length}</span>
              <span className="stat-label">bot terpasang</span>
            </div>
            <div className="stat">
              <span className="stat-number signal">{activeCount}</span>
              <span className="stat-label">memancar aktif</span>
            </div>
          </div>

          <div className="user-menu">
            <span className="user-email">{user.email}</span>
            {user.role === 'admin' && (
              <a href="/admin" className="admin-link">Panel Admin</a>
            )}
            <button onClick={logout} className="logout-btn">Keluar</button>
          </div>
        </div>
      </header>

      {/* Add Bot Panel */}
      <AddBotPanel onAdded={fetchBots} />

      {/* Error Banner */}
      {error && <div className="error-banner">{error}</div>}

      {/* Empty State */}
      {!loading && bots.length === 0 && !error && <EmptyState />}

      {/* Bot Grid */}
      <section className="bot-grid">
        {bots.map((bot) => (
          <BotCard key={bot.id} bot={bot} onChange={fetchBots} />
        ))}
      </section>

      {/* ALL CSS IN ONE PLACE */}
      <style jsx>{`
        /* ===== LAYOUT ===== */
        .dashboard {
          min-height: 100vh;
          background: #0f172a;
          padding: 3rem 1.5rem 6rem;
          max-width: 1080px;
          margin: 0 auto;
        }

        @media (min-width: 640px) {
          .dashboard {
            padding: 3rem 2rem 6rem;
          }
        }

        /* ===== HEADER ===== */
        .header {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding-bottom: 1.75rem;
          border-bottom: 1px solid #334155;
          margin-bottom: 2.5rem;
        }

        @media (min-width: 768px) {
          .header {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
          }
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 0.875rem;
        }

        .brand-mark {
          width: 6px;
          height: 2.125rem;
          background: linear-gradient(to bottom, #a78bfa, #7c3aed);
          border-radius: 2px;
          box-shadow: 0 0 20px rgba(124, 58, 237, 0.4);
          flex-shrink: 0;
        }

        .brand h1 {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 1.625rem;
          font-weight: 700;
          margin: 0;
          letter-spacing: -0.02em;
          color: #ffffff;
        }

        .brand p {
          margin: 2px 0 0;
          color: #94a3b8;
          font-size: 0.8125rem;
        }

        /* ===== USER SECTION ===== */
        .user-section {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.75rem;
          width: 100%;
        }

        @media (min-width: 768px) {
          .user-section {
            align-items: flex-end;
            width: auto;
          }
        }

        .stats {
          display: flex;
          gap: 2rem;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        @media (min-width: 768px) {
          .stat {
            align-items: flex-end;
          }
        }

        .stat-number {
          font-family: ui-monospace, monospace;
          font-size: 1.75rem;
          font-weight: 700;
          line-height: 1;
          color: #ffffff;
        }

        .stat-number.signal {
          color: #a78bfa;
        }

        .stat-label {
          font-size: 0.6875rem;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-top: 0.25rem;
        }

        .user-menu {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .user-email {
          font-size: 0.75rem;
          color: #94a3b8;
          font-family: ui-monospace, monospace;
        }

        .admin-link {
          font-size: 0.75rem;
          color: #a78bfa;
          text-decoration: none;
          border: 1px solid rgba(124, 58, 237, 0.3);
          padding: 0.3125rem 0.625rem;
          border-radius: 0.375rem;
          transition: all 0.2s;
        }

        .admin-link:hover {
          background: rgba(124, 58, 237, 0.1);
        }

        .logout-btn {
          background: #1e293b;
          border: 1px solid #334155;
          color: #94a3b8;
          padding: 0.3125rem 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .logout-btn:hover {
          color: #f87171;
          border-color: #f87171;
        }

        /* ===== ERROR ===== */
        .error-banner {
          background: rgba(127, 29, 29, 0.4);
          border: 1px solid rgba(248, 113, 113, 0.3);
          color: #e2e8f0;
          padding: 0.875rem 1.125rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
        }

        /* ===== BOT GRID ===== */
        .bot-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 2rem;
        }
      `}</style>
    </main>
  );
}
