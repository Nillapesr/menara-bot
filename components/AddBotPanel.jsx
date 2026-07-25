'use client';

import { useState } from 'react';

export default function AddBotPanel({ onAdded }) {
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
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
    } catch {
      setMessage({ type: 'error', text: 'Tidak bisa menghubungi server. Coba lagi.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="wrap">
      <button className="trigger-btn" onClick={() => { setOpen((o) => !o); setMessage(null); }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Tambah Bot
      </button>

      {open && (
        <div className="sheet">
          <div className="sheet-header">
            <span className="sheet-title">Sambungkan Bot Telegram</span>
            <button className="sheet-close" onClick={() => setOpen(false)}>✕</button>
          </div>
          <form onSubmit={handleSubmit} className="form">
            <div className="field">
              <label htmlFor="token-input">Token dari @BotFather</label>
              <input
                id="token-input"
                type="text"
                placeholder="123456789:AAExampleTokenHere…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={submitting}
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
            </div>
            <button type="submit" className="submit-btn" disabled={submitting || !token.trim()}>
              {submitting ? 'Memasang…' : 'Pasang & Jalankan →'}
            </button>
          </form>
          <p className="hint">
            Belum punya token? Chat <strong>@BotFather</strong>, kirim <code>/newbot</code>, ikuti instruksinya.
          </p>
        </div>
      )}

      {message && (
        <p className={`feedback ${message.type}`}>{message.text}</p>
      )}

      <style jsx>{`
        .wrap { position: relative; }

        .trigger-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--signal-grad);
          border: none;
          color: #fff;
          font-weight: 600;
          font-size: 13px;
          padding: 10px 18px;
          border-radius: 10px;
          cursor: pointer;
          box-shadow: 0 4px 16px -4px rgba(124, 58, 237, 0.5);
          transition: filter 0.15s, transform 0.1s;
        }
        .trigger-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .trigger-btn:active { transform: translateY(0); }

        .sheet {
          position: absolute;
          right: 0;
          top: calc(100% + 10px);
          width: 360px;
          background: var(--panel);
          border: 1px solid var(--border-solid);
          border-radius: 14px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          z-index: 100;
          overflow: hidden;
          animation: slideDown 0.15s ease;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .sheet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 18px;
          border-bottom: 1px solid var(--border-solid);
        }

        .sheet-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }

        .sheet-close {
          background: none;
          border: none;
          color: var(--text-faint);
          cursor: pointer;
          font-size: 13px;
          padding: 2px 4px;
          border-radius: 4px;
          line-height: 1;
        }
        .sheet-close:hover { color: var(--text); background: var(--panel-raised); }

        .form {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-faint);
        }

        input {
          background: var(--bg);
          border: 1px solid var(--border-solid);
          color: var(--text);
          padding: 11px 14px;
          border-radius: 8px;
          font-family: var(--mono);
          font-size: 12px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          width: 100%;
        }
        input:focus {
          border-color: var(--signal);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
        }

        .submit-btn {
          background: var(--signal-grad);
          color: #fff;
          border: none;
          padding: 11px 18px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: filter 0.15s;
        }
        .submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .submit-btn:not(:disabled):hover { filter: brightness(1.1); }

        .hint {
          margin: 0;
          padding: 12px 18px;
          font-size: 11px;
          color: var(--text-faint);
          line-height: 1.6;
          border-top: 1px solid var(--border-solid);
          background: var(--bg);
        }
        .hint strong { color: var(--text-dim); }
        .hint code {
          background: var(--panel-raised);
          border: 1px solid var(--border-solid);
          padding: 1px 5px;
          border-radius: 4px;
          font-family: var(--mono);
          color: var(--signal-2);
          font-size: 11px;
        }

        .feedback {
          position: absolute;
          right: 0;
          top: calc(100% + 10px);
          min-width: 280px;
          margin: 0;
          padding: 11px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          z-index: 99;
          animation: slideDown 0.15s ease;
        }
        .feedback.ok { background: var(--ok-dim); color: var(--ok); border: 1px solid rgba(34,197,94,0.3); }
        .feedback.error { background: var(--danger-dim); color: var(--danger); border: 1px solid rgba(239,68,68,0.3); }

        @media (max-width: 480px) {
          .sheet { right: auto; left: 0; width: calc(100vw - 40px); }
          .feedback { left: 0; right: auto; }
        }
      `}</style>
    </div>
  );
}
