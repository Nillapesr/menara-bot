'use client';

import { useState, useRef, useEffect } from 'react';

const TEMPLATE_BASIC = `// Fungsi handle(ctx) dipanggil setiap ada pesan/klik tombol masuk ke command ini.
// ctx.text -> teks pesan dari user
// ctx.callbackData -> data tombol yang diklik (kalau ini dipicu oleh callback)
// ctx.sendMessage(text, { buttons }) -> kirim teks (+ tombol opsional)
// ctx.sendPhoto(url, { caption, buttons }) -> kirim gambar
// ctx.editMessageText(text, { buttons }) -> edit pesan yang tombolnya baru diklik
// ctx.editMessageReplyMarkup(buttons) -> ganti/hapus tombol tanpa ubah teks
// ctx.deleteMessage() -> hapus pesan yang tombolnya baru diklik
// ctx.answerCallback(text) -> balas klik tombol (hilangkan loading di Telegram)
// ctx.callAI({ apiKey, messages }) -> panggil API AI (format ChatGPT)
// ctx.fetchJSON(url, opts) -> panggil API luar apa saja

async function handle(ctx) {
  await ctx.sendMessage(
    '<b>Halo!</b> Bot ini pakai kode custom.\\n<blockquote>Bisa pakai tag HTML kayak gini.</blockquote>',
    { buttons: [[{ text: 'Lihat gambar', callback_data: 'lihat_gambar' }]] }
  );
}`;

