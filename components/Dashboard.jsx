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
        <span>Memuat…</span>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--bg);
            color: var(--text-dim);
            font-family: var(--mono);
          }
        `}</style>
      </div>
    );
  }

  return (
    <main className="wrap">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>Menara</h1>
            <p>Panel kendali bot Telegram</p>
          </div>
        </div>
        <div className="user-strip">
          <div className="stat-strip">
            <div className="stat">
              <span className="stat-num">{bots.length}</span>
              <span className="stat-label">bot terpasang</span>
            </div>
            <div className="stat">
              <span className="stat-num signal-text">{activeCount}</span>
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

      <AddBotPanel onAdded={fetchBots} />

      {error && <div className="error-banner">{error}</div>}

      {!loading && bots.length === 0 && !error && <EmptyState />}

      <section className="bot-grid">
        {bots.map((bot) => (
          <BotCard key={bot.id} bot={bot} onChange={fetchBots} />
        ))}
      </section>

      <style jsx>{`
        .wrap {
          max-width: 1080px;
          margin: 0 auto;
          padding: 48px 24px 96px;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 24px;
          margin-bottom: 40px;
          padding-bottom: 28px;
          border-bottom: 1px solid var(--border);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brand-mark {
          width: 10px;
          height: 34px;
          background: var(--signal);
          border-radius: 2px;
          box-shadow: 0 0 16px rgba(92, 242, 160, 0.5);
          flex-shrink: 0;
        }

        h1 {
          font-family: var(--mono);
          font-size: 26px;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.02em;
        }

        .brand p {
          margin: 2px 0 0;
          color: var(--text-dim);
          font-size: 13px;
        }

        .user-strip {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 14px;
        }

        .stat-strip {
          display: flex;
          gap: 32px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .stat-num {
          font-family: var(--mono);
          font-size: 28px;
          font-weight: 700;
          line-height: 1;
        }

        .signal-text {
          color: var(--signal);
        }

        .stat-label {
          font-size: 11px;
          color: var(--text-faint);
          margin-top: 4px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .user-menu {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-email {
          font-size: 12px;
          color: var(--text-dim);
          font-family: var(--mono);
        }

        .admin-link {
          font-size: 12px;
          color: var(--signal);
          text-decoration: none;
          border: 1px solid var(--signal-dim);
          padding: 5px 10px;
          border-radius: 6px;
        }

        .logout-btn {
          background: var(--panel-raised);
          border: 1px solid var(--border);
          color: var(--text-dim);
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
        }

        .logout-btn:hover {
          color: var(--danger);
          border-color: var(--danger);
        }

        .error-banner {
          background: var(--danger-dim);
          border: 1px solid var(--danger);
          color: var(--text);
          padding: 14px 18px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 24px;
        }

        .bot-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
          margin-top: 32px;
        }

        @media (max-width: 640px) {
          .topbar {
            align-items: flex-start;
          }
          .user-strip {
            align-items: flex-start;
            width: 100%;
          }
          .stat-strip {
            gap: 20px;
          }
        }
      `}</style>
    </main>
  );
}
