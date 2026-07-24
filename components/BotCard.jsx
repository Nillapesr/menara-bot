'use client';

import { useState } from 'react';

const TEMPLATE_BASIC = `// Fungsi handle(ctx) dipanggil setiap ada pesan masuk ke bot.
// ctx.text -> teks pesan dari user
// ctx.sendMessage(text, { buttons }) -> kirim teks (+ tombol opsional)
// ctx.sendPhoto(url, { caption, buttons }) -> kirim gambar
// ctx.callAI({ apiKey, messages }) -> panggil API AI (format ChatGPT)
// ctx.fetchJSON(url, opts) -> panggil API luar apa saja

async function handle(ctx) {
  if (ctx.text === '/start') {
    await ctx.sendMessage('Halo! Bot ini pakai kode custom.', {
      buttons: [[{ text: 'Lihat gambar', callback_data: 'lihat_gambar' }]],
    });
    return;
  }

  if (ctx.text.includes('gambar')) {
    await ctx.sendPhoto('https://picsum.photos/500', { caption: 'Ini contoh gambar.' });
    return;
  }

  await ctx.sendMessage('Kamu bilang: ' + ctx.text);
}`;

const TEMPLATE_AI = `// Contoh bot yang terhubung ke API ChatGPT (atau kompatibel OpenAI lain).
// Ganti API_KEY dengan API key kamu sendiri.

const API_KEY = 'MASUKKAN_API_KEY_DI_SINI';

async function handle(ctx) {
  if (ctx.text === '/start') {
    await ctx.sendMessage('Halo! Tanya apa saja, saya akan jawab pakai AI.');
    return;
  }

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

export default function BotCard({ bot, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [rules, setRules] = useState(bot.rules || []);
  const [welcome, setWelcome] = useState(bot.welcomeMessage || '');
  const [fallback, setFallback] = useState(bot.fallbackMessage || '');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(bot.mode || 'rules');
  const [commands, setCommands] = useState(bot.commands || []);
  const [editingId, setEditingId] = useState(null); // command yang sedang dibuka editornya
  const [draftCode, setDraftCode] = useState('');
  const [draftError, setDraftError] = useState('');
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [newTrigger, setNewTrigger] = useState('');
  const [addingCommand, setAddingCommand] = useState(false);

  const isActive = bot.status === 'active';

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
        setMode('commands');
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

  function addRule() {
    setRules((r) => [...r, { trigger: '', type: 'contains', reply: '' }]);
  }

  function updateRule(idx, field, value) {
    setRules((r) => r.map((rule, i) => (i === idx ? { ...rule, [field]: value } : rule)));
  }

  function removeRule(idx) {
    setRules((r) => r.filter((_, i) => i !== idx));
  }

  async function saveRules() {
    setSaving(true);
    await fetch(`/api/bots/${bot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rules: rules.filter((r) => r.trigger.trim() && r.reply.trim()),
        welcomeMessage: welcome,
        fallbackMessage: fallback,
      }),
    });
    setSaving(false);
    onChange?.();
  }

  return (
    <div className={`card ${!isActive ? 'paused' : ''}`}>
      <div className="pulse-bar" aria-hidden="true" />

      <div className="card-body">
        <div className="card-head">
          <div>
            <p className="username">@{bot.username}</p>
            <p className="name">{bot.firstName}</p>
          </div>
          <span className={`badge ${isActive ? 'live' : 'off'}`}>
            {isActive ? 'aktif' : 'dijeda'}
          </span>
        </div>

        <div className="meta-row">
          <span>{bot.messageCount || 0} pesan diproses</span>
        </div>

        <div className="actions">
          <button onClick={toggleStatus} disabled={busy} className="btn-secondary">
            {isActive ? 'Jeda bot' : 'Aktifkan lagi'}
          </button>
          <button onClick={() => setExpanded((e) => !e)} className="btn-secondary">
            {expanded ? 'Tutup pengaturan' : 'Atur balasan'}
          </button>
          <button onClick={removeBot} disabled={busy} className="btn-danger">
            Hapus
          </button>
        </div>

        {expanded && (
          <div className="editor">
            <div className="mode-switch">
              <button
                className={`mode-btn ${mode === 'rules' ? 'active' : ''}`}
                onClick={() => setMode('rules')}
              >
                Kata kunci (tanpa kode)
              </button>
              <button
                className={`mode-btn ${mode === 'commands' ? 'active' : ''}`}
                onClick={() => setMode('commands')}
              >
                Commands (JS per-command)
              </button>
            </div>

            {mode === 'rules' && (
              <>
                <div className="editor-field">
                  <label>Pesan saat /start</label>
                  <textarea
                    value={welcome}
                    onChange={(e) => setWelcome(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="editor-field">
                  <label>Balasan default (jika tak ada kata kunci cocok)</label>
                  <textarea
                    value={fallback}
                    onChange={(e) => setFallback(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="rules-head">
                  <label>Kata kunci &amp; balasan otomatis</label>
                  <button onClick={addRule} className="btn-add">+ Tambah</button>
                </div>

                {rules.length === 0 && (
                  <p className="empty-rules">Belum ada kata kunci. Tambahkan agar bot bisa membalas otomatis.</p>
                )}

                {rules.map((rule, idx) => (
                  <div className="rule-row" key={idx}>
                    <input
                      placeholder="kata kunci"
                      value={rule.trigger}
                      onChange={(e) => updateRule(idx, 'trigger', e.target.value)}
                    />
                    <select
                      value={rule.type}
                      onChange={(e) => updateRule(idx, 'type', e.target.value)}
                    >
                      <option value="contains">mengandung</option>
                      <option value="exact">persis sama</option>
                      <option value="starts">diawali</option>
                    </select>
                    <input
                      placeholder="balasan"
                      value={rule.reply}
                      onChange={(e) => updateRule(idx, 'reply', e.target.value)}
                    />
                    <button onClick={() => removeRule(idx)} className="btn-remove" aria-label="Hapus kata kunci">
                      Ã
                    </button>
                  </div>
                ))}

                <button onClick={saveRules} disabled={saving} className="btn-save">
                  {saving ? 'Menyimpanâ¦' : 'Simpan pengaturan'}
                </button>
              </>
            )}

            {mode === 'commands' && (
              <>
                <div className="template-row">
                  <span className="template-label">Mulai dari template:</span>
                  <button className="btn-add" onClick={() => loadTemplate(TEMPLATE_BASIC)}>
                    Dasar (teks + gambar + tombol)
                  </button>
                  <button className="btn-add" onClick={() => loadTemplate(TEMPLATE_AI)}>
                    Terhubung AI (ChatGPT)
                  </button>
                </div>

                <div className="add-command-row">
                  <input
                    placeholder="/start, /play, help_menuâ¦"
                    value={newTrigger}
                    onChange={(e) => setNewTrigger(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCommand()}
                  />
                  <button
                    className="btn-save btn-new-cmd"
                    onClick={() => addCommand()}
                    disabled={addingCommand || !newTrigger.trim()}
                  >
                    + New
                  </button>
                </div>

                {commands.length === 0 && (
                  <p className="empty-rules">Belum ada command. Tambahkan trigger di atas untuk membuat command pertama.</p>
                )}

                <div className="command-list">
                  {commands.map((cmd) => (
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
                          â
                        </button>
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => removeCommand(cmd.id)}
                          aria-label="Hapus command"
                        >
                          ð
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
                            <code>ctx.sendPhoto()</code>, <code>ctx.sendButtons()</code>,{' '}
                            <code>ctx.answerCallback()</code>, <code>ctx.callAI()</code>, <code>ctx.fetchJSON()</code>.
                            Tidak ada akses ke <code>require</code>/<code>process</code>/filesystem.
                          </p>

                          {draftError && <p className="code-error">{draftError}</p>}
                          {draftSaved && <p className="code-ok">Kode tersimpan dan aktif.</p>}

                          <button
                            onClick={() => saveCommandCode(cmd.id)}
                            disabled={draftSaving}
                            className="btn-save"
                          >
                            {draftSaving ? 'Menyimpanâ¦' : 'Simpan & aktifkan kode'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="editor-field" style={{ marginTop: 8 }}>
                  <label>Balasan default (jika tak ada command yang cocok)</label>
                  <textarea
                    value={fallback}
                    onChange={(e) => setFallback(e.target.value)}
                    rows={2}
                    onBlur={saveRules}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .card {
          position: relative;
          display: flex;
          background: linear-gradient(180deg, var(--panel) 0%, #0d0f16 100%);
          border: 1px solid var(--border-solid);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 1px 0 rgba(255,255,255,0.02) inset, 0 20px 40px -24px rgba(0,0,0,0.6);
        }

        .pulse-bar {
          width: 3px;
          flex-shrink: 0;
          background: var(--signal-grad);
          animation: pulse 2.6s ease-in-out infinite;
        }

        .card.paused .pulse-bar {
          background: var(--text-faint);
          animation: none;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .card-body {
          flex: 1;
          padding: 20px 22px;
          min-width: 0;
        }

        .card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }

        .username {
          font-family: var(--display);
          font-weight: 700;
          font-size: 16px;
          letter-spacing: -0.01em;
          margin: 0;
        }

        .name {
          margin: 3px 0 0;
          color: var(--text-dim);
          font-size: 12px;
        }

        .badge {
          font-size: 10px;
          font-family: var(--mono);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 4px 10px 4px 8px;
          border-radius: 100px;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .badge::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .badge.live {
          background: linear-gradient(180deg, rgba(124,92,255,0.16), rgba(74,212,255,0.10));
          color: var(--signal-2);
          border: 1px solid rgba(124,92,255,0.3);
        }

        .badge.live::before {
          animation: pulse 1.8s ease-in-out infinite;
        }

        .badge.off {
          background: var(--panel-raised);
          color: var(--text-faint);
          border: 1px solid var(--border-solid);
        }

        .meta-row {
          margin-top: 10px;
          font-size: 12px;
          color: var(--text-faint);
          font-family: var(--mono);
        }

        .actions {
          display: flex;
          gap: 8px;
          margin-top: 14px;
          flex-wrap: wrap;
        }

        .btn-secondary, .btn-danger {
          background: var(--panel-raised);
          border: 1px solid var(--border-solid);
          color: var(--text-dim);
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
        }

        .btn-secondary:hover {
          color: var(--text);
          border-color: rgba(124,92,255,0.4);
        }

        .btn-danger:hover {
          color: var(--danger);
          border-color: var(--danger);
        }

        .btn-secondary:active, .btn-danger:active {
          transform: scale(0.97);
        }

        .editor {
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid var(--border-solid);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .editor-field label,
        .rules-head label {
          display: block;
          font-size: 11px;
          color: var(--text-faint);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 6px;
        }

        textarea, input, select {
          width: 100%;
          background: var(--bg);
          border: 1px solid var(--border-solid);
          color: var(--text);
          padding: 9px 11px;
          border-radius: 8px;
          font-size: 13px;
          font-family: var(--sans);
          outline: none;
          resize: vertical;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        textarea:focus, input:focus, select:focus {
          border-color: var(--signal);
          box-shadow: 0 0 0 3px rgba(124,92,255,0.15);
        }

        .rules-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 6px;
        }

        .mode-switch {
          display: flex;
          gap: 6px;
          margin-bottom: 4px;
          background: var(--bg);
          padding: 4px;
          border-radius: 10px;
          border: 1px solid var(--border-solid);
        }

        .mode-btn {
          flex: 1;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-faint);
          padding: 8px 10px;
          border-radius: 7px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .mode-btn.active {
          color: #fff;
          background: var(--signal-grad);
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

        .code-editor {
          font-family: var(--mono);
          font-size: 12px;
          line-height: 1.65;
          background: #05060a;
          border: 1px solid var(--border-solid);
          min-height: 260px;
          white-space: pre;
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
          border-radius: 6px;
          margin: 0;
        }

        .code-ok {
          background: var(--signal-dim);
          color: var(--signal);
          font-size: 12px;
          padding: 8px 10px;
          border-radius: 6px;
          margin: 0;
        }

        .btn-add {
          background: none;
          border: none;
          color: var(--signal);
          font-size: 12px;
          cursor: pointer;
          padding: 0;
        }

        .empty-rules {
          font-size: 12px;
          color: var(--text-faint);
          margin: 0;
        }

        .rule-row {
          display: grid;
          grid-template-columns: 1fr 100px 1fr auto;
          gap: 6px;
          align-items: center;
        }

        .rule-row select {
          font-size: 11px;
          padding: 8px 4px;
        }

        .btn-remove {
          background: var(--panel-raised);
          border: 1px solid var(--border-solid);
          color: var(--text-faint);
          width: 30px;
          height: 34px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          transition: border-color 0.15s ease, color 0.15s ease;
        }

        .btn-remove:hover {
          color: var(--danger);
          border-color: var(--danger);
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
          margin-top: 4px;
          transition: filter 0.15s ease, transform 0.1s ease;
        }

        .btn-save:hover:not(:disabled) {
          filter: brightness(1.1);
        }

        .btn-save:active:not(:disabled) {
          transform: scale(0.97);
        }

        .btn-save:disabled {
          opacity: 0.5;
          cursor: default;
        }

        .add-command-row {
          display: flex;
          gap: 8px;
        }

        .btn-new-cmd {
          margin-top: 0;
          white-space: nowrap;
          flex-shrink: 0;
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
          box-shadow: 0 0 0 3px rgba(74,212,255,0.15);
        }

        .command-item:hover {
          border-color: rgba(124,92,255,0.35);
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
          border-color: rgba(124,92,255,0.4);
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

        @media (max-width: 480px) {
          .rule-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
