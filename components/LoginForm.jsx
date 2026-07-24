'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { refresh } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal login.');
        return;
      }
      await refresh();
      router.push('/dashboard');
    } catch (e) {
      setError('Tidak bisa menghubungi server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Link href="/" className="back-link">← MENARA_</Link>
        <h1>MASUK</h1>
        <p className="sub">Belum punya akun? <Link href="/register">Daftar di sini</Link></p>

        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input
            type="email"
            placeholder="kamu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="err">{error}</p>}

          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? 'MEMPROSES...' : 'MASUK →'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .auth-wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bru-bg);
          padding: 24px;
        }

        .auth-card {
          width: 100%;
          max-width: 420px;
          background: var(--bru-white);
          border: var(--bru-border);
          box-shadow: var(--bru-shadow);
          padding: 36px;
        }

        .back-link {
          text-decoration: none;
          color: var(--bru-ink);
          font-family: var(--mono);
          font-size: 12px;
          font-weight: 700;
        }

        h1 {
          font-family: var(--display);
          font-size: 34px;
          font-weight: 800;
          margin: 16px 0 6px;
        }

        .sub {
          font-size: 13px;
          margin: 0 0 24px;
          color: #444;
        }

        .sub :global(a) {
          color: var(--bru-ink);
          font-weight: 700;
        }

        label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 16px 0 6px;
        }

        input {
          width: 100%;
          border: var(--bru-border);
          padding: 12px 14px;
          font-size: 14px;
          outline: none;
          background: var(--bru-bg);
        }

        input:focus {
          background: var(--bru-yellow);
        }

        .err {
          background: var(--bru-pink);
          color: var(--bru-white);
          border: var(--bru-border);
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 600;
          margin: 16px 0 0;
        }

        .btn-submit {
          width: 100%;
          margin-top: 24px;
          background: var(--bru-ink);
          color: var(--bru-bg);
          border: var(--bru-border);
          padding: 14px;
          font-weight: 800;
          font-size: 15px;
          box-shadow: var(--bru-shadow-sm);
          transition: transform 0.12s, box-shadow 0.12s;
        }

        .btn-submit:hover:not(:disabled) {
          transform: translate(-2px, -2px);
          box-shadow: 6px 6px 0 var(--bru-ink);
        }

        .btn-submit:disabled {
          opacity: 0.6;
        }
      `}</style>
    </main>
  );
}
