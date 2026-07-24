'use client';

import { useState } from 'react';

const TEMPLATE_BASIC = `// Fungsi handle(ctx) dipanggil setiap ada pesan/klik tombol masuk ke command ini.
// ctx.text -> teks pesan dari user
// ctx.callbackData -> data tombol yang diklik (kalau ini dipicu oleh callback)
// ctx.sendMessage(text, { buttons }) -> kirim teks (+ tombol opsional)
// ctx.sendPhoto(url, { caption, buttons }) -> kirim gambar
// ctx.answerCallback(text) -> balas klik tombol (hilangkan loading di Telegram)
// ctx.callAI({ apiKey, messages }) -> panggil API AI (format ChatGPT)
// ctx.fetchJSON(url, opts) -> panggil API luar apa saja

async function handle(ctx) {
  await ctx.sendMessage('Halo! Bot ini pakai kode custom.', {
    buttons: [[{ text: 'Lihat gambar', callback_data: 'lihat_gambar' }]],
  });
}`;

const TEMPLATE_AI = `// Contoh command yang terhubung ke API ChatGPT (atau kompatibel OpenAI lain).
// Ganti API_KEY dengan API key kamu sendiri.

const API_KEY = 'MASUKKAN_API_KEY_DI_SINI';

async function handle(ctx) {
  const reply = await ctx.callAI({
    apiKey: API_KEY,
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Kamu adalah asisten yang ramah dan singkat.' },
      { role: 'user', content: ctx.text },
    ],
  });

  await ctx.sendMessage(reply);
}`;

