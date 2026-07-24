'use client';

import { useState } from 'react';

export default function AddBotPanel({ onAdded }) {
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'ok' | 'error', text }
  const [open, setOpen] = useState(true);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!token.trim()) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Gagal menambahkan bot.' });
      } else {
        setMessage({ type: 'ok', text: `@${data.bot.username} terpasang dan langsung aktif.` });
        setToken('');
        onAdded?.();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Tidak bisa menghubungi server. Coba lagi.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel">
      <button className="panel-toggle" onClick={() => setOpen((o) => !o)}>
        <span>Pasang bot baru</span>
        <span className="chev">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="form">
          <div className="field">
            <label htmlFor="token">Token dari @BotFather</label>
            <input
              id="token"
              type="text"
              placeholder="123456789:AAExampleTokenHereXXXXXXXXXXXXXXXXX"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={submitting}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button type="submit" className="submit-btn" disabled={submitting || !token.trim()}>
            {submitting ? 'Memasang webhook…' : 'Pasang & jalankan'}
          </button>
        </form>
      )}

      {message && (
        <p className={`feedback ${message.type}`}>{message.text}</p>
      )}

      {open && (
        <p className="hint">
          Belum punya token? Buka Telegram, chat <strong>@BotFather</strong>, kirim{' '}
          <code>/newbot</code>, ikuti instruksinya, lalu tempel token yang diberikan di sini.
          Bot akan langsung merespons pesan begitu token dipasang.
        </p>
      )}

      <style jsx>{`
        .panel {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 20px 22px;
        }

        .panel-toggle {
          width: 100%;
          background: none;
          border: none;
          color: var(--text);
          font-family: var(--mono);
          font-size: 14px;
          font-weight: 700;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          padding: 0;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .chev {
          color: var(--signal);
          font-size: 18px;
        }

        .form {
          display: flex;
          gap: 10px;
          margin-top: 16px;
          flex-wrap: wrap;
        }

        .field {
          flex: 1;
          min-width: 240px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        label {
          font-size: 12px;
          color: var(--text-dim);
        }

        input {
          background: var(--bg);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 11px 13px;
          border-radius: 6px;
          font-family: var(--mono);
          font-size: 13px;
          outline: none;
        }

        input:focus {
          border-color: var(--signal);
          box-shadow: 0 0 0 3px rgba(92, 242, 160, 0.12);
        }

        .submit-btn {
          align-self: flex-end;
          background: var(--signal);
          color: #06120c;
          border: none;
          padding: 0 20px;
          height: 44px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: opacity 0.15s;
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .submit-btn:not(:disabled):hover {
          opacity: 0.88;
        }

        .feedback {
          margin: 14px 0 0;
          font-size: 13px;
          padding: 10px 12px;
          border-radius: 6px;
        }

        .feedback.ok {
          background: var(--signal-dim);
          color: var(--signal);
        }

        .feedback.error {
          background: var(--danger-dim);
          color: var(--danger);
        }

        .hint {
          margin: 14px 0 0;
          font-size: 12px;
          color: var(--text-faint);
          line-height: 1.6;
        }

        .hint code {
          background: var(--panel-raised);
          padding: 1px 6px;
          border-radius: 4px;
          font-family: var(--mono);
        }

        .hint strong {
          color: var(--text-dim);
        }
      `}</style>
    </div>
  );
}
