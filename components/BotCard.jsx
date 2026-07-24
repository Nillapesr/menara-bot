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
  const [editingId, setEditingId] = useState(null);
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
    <div className={`brut-card ${!isActive ? 'paused' : ''}`}>
      <div className="brut-stripe" />
      
      <div className="brut-body">
        <div className="brut-header">
          <div>
            <div className="brut-username">@{bot.username}</div>
            <div className="brut-name">{bot.firstName}</div>
          </div>
          <div className={`brut-badge ${isActive ? 'live' : 'dead'}`}>
            {isActive ? '● LIVE' : '○ OFFLINE'}
          </div>
        </div>

        <div className="brut-stats">
          <span className="brut-stat">📊 {bot.messageCount || 0} msgs</span>
          <span className="brut-stat">⚡ {bot.commands?.length || 0} cmds</span>
        </div>

        <div className="brut-actions">
          <button onClick={toggleStatus} disabled={busy} className="brut-btn brut-btn-toggle">
            {isActive ? '⏸ PAUSE' : '▶ PLAY'}
          </button>
          <button onClick={() => setExpanded((e) => !e)} className="brut-btn brut-btn-edit">
            {expanded ? '✕ CLOSE' : '⚙ CONFIG'}
          </button>
          <button onClick={removeBot} disabled={busy} className="brut-btn brut-btn-danger">
            ✕ KILL
          </button>
        </div>

        {expanded && (
          <div className="brut-editor">
            <div className="brut-tabs">
              <button
                className={`brut-tab ${mode === 'rules' ? 'active' : ''}`}
                onClick={() => setMode('rules')}
              >
                📝 RULES
              </button>
              <button
                className={`brut-tab ${mode === 'commands' ? 'active' : ''}`}
                onClick={() => setMode('commands')}
              >
                💻 COMMANDS
              </button>
            </div>

            {mode === 'rules' && (
              <>
                <div className="brut-field">
                  <label>WELCOME MESSAGE</label>
                  <textarea
                    value={welcome}
                    onChange={(e) => setWelcome(e.target.value)}
                    rows={2}
                    className="brut-input"
                  />
                </div>

                <div className="brut-field">
                  <label>FALLBACK REPLY</label>
                  <textarea
                    value={fallback}
                    onChange={(e) => setFallback(e.target.value)}
                    rows={2}
                    className="brut-input"
                  />
                </div>

                <div className="brut-rules-header">
                  <label>KEYWORD RULES</label>
                  <button onClick={addRule} className="brut-btn-add">+ ADD</button>
                </div>

                {rules.length === 0 && (
                  <div className="brut-empty">∅ No rules defined</div>
                )}

                {rules.map((rule, idx) => (
                  <div className="brut-rule" key={idx}>
                    <input
                      placeholder="trigger"
                      value={rule.trigger}
                      onChange={(e) => updateRule(idx, 'trigger', e.target.value)}
                      className="brut-input"
                    />
                    <select
                      value={rule.type}
                      onChange={(e) => updateRule(idx, 'type', e.target.value)}
                      className="brut-select"
                    >
                      <option value="contains">contains</option>
                      <option value="exact">exact</option>
                      <option value="starts">starts</option>
                    </select>
                    <input
                      placeholder="reply"
                      value={rule.reply}
                      onChange={(e) => updateRule(idx, 'reply', e.target.value)}
                      className="brut-input"
                    />
                    <button onClick={() => removeRule(idx)} className="brut-btn-remove">✕</button>
                  </div>
                ))}

                <button onClick={saveRules} disabled={saving} className="brut-btn-save">
                  {saving ? 'SAVING...' : '💾 SAVE'}
                </button>
              </>
            )}

            {mode === 'commands' && (
              <>
                <div className="brut-templates">
                  <span className="brut-label-sm">TEMPLATES:</span>
                  <button className="brut-btn-sm" onClick={() => loadTemplate(TEMPLATE_BASIC)}>
                    BASIC
                  </button>
                  <button className="brut-btn-sm" onClick={() => loadTemplate(TEMPLATE_AI)}>
                    AI
                  </button>
                </div>

                <div className="brut-add-cmd">
                  <input
                    placeholder="/command"
                    value={newTrigger}
                    onChange={(e) => setNewTrigger(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCommand()}
                    className="brut-input"
                  />
                  <button
                    className="brut-btn-save"
                    onClick={() => addCommand()}
                    disabled={addingCommand || !newTrigger.trim()}
                  >
                    + NEW
                  </button>
                </div>

                {commands.length === 0 && (
                  <div className="brut-empty">∅ No commands yet</div>
                )}

                <div className="brut-commands">
                  {commands.map((cmd) => (
                    <div className="brut-cmd-item" key={cmd.id}>
                      <div className="brut-cmd-trigger">{cmd.trigger}</div>
                      <div className="brut-cmd-actions">
                        <button
                          className="brut-btn-code"
                          onClick={() => (editingId === cmd.id ? closeEditor() : openEditor(cmd))}
                        >
                          {editingId === cmd.id ? '✕ CLOSE' : '</> EDIT'}
                        </button>
                        <button
                          className="brut-btn-remove"
                          onClick={() => removeCommand(cmd.id)}
                        >
                          🗑
                        </button>
                      </div>

                      {editingId === cmd.id && (
                        <div className="brut-code-editor">
                          <textarea
                            className="brut-code-area"
                            value={draftCode}
                            onChange={(e) => {
                              setDraftCode(e.target.value);
                              setDraftSaved(false);
                            }}
                            rows={12}
                            spellCheck={false}
                            placeholder="async function handle(ctx) { ... }"
                          />

                          <div className="brut-code-hint">
                            <span>📘 Available: ctx.text • ctx.sendMessage() • ctx.sendPhoto() • ctx.callAI() • ctx.fetchJSON()</span>
                          </div>

                          {draftError && <div className="brut-error">{draftError}</div>}
                          {draftSaved && <div className="brut-success">✓ Saved & active</div>}

                          <button
                            onClick={() => saveCommandCode(cmd.id)}
                            disabled={draftSaving}
                            className="brut-btn-save"
                          >
                            {draftSaving ? 'SAVING...' : '💾 DEPLOY'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="brut-field">
                  <label>DEFAULT FALLBACK</label>
                  <textarea
                    value={fallback}
                    onChange={(e) => setFallback(e.target.value)}
                    rows={2}
                    className="brut-input"
                    onBlur={saveRules}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .brut-card {
          background: #0a0b0e;
          border: 2px solid #2a2b2e;
          border-radius: 0;
          box-shadow: 8px 8px 0 #1a1b1e;
          margin-bottom: 24px;
          position: relative;
          transition: all 0.1s ease;
          font-family: 'Courier New', monospace;
        }

        .brut-card:hover {
          transform: translate(-2px, -2px);
          box-shadow: 12px 12px 0 #1a1b1e;
        }

        .brut-card.paused {
          opacity: 0.6;
          filter: grayscale(0.8);
        }

        .brut-stripe {
          height: 4px;
          background: linear-gradient(90deg, #ff0055, #ff6600, #ffcc00, #00ff66, #0066ff, #ff0055);
          background-size: 300% 100%;
          animation: stripemove 3s linear infinite;
        }

        @keyframes stripemove {
          0% { background-position: 0% 0%; }
          100% { background-position: 300% 0%; }
        }

        .brut-card.paused .brut-stripe {
          background: #2a2b2e;
          animation: none;
        }

        .brut-body {
          padding: 24px;
        }

        .brut-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #2a2b2e;
          padding-bottom: 16px;
          margin-bottom: 16px;
        }

        .brut-username {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.5px;
          text-transform: uppercase;
        }

        .brut-name {
          font-size: 12px;
          color: #6a6b6e;
          margin-top: 4px;
        }

        .brut-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 12px;
          border: 2px solid;
          letter-spacing: 1px;
        }

        .brut-badge.live {
          color: #00ff66;
          border-color: #00ff66;
          background: rgba(0, 255, 102, 0.05);
        }

        .brut-badge.dead {
          color: #6a6b6e;
          border-color: #4a4b4e;
        }

        .brut-stats {
          display: flex;
          gap: 24px;
          margin-bottom: 16px;
          font-size: 11px;
          color: #6a6b6e;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .brut-stat {
          border-right: 2px solid #1a1b1e;
          padding-right: 24px;
        }

        .brut-stat:last-child {
          border-right: none;
        }

        .brut-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .brut-btn {
          padding: 8px 16px;
          border: 2px solid #2a2b2e;
          background: #0a0b0e;
          color: #aaa;
          font-family: 'Courier New', monospace;
          font-weight: 700;
          font-size: 11px;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.1s ease;
          text-transform: uppercase;
        }

        .brut-btn:hover {
          background: #1a1b1e;
          border-color: #4a4b4e;
          color: #fff;
        }

        .brut-btn:active {
          transform: scale(0.95);
        }

        .brut-btn-toggle {
          color: #00ff66;
          border-color: #00ff66;
        }

        .brut-btn-toggle:hover {
          background: rgba(0, 255, 102, 0.05);
        }

        .brut-btn-edit {
          color: #ffcc00;
          border-color: #ffcc00;
        }

        .brut-btn-edit:hover {
          background: rgba(255, 204, 0, 0.05);
        }

        .brut-btn-danger {
          color: #ff0055;
          border-color: #ff0055;
        }

        .brut-btn-danger:hover {
          background: rgba(255, 0, 85, 0.05);
        }

        .brut-editor {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 2px solid #1a1b1e;
        }

        .brut-tabs {
          display: flex;
          gap: 0;
          margin-bottom: 20px;
          border: 2px solid #2a2b2e;
        }

        .brut-tab {
          flex: 1;
          padding: 10px;
          background: #0a0b0e;
          border: none;
          color: #6a6b6e;
          font-family: 'Courier New', monospace;
          font-weight: 700;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.1s ease;
          letter-spacing: 0.5px;
          border-right: 2px solid #2a2b2e;
        }

        .brut-tab:last-child {
          border-right: none;
        }

        .brut-tab:hover {
          background: #1a1b1e;
        }

        .brut-tab.active {
          background: #1a1b1e;
          color: #fff;
          border-bottom: 3px solid #ffcc00;
        }

        .brut-field {
          margin-bottom: 16px;
        }

        .brut-field label {
          display: block;
          font-size: 10px;
          color: #6a6b6e;
          font-weight: 700;
          letter-spacing: 1px;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .brut-input {
          width: 100%;
          padding: 10px;
          background: #0a0b0e;
          border: 2px solid #2a2b2e;
          color: #fff;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          outline: none;
          transition: border-color 0.1s ease;
        }

        .brut-input:focus {
          border-color: #ffcc00;
        }

        .brut-select {
          padding: 10px;
          background: #0a0b0e;
          border: 2px solid #2a2b2e;
          color: #fff;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          outline: none;
        }

        .brut-rules-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 16px 0 12px;
        }

        .brut-rules-header label {
          font-size: 10px;
          color: #6a6b6e;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .brut-btn-add {
          background: none;
          border: 2px solid #ffcc00;
          color: #ffcc00;
          padding: 4px 12px;
          font-family: 'Courier New', monospace;
          font-weight: 700;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.1s ease;
        }

        .brut-btn-add:hover {
          background: rgba(255, 204, 0, 0.05);
        }

        .brut-empty {
          padding: 24px;
          text-align: center;
          color: #4a4b4e;
          font-size: 14px;
          border: 2px dashed #2a2b2e;
          margin: 12px 0;
          font-weight: 700;
        }

        .brut-rule {
          display: grid;
          grid-template-columns: 1fr 100px 1fr auto;
          gap: 8px;
          margin-bottom: 8px;
          align-items: center;
        }

        .brut-btn-remove {
          background: #0a0b0e;
          border: 2px solid #2a2b2e;
          color: #6a6b6e;
          padding: 8px 12px;
          cursor: pointer;
          font-weight: 700;
          transition: all 0.1s ease;
        }

        .brut-btn-remove:hover {
          border-color: #ff0055;
          color: #ff0055;
        }

        .brut-btn-save {
          padding: 10px 24px;
          background: #0a0b0e;
          border: 2px solid #00ff66;
          color: #00ff66;
          font-family: 'Courier New', monospace;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.1s ease;
          margin-top: 8px;
          letter-spacing: 0.5px;
        }

        .brut-btn-save:hover:not(:disabled) {
          background: rgba(0, 255, 102, 0.05);
        }

        .brut-btn-save:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .brut-templates {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .brut-label-sm {
          font-size: 10px;
          color: #6a6b6e;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .brut-btn-sm {
          padding: 4px 12px;
          background: #0a0b0e;
          border: 2px solid #2a2b2e;
          color: #aaa;
          font-family: 'Courier New', monospace;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.1s ease;
          letter-spacing: 0.5px;
        }

        .brut-btn-sm:hover {
          border-color: #4a4b4e;
          color: #fff;
        }

        .brut-add-cmd {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .brut-commands {
          margin: 12px 0 16px;
        }

        .brut-cmd-item {
          border: 2px solid #2a2b2e;
          padding: 12px;
          margin-bottom: 12px;
          background: #0a0b0e;
        }

        .brut-cmd-trigger {
          display: inline-block;
          padding: 2px 12px;
          background: #1a1b1e;
          color: #ffcc00;
          font-weight: 700;
          font-size: 12px;
          border: 2px solid #2a2b2e;
          margin-bottom: 8px;
          font-family: 'Courier New', monospace;
        }

        .brut-cmd-actions {
          display: flex;
          gap: 8px;
        }

        .brut-btn-code {
          flex: 1;
          padding: 8px;
          background: #0a0b0e;
          border: 2px solid #2a2b2e;
          color: #aaa;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.1s ease;
          letter-spacing: 0.5px;
        }

        .brut-btn-code:hover {
          border-color: #4a4b4e;
          color: #fff;
        }

        .brut-code-editor {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 2px dashed #2a2b2e;
        }

        .brut-code-area {
          width: 100%;
          padding: 12px;
          background: #050608;
          border: 2px solid #2a2b2e;
          color: #00ff66;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.6;
          outline: none;
          min-height: 260px;
        }

        .brut-code-area:focus {
          border-color: #ffcc00;
        }

        .brut-code-hint {
          padding: 8px;
          background: #1a1b1e;
          font-size: 10px;
          color: #6a6b6e;
          font-weight: 700;
          letter-spacing: 0.5px;
          margin: 4px 0;
        }

        .brut-error {
          padding: 10px;
          background: rgba(255, 0, 85, 0.05);
          border: 2px solid #ff0055;
          color: #ff0055;
          font-size: 12px;
          font-weight: 700;
          margin: 4px 0;
        }

        .brut-success {
          padding: 10px;
          background: rgba(0, 255, 102, 0.05);
          border: 2px solid #00ff66;
          color: #00ff66;
          font-size: 12px;
          font-weight: 700;
          margin: 4px 0;
        }

        @media (max-width: 640px) {
          .brut-rule {
            grid-template-columns: 1fr;
          }
          
          .brut-header {
            flex-direction: column;
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
}
