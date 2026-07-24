'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push('/login');
      else if (user.role !== 'admin') router.push('/dashboard');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetch('/api/admin/overview')
        .then((res) => res.json())
        .then((d) => {
          if (d.error) setError(d.error);
          else setData(d);
        })
        .catch(() => setError('Gagal memuat data admin.'));
    }
  }, [user]);

  if (authLoading || !user || user.role !== 'admin') {
    return <div className="loading">Memuat…</div>;
  }

  return (
    <main className="admin">
      <header className="admin-head">
        <div>
          <Link href="/dashboard" className="back">← DASHBOARD</Link>
          <h1>PANEL ADMIN</h1>
        </div>
        <div className="admin-stats">
          <div className="stat-box stat-yellow">
            <span className="num">{data?.users?.length ?? '—'}</span>
            <span className="lbl">AKUN TERDAFTAR</span>
          </div>
          <div className="stat-box stat-pink">
            <span className="num">{data?.bots?.length ?? '—'}</span>
            <span className="lbl">BOT TERPASANG</span>
          </div>
          <div className="stat-box stat-blue">
            <span className="num">{data?.bots?.filter((b) => b.status === 'active').length ?? '—'}</span>
            <span className="lbl">BOT AKTIF</span>
          </div>
        </div>
      </header>

      {error && <p className="err">{error}</p>}

      <section className="section">
        <h2>SEMUA AKUN TERDAFTAR</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Role</th>
                <th>Terdaftar</th>
              </tr>
            </thead>
            <tbody>
              {data?.users?.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-admin' : ''}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString('id-ID')}</td>
                </tr>
              ))}
              {data?.users?.length === 0 && (
                <tr><td colSpan={4} className="empty">Belum ada user terdaftar.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>SEMUA BOT TERPASANG</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Nama Bot</th>
                <th>Status</th>
                <th>Mode</th>
                <th>Commands</th>
                <th>Pesan Diproses</th>
                <th>Pemilik</th>
                <th>Server / Webhook</th>
              </tr>
            </thead>
            <tbody>
              {data?.bots?.map((b) => (
                <tr key={b.id}>
                  <td>@{b.username}</td>
                  <td>{b.firstName}</td>
                  <td>
                    <span className={`badge ${b.status === 'active' ? 'badge-active' : ''}`}>
                      {b.status}
                    </span>
                  </td>
                  <td>{b.mode}</td>
                  <td>{b.commandCount ?? 0}</td>
                  <td>{b.messageCount}</td>
                  <td>
                    <div>{b.ownerName}</div>
                    <div className="mono">{b.ownerEmail}</div>
                  </td>
                  <td className="mono server-url">{b.serverUrl}</td>
                </tr>
              ))}
              {data?.bots?.length === 0 && (
                <tr><td colSpan={8} className="empty">Belum ada bot terpasang.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        .loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--mono);
          background: var(--bru-bg);
        }

        .admin {
          min-height: 100vh;
          background: var(--bru-bg);
          color: var(--bru-ink);
          padding: 32px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .admin-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 20px;
          border-bottom: var(--bru-border);
          padding-bottom: 24px;
          margin-bottom: 32px;
        }

        .back {
          text-decoration: none;
          color: var(--bru-ink);
          font-family: var(--mono);
          font-size: 12px;
          font-weight: 700;
        }

        h1 {
          font-family: var(--display);
          font-size: 40px;
          font-weight: 800;
          margin: 10px 0 0;
          letter-spacing: -0.02em;
        }

        .admin-stats {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
        }

        .stat-box {
          border: var(--bru-border);
          box-shadow: var(--bru-shadow-sm);
          padding: 14px 20px;
          display: flex;
          flex-direction: column;
          min-width: 130px;
        }

        .stat-yellow { background: var(--bru-yellow); }
        .stat-pink { background: var(--bru-pink); color: white; }
        .stat-blue { background: var(--bru-blue); color: white; }

        .num {
          font-family: var(--display);
          font-size: 30px;
          font-weight: 800;
          line-height: 1;
        }

        .lbl {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          margin-top: 6px;
        }

        .err {
          background: var(--bru-pink);
          color: white;
          border: var(--bru-border);
          padding: 12px 16px;
          font-weight: 600;
          margin-bottom: 24px;
        }

        .section {
          margin-bottom: 44px;
        }

        .section h2 {
          font-family: var(--display);
          font-size: 20px;
          font-weight: 800;
          margin: 0 0 14px;
        }

        .table-wrap {
          border: var(--bru-border);
          box-shadow: var(--bru-shadow-sm);
          overflow-x: auto;
          background: var(--bru-white);
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        th {
          text-align: left;
          padding: 12px 14px;
          background: var(--bru-ink);
          color: var(--bru-bg);
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        td {
          padding: 12px 14px;
          border-top: 2px solid var(--bru-ink);
        }

        .mono {
          font-family: var(--mono);
          font-size: 11px;
          color: #555;
        }

        .server-url {
          max-width: 260px;
          word-break: break-all;
        }

        .badge {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border: 2px solid var(--bru-ink);
          display: inline-block;
        }

        .badge-admin {
          background: var(--bru-yellow);
        }

        .badge-active {
          background: var(--bru-green);
        }

        .empty {
          text-align: center;
          color: #777;
          padding: 24px;
        }
      `}</style>
    </main>
  );
}