const TEMPLATE_AI = `// Contoh command yang terhubung ke API ChatGPT (atau kompatibel OpenAI lain).
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

const TEMPLATE_WELCOME = `// Trigger WAJIB diisi "@join". Otomatis jalan tiap ada anggota baru masuk grup.
async function handle(ctx) {
  const names = (ctx.newChatMembers || [])
    .map((u) => u.first_name || u.username || 'teman baru')
    .join(', ');
  await ctx.sendMessage(\`👋 Selamat datang, \${names}! Baca dulu aturan grup ya.\`);
}`;

const TEMPLATE_MODERATION = `// Moderasi grup: /mute, /kick, /ban, /pin — reply ke pesan target dulu.
async function handle(ctx) {
  if (ctx.chatType !== 'group' && ctx.chatType !== 'supergroup') {
    await ctx.sendMessage('Command ini cuma bisa dipakai di dalam grup.'); return;
  }
  const callerIsAdmin = await ctx.isGroupAdmin(ctx.from?.id);
  if (!callerIsAdmin) {
    await ctx.sendMessage('Cuma admin grup yang boleh pakai command ini.'); return;
  }
  const target = ctx.message?.reply_to_message?.from;
  if (!target) {
    await ctx.sendMessage('Reply pesan orang yang mau dimoderasi, baru ketik command ini.'); return;
  }
  await ctx.muteUser(target.id, 60 * 60);
  await ctx.sendMessage(\`🔇 \${target.first_name} dimute selama 1 jam.\`);
}`;

const TEMPLATE_EDIT_DELETE = `// Command dengan tombol edit/hapus pesan. Trigger: /menu
async function handle(ctx) {
  if (ctx.callbackData === 'edit_ya') {
    await ctx.editMessageText('<b>Pesan sudah diedit ✅</b>', {
      buttons: [[{ text: 'Hapus pesan ini', callback_data: 'hapus_ya' }]],
    });
    await ctx.answerCallback('Berhasil diedit!'); return;
  }
  if (ctx.callbackData === 'hapus_ya') {
    await ctx.deleteMessage();
    await ctx.answerCallback('Pesan dihapus.'); return;
  }
  await ctx.sendMessage('Pilih aksi untuk pesan ini:', {
    buttons: [
      [{ text: '✏️ Edit pesan', callback_data: 'edit_ya' }],
      [{ text: '🗑️ Hapus pesan', callback_data: 'hapus_ya' }],
    ],
  });
}`;

const TABS = [
  { id: 'intro', label: 'Info' },
  { id: 'commands', label: 'Commands' },
  { id: 'settings', label: 'Settings' },
];

function initials(name) {
  return (name || '?').split(' ').filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase()).join('') || '?';
}

export default function BotCard({ bot, onChange }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('intro');
  const [busy, setBusy] = useState(false);

  const [commands, setCommands] = useState(bot.commands || []);
  const [editingId, setEditingId] = useState(null);
  const [draftCode, setDraftCode] = useState('');
  const [draftError, setDraftError] = useState('');
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [newTrigger, setNewTrigger] = useState('');
  const [addingCommand, setAddingCommand] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  const [fallback, setFallback] = useState(bot.fallbackMessage || '');
  const [savingFallback, setSavingFallback] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const isActive = bot.status === 'active';
  const maskedToken = bot.token ? '•'.repeat(20) + bot.token.slice(-6) : '';

  useEffect(() => {
    if (!editingId) return;
    const onKey = (e) => { if (e.key === 'Escape') closeEditor(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingId]);

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

  async function addCommand(initialCode = '', triggerOverride = null) {
    const trigger = (triggerOverride ?? newTrigger).trim();
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
    } catch {
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
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(cmdId); return n; });
      if (editingId === cmdId) closeEditor();
      onChange?.();
    }
  }

  function toggleSelectMode() { setSelectMode((s) => !s); setSelectedIds(new Set()); }
  function toggleSelected(cmdId) {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(cmdId) ? n.delete(cmdId) : n.add(cmdId); return n; });
  }
  function selectAllFiltered() { setSelectedIds(new Set(filteredCommands.map((c) => c.id))); }
  function clearSelection() { setSelectedIds(new Set()); }

  async function deleteCommandsByIds(ids) {
    if (!ids.length) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.all(
        ids.map((id) => fetch(`/api/bots/${bot.id}/commands/${id}`, { method: 'DELETE' }).then((r) => r.ok ? r.json() : null))
      );
      const last = results.filter(Boolean).pop();
      if (last) { setCommands(last.commands); }
      else { setCommands((prev) => prev.filter((c) => !ids.includes(c.id))); }
      setSelectedIds(new Set());
      if (editingId && ids.includes(editingId)) closeEditor();
      onChange?.();
    } finally {
      setBulkDeleting(false);
    }
  }

  async function deleteSelected() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!confirm(`Hapus ${ids.length} command yang dipilih?`)) return;
    await deleteCommandsByIds(ids);
    setSelectMode(false);
  }

  async function deleteAllCommands() {
    if (!commands.length) return;
    if (!confirm(`Hapus SEMUA ${commands.length} command? Tidak bisa dibatalkan.`)) return;
    await deleteCommandsByIds(commands.map((c) => c.id));
    setSelectMode(false);
  }

  function loadTemplate(tpl, defaultTrigger = '/start') {
    const trigger = newTrigger.trim() || defaultTrigger;
    setNewTrigger(trigger);
    addCommand(tpl, trigger);
  }

  function exportCommands() {
    const payload = {
      exportedFrom: 'sanzu-cloud',
      botUsername: bot.username,
      exportedAt: new Date().toISOString(),
      items: commands.map((c) => ({ trigger: c.trigger, code: c.code || '' })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(bot.username || 'bot').replace(/[^a-z0-9_-]/gi, '_')}-commands.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function pickImportFile() { setImportMsg(null); fileInputRef.current?.click(); }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setImportMsg({ type: 'error', text: 'File harus berformat .json.' }); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setImportMsg({ type: 'error', text: 'File terlalu besar (maks 2MB).' }); return;
    }
    setImporting(true);
    setImportMsg(null);
    try {
      const text = await file.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch {
        setImportMsg({ type: 'error', text: 'File bukan JSON yang valid.' }); return;
      }
      const items = Array.isArray(parsed) ? parsed : parsed.items;
      if (!Array.isArray(items)) {
        setImportMsg({ type: 'error', text: 'Format tidak dikenali.' }); return;
      }
      const res = await fetch(`/api/bots/${bot.id}/commands/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) { setImportMsg({ type: 'error', text: data.error || 'Gagal mengimpor command.' }); return; }
      setCommands(data.commands);
      onChange?.();
      const skipped = data.rejected?.length || 0;
      setImportMsg({
        type: 'ok',
        text: skipped
          ? `${data.importedCount} diimpor, ${skipped} dilewati.`
          : `${data.importedCount} command berhasil diimpor.`,
      });
    } catch {
      setImportMsg({ type: 'error', text: 'Tidak bisa menghubungi server.' });
    } finally {
      setImporting(false);
    }
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
    <div className={`card ${open ? 'card-open' : ''}`}>
      {/* ── Row header ── */}
      <div className="card-head">
        <button className="head-main" onClick={() => setOpen((o) => !o)}>
          <span className="avatar">{initials(bot.firstName || bot.username)}</span>
          <span className="head-info">
            <span className="head-name">{bot.firstName || bot.username}</span>
            <span className="head-username">@{bot.username}</span>
          </span>
          <span className={`pill ${isActive ? 'pill-ok' : 'pill-off'}`}>
            <span className="pill-dot" />
            {isActive ? 'Aktif' : 'Jeda'}
          </span>
        </button>

        <div className="head-actions">
          <span className="cmd-count">{commands.length} cmd</span>
          <button className="action-btn" onClick={() => { setTab('settings'); setOpen(true); }} title="Settings">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M13.3 6.3l-.9-.5a5 5 0 000-1.6l.9-.5a1 1 0 00.4-1.4l-1-1.7a1 1 0 00-1.4-.4l-.9.5A5 5 0 008.7 1V0H7.3v1a5 5 0 00-1.7.7l-.9-.5a1 1 0 00-1.4.4L2.3 3.3a1 1 0 00.4 1.4l.9.5a5 5 0 000 1.6l-.9.5a1 1 0 00-.4 1.4l1 1.7a1 1 0 001.4.4l.9-.5A5 5 0 007.3 11V12h1.4v-1a5 5 0 001.7-.7l.9.5a1 1 0 001.4-.4l1-1.7a1 1 0 00-.4-1.4z" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          </button>
          <button className="expand-btn" onClick={() => setOpen((o) => !o)}>
            {open ? 'Tutup' : 'Kelola'}
          </button>
        </div>
      </div>

      {/* ── Expanded panel ── */}
      {open && (
        <div className="card-body">
          <div className="tabbar">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab ${tab === t.id ? 'tab-active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Info tab ── */}
          {tab === 'intro' && (
            <div className="tab-content">
              <div className="info-grid">
                <div className="info-stat">
                  <span className="info-stat-n">{bot.userCount || 1}</span>
                  <span className="info-stat-l">Users</span>
                </div>
                <div className="info-stat">
                  <span className="info-stat-n">{commands.length}</span>
                  <span className="info-stat-l">Commands</span>
                </div>
                <div className="info-stat">
                  <span className="info-stat-n">{bot.messageCount || 0}</span>
                  <span className="info-stat-l">Pesan</span>
                </div>
              </div>

              <div className="info-status">
                <span className={`pill ${isActive ? 'pill-ok' : 'pill-off'}`}>
                  <span className="pill-dot" />
                  {isActive ? 'Online & membalas' : 'Dijeda'}
                </span>
                <button
                  onClick={toggleStatus}
                  disabled={busy}
                  className={`toggle-btn ${isActive ? 'toggle-stop' : 'toggle-start'}`}
                >
                  {isActive ? 'Stop Bot' : 'Start Bot'}
                </button>
              </div>
            </div>
          )}

          {/* ── Commands tab ── */}
          {tab === 'commands' && (
            <div className="tab-content">
              {/* Templates */}
              <div className="section-block">
                <p className="section-title">Template Cepat</p>
                <div className="template-chips">
                  <button className="chip" onClick={() => loadTemplate(TEMPLATE_BASIC, '/start')}>Teks + Tombol</button>
                  <button className="chip" onClick={() => loadTemplate(TEMPLATE_AI, '/ai')}>Sambung AI</button>
                  <button className="chip" onClick={() => loadTemplate(TEMPLATE_WELCOME, '@join')}>Welcome Grup</button>
                  <button className="chip" onClick={() => loadTemplate(TEMPLATE_MODERATION, '/mute')}>Moderasi</button>
                  <button className="chip" onClick={() => loadTemplate(TEMPLATE_EDIT_DELETE, '/menu')}>Edit/Hapus Pesan</button>
                </div>
              </div>

              {/* Toolbar */}
              <div className="cmd-toolbar">
                <div className="search-wrap">
                  <svg className="search-icon" width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <input
                    className="search-input"
                    placeholder="Cari command…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="toolbar-right">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportFile}
                    style={{ display: 'none' }}
                  />
                  <button className="tool-btn" onClick={pickImportFile} disabled={importing} title="Import JSON">
                    ↑ Import
                  </button>
                  <button className="tool-btn" onClick={exportCommands} disabled={!commands.length} title="Export JSON">
                    ↓ Export
                  </button>
                  <button
                    className={`tool-btn ${selectMode ? 'tool-btn-active' : ''}`}
                    onClick={toggleSelectMode}
                    disabled={!commands.length}
                  >
                    ☑ Pilih
                  </button>
                  <button
                    className="tool-btn tool-btn-danger"
                    onClick={deleteAllCommands}
                    disabled={!commands.length || bulkDeleting}
                  >
                    Hapus Semua
                  </button>
                </div>
              </div>

              {/* Add command row */}
              {!selectMode && (
                <div className="add-row">
                  <input
                    className="trigger-input"
                    placeholder="/start, /play, help_menu…"
                    value={newTrigger}
                    onChange={(e) => setNewTrigger(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCommand()}
                  />
                  <button
                    className="add-btn"
                    onClick={() => addCommand()}
                    disabled={addingCommand || !newTrigger.trim()}
                  >
                    + Buat Command
                  </button>
                </div>
              )}

              {selectMode && (
                <div className="bulk-bar">
                  <span className="bulk-info">{selectedIds.size} dipilih</span>
                  <button className="bulk-link" onClick={selectAllFiltered}>Semua ({filteredCommands.length})</button>
                  <button className="bulk-link" onClick={clearSelection} disabled={!selectedIds.size}>Kosongkan</button>
                  <button className="bulk-delete" onClick={deleteSelected} disabled={!selectedIds.size || bulkDeleting}>
                    {bulkDeleting ? 'Menghapus…' : `Hapus (${selectedIds.size})`}
                  </button>
                </div>
              )}

              {importMsg && (
                <div className={`msg-banner ${importMsg.type}`}>{importMsg.text}</div>
              )}

              {/* Command list */}
              {filteredCommands.length === 0 && (
                <p className="empty-msg">
                  {commands.length === 0
                    ? 'Belum ada command. Pakai template di atas atau tulis trigger sendiri.'
                    : 'Tidak ada command yang cocok.'}
                </p>
              )}

              <div className="cmd-grid">
                {filteredCommands.map((cmd) => (
                  <div
                    key={cmd.id}
                    className={`cmd-item ${selectMode ? 'selectable' : ''} ${selectedIds.has(cmd.id) ? 'selected' : ''}`}
                    onClick={selectMode ? () => toggleSelected(cmd.id) : undefined}
                  >
                    {selectMode && (
                      <input
                        type="checkbox"
                        className="cmd-check"
                        checked={selectedIds.has(cmd.id)}
                        onChange={() => toggleSelected(cmd.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <code className="cmd-trigger">{cmd.trigger}</code>
                    <div className="cmd-btns">
                      <button
                        className="cmd-edit"
                        onClick={(e) => { e.stopPropagation(); if (!selectMode) openEditor(cmd); }}
                        disabled={selectMode}
                      >
                        {'</>'} Edit JS
                      </button>
                      <button
                        className="cmd-del"
                        onClick={(e) => { e.stopPropagation(); removeCommand(cmd.id); }}
                        aria-label="Hapus"
                        disabled={selectMode}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Fallback */}
              <div className="section-block" style={{ marginTop: 20 }}>
                <label className="section-title" htmlFor="fallback-ta">Balasan default (jika tak ada command yang cocok)</label>
                <textarea
                  id="fallback-ta"
                  className="fallback-ta"
                  value={fallback}
                  onChange={(e) => setFallback(e.target.value)}
                  rows={2}
                  onBlur={saveFallback}
                  placeholder="Kosong = tidak membalas"
                />
                {savingFallback && <span className="saving-hint">Menyimpan…</span>}
              </div>
            </div>
          )}

          {/* ── Settings tab ── */}
          {tab === 'settings' && (
            <div className="tab-content">
              <div className="settings-rows">
                <div className="settings-row">
                  <span className="settings-key">Bot ID</span>
                  <span className="settings-val">{bot.id}</span>
                </div>
                <div className="settings-row">
                  <span className="settings-key">Bot Token</span>
                  <span className="settings-val mono">
                    {showToken ? bot.token : maskedToken}
                  </span>
                  <button className="eye-btn" onClick={() => setShowToken((s) => !s)}>
                    {showToken ? '🙈' : '👁'}
                  </button>
                </div>
                <div className="settings-row">
                  <span className="settings-key">Pesan diproses</span>
                  <span className="settings-val">{bot.messageCount || 0}</span>
                </div>
              </div>

              <div className="danger-section">
                <p className="danger-title">Danger Zone</p>
                <p className="danger-desc">
                  Menghapus bot akan mencabut webhook secara permanen. Bot berhenti membalas pesan.
                </p>
                <button onClick={removeBot} disabled={busy} className="delete-btn">
                  {busy ? 'Menghapus…' : 'Hapus Bot Ini'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── JS Editor modal ── */}
      {editingId && (
        <div className="overlay" onClick={closeEditor}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">
                <span className="modal-icon">{'</>'}</span>
                <div>
                  <p className="modal-trigger">{commands.find((c) => c.id === editingId)?.trigger}</p>
                  <p className="modal-sub">JavaScript Command</p>
                </div>
              </div>
              <button className="modal-close" onClick={closeEditor}>✕</button>
            </div>

            <div className="modal-body">
              <textarea
                className="code-editor"
                value={draftCode}
                onChange={(e) => { setDraftCode(e.target.value); setDraftSaved(false); }}
                rows={18}
                spellCheck={false}
                placeholder={"async function handle(ctx) {\n  await ctx.sendMessage('Halo!');\n}"}
                autoFocus
              />
              {draftError && <div className="msg-banner error">{draftError}</div>}
              {draftSaved && <div className="msg-banner ok">✓ Kode tersimpan dan aktif.</div>}
            </div>

            <div className="modal-foot">
              <button className="modal-cancel" onClick={closeEditor}>Batal</button>
              <button
                className="modal-save"
                onClick={() => saveCommandCode(editingId)}
                disabled={draftSaving}
              >
                {draftSaving ? 'Menyimpan…' : 'Simpan & Aktifkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* ── Card shell ── */
        .card {
          background: var(--panel);
          border: 1px solid var(--border-solid);
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .card-open {
          border-color: rgba(124, 58, 237, 0.35);
        }

        /* ── Header row ── */
        .card-head {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
        }

        .head-main {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 12px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          padding: 0;
        }

        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--signal-dim);
          color: var(--signal-2);
          font-family: var(--mono);
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          letter-spacing: -0.02em;
        }

        .head-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .head-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .head-username {
          font-size: 11px;
          color: var(--text-faint);
          font-family: var(--mono);
        }

        /* Pills */
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 100px;
          white-space: nowrap;
        }
        .pill-ok {
          background: var(--ok-dim);
          color: var(--ok);
        }
        .pill-off {
          background: var(--panel-raised);
          color: var(--text-faint);
        }
        .pill-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          animation: blink 2s ease-in-out infinite;
        }
        .pill-off .pill-dot { animation: none; opacity: 0.4; }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* Head actions */
        .head-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .cmd-count {
          font-size: 11px;
          color: var(--text-faint);
          font-family: var(--mono);
        }

        .action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid var(--border-solid);
          background: var(--panel-raised);
          color: var(--text-dim);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .action-btn:hover { background: var(--signal-dim); color: var(--signal-2); }

        .expand-btn {
          background: var(--panel-raised);
          border: 1px solid var(--border-solid);
          color: var(--text-dim);
          font-size: 12px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .expand-btn:hover { background: var(--signal-dim); color: var(--signal-2); border-color: var(--signal-dim); }

        /* ── Card body ── */
        .card-body {
          border-top: 1px solid var(--border-solid);
        }

        .tabbar {
          display: flex;
          border-bottom: 1px solid var(--border-solid);
          padding: 0 20px;
        }

        .tab {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-faint);
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          padding: 12px 14px;
          cursor: pointer;
          transition: color 0.15s;
          margin-bottom: -1px;
        }
        .tab:hover { color: var(--text-dim); }
        .tab-active {
          color: var(--signal-2);
          border-bottom-color: var(--signal);
        }

        .tab-content {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ── Info tab ── */
        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: var(--border-solid);
          border: 1px solid var(--border-solid);
          border-radius: 10px;
          overflow: hidden;
        }

        .info-stat {
          background: var(--panel-raised);
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .info-stat-n {
          font-family: var(--mono);
          font-size: 22px;
          font-weight: 700;
          line-height: 1;
        }

        .info-stat-l {
          font-size: 10px;
          color: var(--text-faint);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .info-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background: var(--panel-raised);
          border: 1px solid var(--border-solid);
          border-radius: 10px;
          padding: 14px 16px;
        }

        .toggle-btn {
          font-size: 12px;
          font-weight: 600;
          padding: 7px 16px;
          border-radius: 8px;
          cursor: pointer;
          border: none;
          transition: filter 0.15s;
        }
        .toggle-start { background: var(--ok-dim); color: var(--ok); }
        .toggle-start:hover { filter: brightness(1.2); }
        .toggle-stop { background: var(--danger-dim); color: var(--danger); }
        .toggle-stop:hover { filter: brightness(1.2); }
        .toggle-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Commands tab ── */
        .section-block {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .section-title {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-faint);
          margin: 0;
        }

        .template-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .chip {
          background: var(--panel-raised);
          border: 1px solid var(--border-solid);
          color: var(--text-dim);
          font-size: 11px;
          font-weight: 600;
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .chip:hover { background: var(--signal-dim); color: var(--signal-2); border-color: var(--signal-dim); }

        .cmd-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .search-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 160px;
          background: var(--bg);
          border: 1px solid var(--border-solid);
          border-radius: 8px;
          padding: 0 12px;
        }
        .search-icon { color: var(--text-faint); flex-shrink: 0; }
        .search-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          color: var(--text);
          font-size: 12px;
          padding: 9px 0;
          font-family: var(--sans);
        }
        .search-input::placeholder { color: var(--text-faint); }

        .toolbar-right {
          display: flex;
          gap: 6px;
          align-items: center;
          flex-wrap: wrap;
        }

        .tool-btn {
          font-size: 11px;
          font-weight: 600;
          padding: 7px 10px;
          border-radius: 6px;
          background: var(--panel-raised);
          border: 1px solid var(--border-solid);
          color: var(--text-dim);
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .tool-btn:hover { background: var(--signal-dim); color: var(--signal-2); }
        .tool-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .tool-btn-active { background: var(--signal-dim); color: var(--signal-2); border-color: var(--signal-dim); }
        .tool-btn-danger:hover { background: var(--danger-dim); color: var(--danger); border-color: var(--danger-dim); }

        .add-row {
          display: flex;
          gap: 8px;
        }

        .trigger-input {
          flex: 1;
          background: var(--bg);
          border: 1px solid var(--border-solid);
          color: var(--text);
          padding: 10px 14px;
          border-radius: 8px;
          font-family: var(--mono);
          font-size: 12px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .trigger-input:focus {
          border-color: var(--signal);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
        }
        .trigger-input::placeholder { color: var(--text-faint); }

        .add-btn {
          background: var(--signal-grad);
          border: none;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
          white-space: nowrap;
          transition: filter 0.15s;
        }
        .add-btn:hover:not(:disabled) { filter: brightness(1.1); }
        .add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .bulk-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--panel-raised);
          border: 1px solid var(--border-solid);
          border-radius: 8px;
          padding: 10px 14px;
          flex-wrap: wrap;
        }
        .bulk-info { font-size: 12px; font-weight: 600; color: var(--text-dim); }
        .bulk-link {
          font-size: 11px;
          font-weight: 600;
          color: var(--signal-2);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        }
        .bulk-link:disabled { opacity: 0.4; }
        .bulk-delete {
          margin-left: auto;
          font-size: 11px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 6px;
          background: var(--danger-dim);
          border: 1px solid rgba(239,68,68,0.3);
          color: var(--danger);
          cursor: pointer;
        }
        .bulk-delete:disabled { opacity: 0.4; }

        .msg-banner {
          font-size: 12px;
          font-weight: 500;
          padding: 10px 14px;
          border-radius: 8px;
        }
        .msg-banner.ok { background: var(--ok-dim); color: var(--ok); }
        .msg-banner.error { background: var(--danger-dim); color: var(--danger); }

        .empty-msg {
          font-size: 13px;
          color: var(--text-faint);
          text-align: center;
          padding: 24px 0;
          margin: 0;
        }

        /* ── Command grid ── */
        .cmd-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 8px;
        }

        .cmd-item {
          background: var(--bg);
          border: 1px solid var(--border-solid);
          border-radius: 8px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: border-color 0.15s;
        }
        .cmd-item:hover { border-color: rgba(124, 58, 237, 0.3); }
        .cmd-item.selectable { cursor: pointer; }
        .cmd-item.selected {
          border-color: var(--signal);
          background: var(--signal-dim);
        }

        .cmd-check { margin: 0; accent-color: var(--signal); }

        .cmd-trigger {
          font-family: var(--mono);
          font-size: 12px;
          font-weight: 700;
          color: var(--signal-2);
          background: var(--signal-dim);
          padding: 3px 8px;
          border-radius: 4px;
          display: inline-block;
          word-break: break-all;
        }

        .cmd-btns {
          display: flex;
          gap: 6px;
        }

        .cmd-edit {
          flex: 1;
          font-size: 11px;
          font-weight: 600;
          font-family: var(--mono);
          background: var(--panel-raised);
          border: 1px solid var(--border-solid);
          color: var(--text-dim);
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s, color 0.15s;
        }
        .cmd-edit:hover:not(:disabled) { background: var(--signal-dim); color: var(--signal-2); }
        .cmd-edit:disabled { opacity: 0.4; cursor: not-allowed; }

        .cmd-del {
          width: 30px;
          height: 30px;
          border-radius: 6px;
          background: var(--panel-raised);
          border: 1px solid var(--border-solid);
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }
        .cmd-del:hover:not(:disabled) { background: var(--danger-dim); }
        .cmd-del:disabled { opacity: 0.4; cursor: not-allowed; }

        .fallback-ta {
          width: 100%;
          background: var(--bg);
          border: 1px solid var(--border-solid);
          color: var(--text);
          padding: 10px 14px;
          border-radius: 8px;
          font-family: var(--sans);
          font-size: 13px;
          outline: none;
          resize: vertical;
          transition: border-color 0.15s;
        }
        .fallback-ta:focus { border-color: var(--signal); }
        .fallback-ta::placeholder { color: var(--text-faint); }
        .saving-hint { font-size: 11px; color: var(--text-faint); }

        /* ── Settings tab ── */
        .settings-rows {
          display: flex;
          flex-direction: column;
          border: 1px solid var(--border-solid);
          border-radius: 10px;
          overflow: hidden;
        }

        .settings-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 16px;
          background: var(--panel-raised);
          border-bottom: 1px solid var(--border-solid);
        }
        .settings-row:last-child { border-bottom: none; }

        .settings-key {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-faint);
          min-width: 100px;
          flex-shrink: 0;
        }

        .settings-val {
          flex: 1;
          font-size: 12px;
          color: var(--text);
          word-break: break-all;
        }
        .settings-val.mono { font-family: var(--mono); }

        .eye-btn {
          background: none;
          border: none;
          font-size: 14px;
          cursor: pointer;
          flex-shrink: 0;
          padding: 4px;
        }

        .danger-section {
          background: rgba(239, 68, 68, 0.04);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .danger-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--danger);
          margin: 0;
        }

        .danger-desc {
          font-size: 12px;
          color: var(--text-faint);
          line-height: 1.6;
          margin: 0;
        }

        .delete-btn {
          background: var(--danger-dim);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: var(--danger);
          font-size: 12px;
          font-weight: 600;
          padding: 10px 18px;
          border-radius: 8px;
          cursor: pointer;
          align-self: flex-start;
          transition: filter 0.15s;
        }
        .delete-btn:hover:not(:disabled) { filter: brightness(1.2); }
        .delete-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── JS Editor Modal ── */
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 1000;
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .modal {
          width: 100%;
          max-width: 740px;
          max-height: 88vh;
          display: flex;
          flex-direction: column;
          background: var(--panel);
          border: 1px solid var(--border-solid);
          border-radius: 16px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.5);
          overflow: hidden;
          animation: modalIn 0.15s ease;
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 18px 20px;
          border-bottom: 1px solid var(--border-solid);
          background: var(--panel-raised);
        }

        .modal-title {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .modal-icon {
          font-family: var(--mono);
          font-size: 15px;
          font-weight: 800;
          background: var(--signal-dim);
          color: var(--signal-2);
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          flex-shrink: 0;
        }

        .modal-trigger {
          font-family: var(--mono);
          font-size: 14px;
          font-weight: 700;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .modal-sub {
          font-size: 11px;
          color: var(--text-faint);
          margin: 2px 0 0;
        }

        .modal-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid var(--border-solid);
          background: var(--panel);
          color: var(--text-dim);
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }
        .modal-close:hover { background: var(--danger-dim); color: var(--danger); }

        .modal-body {
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1;
        }

        .code-editor {
          width: 100%;
          font-family: var(--mono);
          font-size: 12.5px;
          line-height: 1.75;
          background: #0d0d12;
          border: 1px solid var(--border-solid);
          border-radius: 10px;
          color: #b8ffb8;
          padding: 16px 18px;
          min-height: 300px;
          white-space: pre;
          outline: none;
          resize: vertical;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .code-editor:focus {
          border-color: var(--signal);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
        }

        .modal-foot {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 20px;
          border-top: 1px solid var(--border-solid);
          background: var(--panel-raised);
        }

        .modal-cancel {
          background: var(--panel);
          border: 1px solid var(--border-solid);
          color: var(--text-dim);
          font-size: 12px;
          font-weight: 600;
          padding: 9px 18px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .modal-cancel:hover { background: var(--bg); }

        .modal-save {
          background: var(--signal-grad);
          border: none;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          padding: 9px 20px;
          border-radius: 8px;
          cursor: pointer;
          box-shadow: 0 4px 12px -4px rgba(124,58,237,0.5);
          transition: filter 0.15s;
        }
        .modal-save:hover:not(:disabled) { filter: brightness(1.1); }
        .modal-save:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