const TABS = [
  { id: 'intro', label: 'Intro', icon: '▦' },
  { id: 'commands', label: 'Commands', icon: '</>' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

function initials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';
}

export default function BotCard({ bot, onChange }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('intro');
  const [busy, setBusy] = useState(false);

  // ---- Commands state ----
  const [commands, setCommands] = useState(bot.commands || []);
  const [editingId, setEditingId] = useState(null);
  const [draftCode, setDraftCode] = useState('');
  const [draftError, setDraftError] = useState('');
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [newTrigger, setNewTrigger] = useState('');
  const [addingCommand, setAddingCommand] = useState(false);
  const [search, setSearch] = useState('');

  // ---- Settings state (rules mode masih tersedia sebagai fallback) ----
  const [fallback, setFallback] = useState(bot.fallbackMessage || '');
  const [savingFallback, setSavingFallback] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const isActive = bot.status === 'active';
  const maskedToken = bot.token ? bot.token.replace(/./g, '•').slice(0, 34) : '';

  function openEditor(cmd) {
    setEditingId(cmd.id);
    setDraftCode(cmd.code || '');
    setDraftError('');
    setDraftSaved(false);
  }

  function closeEditor() {
    setEditingId(null);
    setDraftCode('');
    setDraftError('');
    setDraftSaved(false);
  }

  async function addCommand(initialCode = '') {
    const trigger = newTrigger.trim();
    if (!trigger) return;
    setAddingCommand(true);
    try {
      const res = await fetch(`/api/bots/${bot.id}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger, code: initialCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal menambah command.');
      } else {
        setCommands(data.commands);
        setNewTrigger('');
        onChange?.();
        if (initialCode) openEditor(data.command);
      }
    } finally {
      setAddingCommand(false);
    }
  }

  async function saveCommandCode(cmdId) {
    setDraftSaving(true);
    setDraftError('');
    setDraftSaved(false);
    try {
      const res = await fetch(`/api/bots/${bot.id}/commands/${cmdId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: draftCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDraftError(data.error || 'Gagal menyimpan kode.');
      } else {
        setCommands(data.commands);
        setDraftSaved(true);
        onChange?.();
      }
    } catch (e) {
      setDraftError('Tidak bisa menghubungi server.');
    } finally {
      setDraftSaving(false);
    }
  }

  async function removeCommand(cmdId) {
    if (!confirm('Hapus command ini?')) return;
    const res = await fetch(`/api/bots/${bot.id}/commands/${cmdId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      setCommands(data.commands);
      if (editingId === cmdId) closeEditor();
      onChange?.();
    }
  }

  function loadTemplate(tpl) {
    setNewTrigger((t) => t || '/start');
    addCommand(tpl);
  }

  async function toggleStatus() {
    setBusy(true);
    await fetch(`/api/bots/${bot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: isActive ? 'paused' : 'active' }),
    });
    setBusy(false);
    onChange?.();
  }

  async function removeBot() {
    if (!confirm(`Hapus @${bot.username}? Webhook akan dicabut dan bot berhenti membalas.`)) return;
    setBusy(true);
    await fetch(`/api/bots/${bot.id}`, { method: 'DELETE' });
    setBusy(false);
    onChange?.();
  }

  async function saveFallback() {
    setSavingFallback(true);
    await fetch(`/api/bots/${bot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fallbackMessage: fallback }),
    });
    setSavingFallback(false);
    onChange?.();
  }

  const filteredCommands = search.trim()
    ? commands.filter((c) => (c.trigger || '').toLowerCase().includes(search.trim().toLowerCase()))
    : commands;

  return (
    <div className="row">
      <button className="row-head" onClick={() => setOpen((o) => !o)}>
        <span className="avatar">{initials(bot.firstName || bot.username)}</span>
        <span className="row-info">
          <span className="row-name">{bot.firstName || bot.username}</span>
          <span className="row-username">@{bot.username}</span>
        </span>
        <span className={`status-pill ${isActive ? 'ok' : 'off'}`}>
          {isActive ? 'Working' : 'Stopped'}
        </span>
        <span className="manage-btn">{open ? 'Close' : 'Manage'}</span>
      </button>

      {open && (
        <div className="panel">
          <div className="tabbar">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <span className="tab-icon">{t.icon}</span> {t.label}
              </button>
            ))}
          </div>

          {tab === 'intro' && (
            <div className="tab-body">
              <div className="intro-card">
                <div className="intro-top">
                  <span className="avatar avatar-lg">{initials(bot.firstName || bot.username)}</span>
                  <div>
                    <p className="intro-name">{bot.firstName || bot.username}</p>
                    <span className={`status-pill ${isActive ? 'ok' : 'off'}`}>
                      {isActive ? 'Active' : 'Stopped'}
                    </span>
                  </div>
                </div>
                <p className="intro-username">@{bot.username}</p>
                <p className="intro-id">{bot.id}</p>

                <button
                  onClick={toggleStatus}
                  disabled={busy}
                  className={`stop-btn ${isActive ? 'danger' : 'ok'}`}
                >
                  <span className="stop-dot" /> {isActive ? 'Stop Bot' : 'Start Bot'}
                </button>
              </div>

              <p className="section-label">Overview</p>
              <div className="stat-grid">
                <div className="stat-card">
                  <span className="stat-icon">👤</span>
                  <p className="stat-label">Users</p>
                  <p className="stat-value">{bot.userCount || 1}</p>
                </div>
                <div className="stat-card">
                  <span className="stat-icon">✓</span>
                  <p className="stat-label">Commands</p>
                  <p className="stat-value">{commands.length}</p>
                </div>
                <div className="stat-card wide">
                  <span className="stat-icon">🕒</span>
                  <p className="stat-label">Messages diproses</p>
                  <p className="stat-value">{bot.messageCount || 0}</p>
                </div>
              </div>

              <p className="section-label">Status</p>
              <div className="status-block">
                <span className={`status-pill ${isActive ? 'ok' : 'off'}`}>
                  {isActive ? 'Active' : 'Stopped'}
                </span>
                <span className="status-text">
                  {isActive ? 'Online & responding' : 'Bot dijeda, tidak membalas pesan'}
                </span>
              </div>
            </div>
          )}

          {tab === 'commands' && (
            <div className="tab-body">
              <div className="template-row">
                <span className="template-label">Template:</span>
                <button className="btn-add" onClick={() => loadTemplate(TEMPLATE_BASIC)}>
                  Dasar (teks + tombol)
                </button>
                <button className="btn-add" onClick={() => loadTemplate(TEMPLATE_AI)}>
                  Terhubung AI
                </button>
              </div>

              <div className="cmd-toolbar">
                <div className="search-box">
                  <span className="search-icon">⌕</span>
                  <input
                    placeholder="Search…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="add-command-row">
                  <input
                    className="trigger-input"
                    placeholder="/start, /play, help_menu…"
                    value={newTrigger}
                    onChange={(e) => setNewTrigger(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCommand()}
                  />
                  <button
                    className="new-cmd-btn"
                    onClick={() => addCommand()}
                    disabled={addingCommand || !newTrigger.trim()}
                  >
                    + New
                  </button>
                </div>
              </div>

              {filteredCommands.length === 0 && (
                <p className="empty-rules">
                  {commands.length === 0
                    ? 'Belum ada command. Tambahkan trigger di atas untuk membuat command pertama.'
                    : 'Tidak ada command yang cocok dengan pencarian.'}
                </p>
              )}

              <div className="command-list">
                {filteredCommands.map((cmd) => (
                  <div className="command-item" key={cmd.id}>
                    <div className="command-trigger">{cmd.trigger}</div>
                    <div className="command-row">
                      <button
                        className="btn-edit-code"
                        onClick={() => (editingId === cmd.id ? closeEditor() : openEditor(cmd))}
                      >
                        {'</> '}Edit JS
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => (editingId === cmd.id ? closeEditor() : openEditor(cmd))}
                        aria-label="Edit"
                      >
                        ✎
                      </button>
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={() => removeCommand(cmd.id)}
                        aria-label="Hapus command"
                      >
                        🗑
                      </button>
                    </div>

                    {editingId === cmd.id && (
                      <div className="command-editor">
                        <textarea
                          className="code-editor"
                          value={draftCode}
                          onChange={(e) => {
                            setDraftCode(e.target.value);
                            setDraftSaved(false);
                          }}
                          rows={12}
                          spellCheck={false}
                          placeholder="async function handle(ctx) {&#10;  await ctx.sendMessage('Halo!');&#10;}"
                        />

                        <p className="code-hint">
                          Wajib mendefinisikan <code>async function handle(ctx)</code>. Tersedia:{' '}
                          <code>ctx.text</code>, <code>ctx.callbackData</code>, <code>ctx.sendMessage()</code>,{' '}
                          <code>ctx.sendPhoto()</code>, <code>ctx.answerCallback()</code>,{' '}
                          <code>ctx.callAI()</code>, <code>ctx.fetchJSON()</code>.
                        </p>

                        {draftError && <p className="code-error">{draftError}</p>}
                        {draftSaved && <p className="code-ok">Kode tersimpan dan aktif.</p>}

                        <button
                          onClick={() => saveCommandCode(cmd.id)}
                          disabled={draftSaving}
                          className="btn-save"
                        >
                          {draftSaving ? 'Menyimpan…' : 'Simpan & aktifkan kode'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="editor-field" style={{ marginTop: 16 }}>
                <label>Balasan default (jika tak ada command yang cocok)</label>
                <textarea
                  value={fallback}
                  onChange={(e) => setFallback(e.target.value)}
                  rows={2}
                  onBlur={saveFallback}
                />
                {savingFallback && <span className="saving-hint">Menyimpan…</span>}
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="tab-body">
              <div className="settings-card">
                <p className="settings-label">Bot ID</p>
                <div className="settings-row">
                  <span className="settings-value">{bot.id}</span>
                </div>
              </div>

              <div className="settings-card">
                <p className="settings-label">Bot Token</p>
                <div className="settings-row">
                  <span className="settings-value mono">
                    {showToken ? bot.token : maskedToken}
                  </span>
                  <button className="eye-btn" onClick={() => setShowToken((s) => !s)}>
                    {showToken ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <div className="settings-card">
                <p className="settings-label">Statistik</p>
                <div className="settings-row">
                  <span className="settings-value">{bot.messageCount || 0} pesan diproses</span>
                </div>
              </div>

              <div className="settings-card danger-zone">
                <p className="settings-label danger-label">Danger Zone</p>
                <p className="danger-desc">
                  Menghapus bot akan mencabut webhook dan bot berhenti membalas pesan secara permanen.
                </p>
                <button onClick={removeBot} disabled={busy} className="delete-btn">
                  Hapus Bot
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .row {
          background: var(--panel);
          border: 1px solid var(--border-solid);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 1px 0 rgba(255,255,255,0.02) inset, 0 20px 40px -28px rgba(0,0,0,0.6);
        }

        .row-head {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 18px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
        }

        .avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--signal-grad);
          color: #fff;
          font-family: var(--display);
          font-weight: 700;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .avatar-lg {
          width: 52px;
          height: 52px;
          font-size: 17px;
        }

        .row-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .row-name {
          font-family: var(--display);
          font-weight: 700;
          font-size: 14px;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .row-username {
          font-size: 12px;
          color: var(--signal-2);
          font-family: var(--mono);
        }

        .status-pill {
          font-size: 10px;
          font-family: var(--mono);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 10px;
          border-radius: 100px;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .status-pill::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .status-pill.ok {
          background: var(--ok-dim);
          color: var(--ok);
        }

        .status-pill.off {
          background: var(--panel-raised);
          color: var(--text-faint);
        }

        .manage-btn {
          background: var(--signal-grad);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 100px;
          flex-shrink: 0;
        }

        .panel {
          border-top: 1px solid var(--border-solid);
          padding: 16px 18px 20px;
        }

        .tabbar {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          background: var(--bg);
          padding: 4px;
          border-radius: 100px;
          border: 1px solid var(--border-solid);
          margin-bottom: 16px;
        }

        .tab {
          flex-shrink: 0;
          background: transparent;
          border: none;
          color: var(--text-faint);
          padding: 8px 14px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .tab-icon {
          font-family: var(--mono);
          margin-right: 3px;
        }

        .tab.active {
          color: #fff;
          background: var(--signal-grad);
        }

        .tab-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .intro-card {
          background: var(--bg);
          border: 1px solid var(--border-solid);
          border-radius: 14px;
          padding: 18px;
        }

        .intro-top {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }

        .intro-name {
          font-family: var(--display);
          font-weight: 700;
          font-size: 16px;
          margin: 0 0 6px;
        }

        .intro-username {
          color: var(--signal-2);
          font-family: var(--mono);
          font-size: 13px;
          margin: 0;
        }

        .intro-id {
          color: var(--text-faint);
          font-family: var(--mono);
          font-size: 12px;
          margin: 2px 0 16px;
        }

        .stop-btn {
          width: 100%;
          border: none;
          padding: 13px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: filter 0.15s ease, transform 0.1s ease;
        }

        .stop-btn.danger {
          background: var(--danger);
          color: #fff;
        }

        .stop-btn.ok {
          background: var(--ok);
          color: #06210f;
        }

        .stop-btn:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .stop-btn:active:not(:disabled) {
          transform: scale(0.98);
        }

        .stop-dot {
          width: 8px;
          height: 8px;
          border-radius: 2px;
          background: currentColor;
        }

        .section-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-faint);
          margin: 6px 0 0;
        }

        .stat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .stat-card {
          background: var(--bg);
          border: 1px solid var(--border-solid);
          border-radius: 12px;
          padding: 14px;
        }

        .stat-card.wide {
          grid-column: 1 / -1;
        }

        .stat-icon {
          font-size: 14px;
          opacity: 0.8;
        }

        .stat-label {
          font-size: 11px;
          color: var(--text-faint);
          margin: 8px 0 2px;
        }

        .stat-value {
          font-family: var(--display);
          font-size: 20px;
          font-weight: 700;
          margin: 0;
        }

        .status-block {
          background: var(--bg);
          border: 1px solid var(--border-solid);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .status-text {
          font-size: 12px;
          color: var(--text-dim);
        }

        .template-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          font-size: 11px;
        }

        .template-label {
          color: var(--text-faint);
        }

        .btn-add {
          background: none;
          border: none;
          color: var(--signal-2);
          font-size: 12px;
          cursor: pointer;
          padding: 0;
        }

        .cmd-toolbar {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg);
          border: 1px solid var(--border-solid);
          border-radius: 10px;
          padding: 0 12px;
        }

        .search-icon {
          color: var(--text-faint);
          font-size: 13px;
        }

        .search-box input {
          border: none;
          background: none;
          padding: 10px 0;
        }

        .search-box input:focus {
          box-shadow: none;
        }

        .add-command-row {
          display: flex;
          gap: 8px;
        }

        .trigger-input {
          flex: 1;
        }

        .new-cmd-btn {
          background: var(--signal-grad);
          color: #fff;
          border: none;
          padding: 0 18px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
          transition: filter 0.15s ease, transform 0.1s ease;
        }

        .new-cmd-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }

        .new-cmd-btn:not(:disabled):hover {
          filter: brightness(1.08);
        }

        .empty-rules {
          font-size: 12px;
          color: var(--text-faint);
          margin: 4px 0;
        }

        .command-list {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 0;
          margin-left: 6px;
          padding-left: 16px;
          border-left: 1px dashed var(--border-solid);
        }

        .command-item {
          position: relative;
          background: var(--panel-raised);
          border: 1px solid var(--border-solid);
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 10px;
          transition: border-color 0.15s ease;
        }

        .command-item::before {
          content: '';
          position: absolute;
          left: -16px;
          top: 20px;
          width: 14px;
          height: 1px;
          background: var(--border-solid);
        }

        .command-item::after {
          content: '';
          position: absolute;
          left: -19px;
          top: 16px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--signal-2);
          box-shadow: 0 0 0 3px rgba(139,92,246,0.15);
        }

        .command-item:hover {
          border-color: rgba(124,58,237,0.4);
        }

        .command-trigger {
          display: inline-block;
          font-family: var(--mono);
          font-weight: 600;
          font-size: 12px;
          color: #fff;
          background: var(--signal-grad);
          padding: 4px 12px;
          border-radius: 100px;
          margin-bottom: 10px;
        }

        .command-row {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .btn-edit-code {
          flex: 1;
          background: var(--bg);
          border: 1px solid var(--border-solid);
          color: var(--signal-2);
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          font-family: var(--mono);
          cursor: pointer;
          text-align: left;
          transition: border-color 0.15s ease, background 0.15s ease;
        }

        .btn-edit-code:hover {
          border-color: var(--signal);
          background: var(--signal-dim);
        }

        .btn-icon {
          background: var(--bg);
          border: 1px solid var(--border-solid);
          color: var(--text-dim);
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          transition: border-color 0.15s ease, color 0.15s ease;
        }

        .btn-icon:hover {
          color: var(--signal-2);
          border-color: rgba(124,58,237,0.4);
        }

        .btn-icon-danger:hover {
          color: var(--danger);
          border-color: var(--danger);
        }

        .command-editor {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px dashed var(--border-solid);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .code-editor {
          width: 100%;
          font-family: var(--mono);
          font-size: 12px;
          line-height: 1.65;
          background: #050508;
          border: 1px solid var(--border-solid);
          color: var(--text);
          border-radius: 10px;
          padding: 10px 12px;
          min-height: 220px;
          white-space: pre;
          outline: none;
          resize: vertical;
        }

        .code-editor:focus {
          border-color: var(--signal);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.18);
        }

        .code-hint {
          font-size: 11px;
          color: var(--text-faint);
          line-height: 1.6;
          margin: 0;
        }

        .code-hint code {
          background: var(--panel-raised);
          border: 1px solid var(--border-solid);
          padding: 1px 5px;
          border-radius: 4px;
          color: var(--signal-2);
        }

        .code-error {
          background: var(--danger-dim);
          color: var(--danger);
          font-size: 12px;
          padding: 8px 10px;
          border-radius: 8px;
          margin: 0;
        }

        .code-ok {
          background: var(--ok-dim);
          color: var(--ok);
          font-size: 12px;
          padding: 8px 10px;
          border-radius: 8px;
          margin: 0;
        }

        .btn-save {
          align-self: flex-start;
          background: var(--signal-grad);
          color: #fff;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
          transition: filter 0.15s ease, transform 0.1s ease;
        }

        .btn-save:hover:not(:disabled) {
          filter: brightness(1.1);
        }

        .btn-save:disabled {
          opacity: 0.5;
          cursor: default;
        }

        .editor-field label {
          display: block;
          font-size: 11px;
          color: var(--text-faint);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 6px;
        }

        .editor-field textarea {
          width: 100%;
          background: var(--bg);
          border: 1px solid var(--border-solid);
          color: var(--text);
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 13px;
          font-family: var(--sans);
          outline: none;
          resize: vertical;
        }

        .editor-field textarea:focus {
          border-color: var(--signal);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
        }

        .saving-hint {
          font-size: 11px;
          color: var(--text-faint);
        }

        .settings-card {
          background: var(--bg);
          border: 1px solid var(--border-solid);
          border-radius: 12px;
          padding: 14px 16px;
        }

        .settings-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-faint);
          margin: 0 0 8px;
        }

        .settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .settings-value {
          font-size: 13px;
          color: var(--text);
          word-break: break-all;
        }

        .settings-value.mono {
          font-family: var(--mono);
          font-size: 12px;
        }

        .eye-btn {
          background: var(--panel-raised);
          border: 1px solid var(--border-solid);
          border-radius: 8px;
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          cursor: pointer;
        }

        .danger-zone {
          border-color: rgba(239,68,68,0.3);
        }

        .danger-label {
          color: var(--danger);
        }

        .danger-desc {
          font-size: 12px;
          color: var(--text-dim);
          line-height: 1.6;
          margin: 0 0 12px;
        }

        .delete-btn {
          background: var(--danger);
          color: #fff;
          border: none;
          padding: 11px 18px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
          width: 100%;
          transition: filter 0.15s ease;
        }

        .delete-btn:hover:not(:disabled) {
          filter: brightness(1.1);
        }

        .delete-btn:disabled {
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}
