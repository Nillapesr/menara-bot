'use client';

import { useState } from 'react';

export default function AddBotPanel({ onAdded }) {
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'ok' | 'error', text }
  const [open, setOpen] = useState(false);

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
        setOpen(false);
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
      <button className="new-bot-btn" onClick={() => setOpen((o) => !o)}>
        <span className="plus">+</span> New Bot
      </button>

      {open && (
        <div className="sheet">
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
                autoFocus
              />
            </div>
            <button type="submit" className="submit-btn" disabled={submitting || !token.trim()}>
              {submitting ? 'Memasang…' : 'Pasang & jalankan'}
            </button>
          </form>

          <p className="hint">
            Belum punya token? Chat <strong>@BotFather</strong> di Telegram, kirim{' '}
            <code>/newbot</code>, ikuti instruksinya, lalu tempel token yang diberikan di sini.
          </p>
        </div>
      )}

      {message && <p className={`feedback ${message.type}`}>{message.text}</p>}

      <style jsx>{`
        .panel {
          margin-bottom: 4px;
        }

        .new-bot-btn {
          background: var(--signal-grad);
          border: none;
          color: #fff;
          font-weight: 600;
          font-size: 13px;
          padding: 11px 20px;
          border-radius: 100px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 8px 20px -8px rgba(124, 58, 237, 0.6);
          transition: filter 0.15s ease, transform 0.1s ease;
        }

        .new-bot-btn:hover {
          filter: brightness(1.08);
        }

        .new-bot-btn:active {
          transform: scale(0.97);
        }

        .plus {
          font-size: 16px;
          line-height: 1;
        }

        .sheet {
          margin-top: 14px;
          background: var(--panel);
          border: 1px solid var(--border-solid);
          border-radius: 14px;
          padding: 18px 20px;
        }

        .form {
          display: flex;
          gap: 10px;
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
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-faint);
        }

        input {
          background: var(--bg);
          border: 1px solid var(--border-solid);
          color: var(--text);
          padding: 12px 14px;
          border-radius: 10px;
          font-family: var(--mono);
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        input:focus {
          border-color: var(--signal);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.18);
        }

        .submit-btn {
          align-self: flex-end;
          background: var(--signal-grad);
          color: #fff;
          border: none;
          padding: 0 22px;
          height: 46px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: filter 0.15s ease, transform 0.1s ease;
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .submit-btn:not(:disabled):hover {
          filter: brightness(1.08);
        }

        .submit-btn:not(:disabled):active {
          transform: scale(0.97);
        }

        .feedback {
          margin: 14px 0 0;
          font-size: 13px;
          padding: 10px 14px;
          border-radius: 10px;
        }

        .feedback.ok {
          background: var(--ok-dim);
          color: var(--ok);
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
          border: 1px solid var(--border-solid);
          padding: 1px 6px;
          border-radius: 4px;
          font-family: var(--mono);
          color: var(--signal-2);
        }

        .hint strong {
          color: var(--text-dim);
        }
      `}</style>
    </div>
  );
}
