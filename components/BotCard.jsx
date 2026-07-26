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

  function openManage() {
    const url = `/manage?botId=${bot.id}`;
    window.open(url, '_blank', 'width=1200,height=800');
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
      exportedFrom: 'menara-cloud',
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
              <path d="M13.3 6.3l-.9-.5a5 5 0 000-1.6l.9-.5a1 1 0 00.4-1.4l-1-1.7a1 1 0 00-1.4-.4l-.9.5A5 5 0 008.7 1V0H7.3v1a5 5 0 00-1.7.7l-.9-.5a1 1 0 00-1.4.4L2.3 3.3a1 1 0 00.4 1.4l.9.5a5 5 [...]
            </svg>
          </button>
          <button className="manage-btn" onClick={openManage} title="Buka di tab baru">
            📋 Manage
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
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(124, 58, 237, 0.15);
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }
        .card:hover {
          border-color: rgba(124, 58, 237, 0.3);
          background: rgba(255, 255, 255, 0.05);
        }
        .card-open {
          border-color: rgba(124, 58, 237, 0.4);
          background: rgba(255, 255, 255, 0.06);
        }

        /* ── Header row ── */
        .card-head {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 18px 22px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(124, 58, 237, 0.1);
        }

        .head-main {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 14px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          padding: 0;
        }

        .avatar {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
          color: #fff;
          font-family: 'Courier New', monospace;
          font-size: 14px;
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
          gap: 3px;
          min-width: 0;
        }

        .head-name {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .head-username {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          font-family: 'Courier New', monospace;
        }

        /* Pills */
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          padding: 5px 12px;
          border-radius: 20px;
          white-space: nowrap;
        }
        .pill-ok {
          background: rgba(16, 185, 129, 0.15);
          color: #6ee7b7;
        }
        .pill-off {
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.5);
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
          gap: 10px;
          flex-shrink: 0;
        }

        .cmd-count {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          font-family: 'Courier New', monospace;
          font-weight: 600;
        }

        .action-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid rgba(124, 58, 237, 0.2);
          background: rgba(255, 255, 255, 0.04);
          color: rgba(255, 255, 255, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .action-btn:hover {
          background: rgba(124, 58, 237, 0.15);
          border-color: rgba(124, 58, 237, 0.3);
          color: #a78bfa;
        }

        .manage-btn {
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(236, 72, 153, 0.1) 100%);
          border: 1px solid rgba(124, 58, 237, 0.25);
          color: #a78bfa;
          font-size: 12px;
          font-weight: 700;
          padding: 8px 14px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        .manage-btn:hover {
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.25) 0%, rgba(236, 72, 153, 0.15) 100%);
          border-color: rgba(124, 58, 237, 0.4);
          color: #c4b5fd;
        }

        /* ── Card body ── */
        .card-body {
          border-top: none;
        }

        .tabbar {
          display: flex;
          border-bottom: 1px solid rgba(124, 58, 237, 0.1);
          padding: 0 22px;
          gap: 4px;
        }

        .tab {
          font-size: 13px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.4);
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          padding: 14px 16px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .tab:hover { 
          color: rgba(255, 255, 255, 0.7);
        }
        .tab-active {
          color: #a78bfa;
          border-bottom-color: #7c3aed;
        }

        .tab-content {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ── Info tab ── */
        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(124, 58, 237, 0.15);
          border-radius: 12px;
          overflow: hidden;
        }

        .info-stat {
          background: rgba(255, 255, 255, 0.03);
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .info-stat-n {
          font-family: 'Courier New', monospace;
          font-size: 24px;
          font-weight: 800;
          line-height: 1;
          color: #fff;
        }

        .info-stat-l {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 600;
        }

        .info-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(124, 58, 237, 0.15);
          border-radius: 12px;
          padding: 16px 18px;
        }

        .toggle-btn {
          font-size: 13px;
          font-weight: 700;
          padding: 8px 18px;
          border-radius: 10px;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }
        .toggle-start { 
          background: rgba(16, 185, 129, 0.15);
          color: #6ee7b7;
        }
        .toggle-start:hover { 
          background: rgba(16, 185, 129, 0.25);
        }
        .toggle-stop { 
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
        }
        .toggle-stop:hover { 
          background: rgba(239, 68, 68, 0.25);
        }
        .toggle-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Commands tab ── */
        .section-block {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .section-title {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(255, 255, 255, 0.4);
          margin: 0;
        }

        .template-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .chip {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(124, 58, 237, 0.2);
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          font-weight: 600;
          padding: 7px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .chip:hover {
          background: rgba(124, 58, 237, 0.15);
          color: #a78bfa;
          border-color: rgba(124, 58, 237, 0.3);
        }

        .cmd-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .search-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 160px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(124, 58, 237, 0.15);
          border-radius: 10px;
          padding: 0 12px;
        }
        .search-icon { color: rgba(255, 255, 255, 0.4); flex-shrink: 0; }
        .search-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          color: #fff;
          font-size: 13px;
          padding: 10px 0;
          font-family: 'Inter', sans-serif;
        }
        .search-input::placeholder { color: rgba(255, 255, 255, 0.3); }

        .toolbar-right {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .tool-btn {
          font-size: 12px;
          font-weight: 700;
          padding: 8px 12px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(124, 58, 237, 0.2);
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        .tool-btn:hover:not(:disabled) {
          background: rgba(124, 58, 237, 0.15);
          color: #a78bfa;
          border-color: rgba(124, 58, 237, 0.3);
        }
        .tool-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .tool-btn-active {
          background: rgba(124, 58, 237, 0.15);
          color: #a78bfa;
          border-color: rgba(124, 58, 237, 0.3);
        }
        .tool-btn-danger:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
          border-color: rgba(239, 68, 68, 0.3);
        }

        .add-row {
          display: flex;
          gap: 10px;
        }

        .trigger-input {
          flex: 1;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(124, 58, 237, 0.15);
          color: #fff;
          padding: 11px 14px;
          border-radius: 10px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          outline: none;
          transition: all 0.2s ease;
        }
        .trigger-input:focus {
          border-color: rgba(124, 58, 237, 0.4);
          background: rgba(124, 58, 237, 0.08);
        }
        .trigger-input::placeholder { color: rgba(255, 255, 255, 0.3); }

        .add-btn {
          background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
          border: none;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          padding: 11px 18px;
          border-radius: 10px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
          box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);
        }
        .add-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(124, 58, 237, 0.4);
        }
        .add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .bulk-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(124, 58, 237, 0.15);
          border-radius: 10px;
          padding: 12px 14px;
          flex-wrap: wrap;
        }
        .bulk-info { font-size: 13px; font-weight: 700; color: rgba(255, 255, 255, 0.7); }
        .bulk-link {
          font-size: 12px;
          font-weight: 700;
          color: #a78bfa;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        }
        .bulk-link:disabled { opacity: 0.4; }
        .bulk-delete {
          margin-left: auto;
          font-size: 12px;
          font-weight: 700;
          padding: 7px 12px;
          border-radius: 8px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          cursor: pointer;
        }
        .bulk-delete:disabled { opacity: 0.4; }

        .msg-banner {
          font-size: 13px;
          font-weight: 600;
          padding: 12px 14px;
          border-radius: 10px;
        }
        .msg-banner.ok {
          background: rgba(16, 185, 129, 0.15);
          color: #6ee7b7;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .msg-banner.error {
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .empty-msg {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.4);
          text-align: center;
          padding: 32px 0;
          margin: 0;
        }

        /* ── Command grid ── */
        .cmd-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 10px;
        }

        .cmd-item {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(124, 58, 237, 0.15);
          border-radius: 10px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: all 0.2s ease;
        }
        .cmd-item:hover { 
          border-color: rgba(124, 58, 237, 0.3);
          background: rgba(124, 58, 237, 0.08);
        }
        .cmd-item.selectable { cursor: pointer; }
        .cmd-item.selected {
          border-color: rgba(124, 58, 237, 0.4);
          background: rgba(124, 58, 237, 0.15);
        }

        .cmd-check { margin: 0; accent-color: #7c3aed; }

        .cmd-trigger {
          font-family: 'Courier New', monospace;
          font-size: 13px;
          font-weight: 700;
          color: #a78bfa;
          background: rgba(124, 58, 237, 0.15);
          padding: 4px 8px;
          border-radius: 6px;
          display: inline-block;
          word-break: break-all;
        }

        .cmd-btns {
          display: flex;
          gap: 8px;
        }

        .cmd-edit {
          flex: 1;
          font-size: 12px;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(124, 58, 237, 0.2);
          color: rgba(255, 255, 255, 0.7);
          padding: 7px 10px;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
        }
        .cmd-edit:hover:not(:disabled) {
          background: rgba(124, 58, 237, 0.15);
          color: #a78bfa;
          border-color: rgba(124, 58, 237, 0.3);
        }
        .cmd-edit:disabled { opacity: 0.4; cursor: not-allowed; }

        .cmd-del {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(239, 68, 68, 0.2);
          cursor: pointer;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .cmd-del:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.3);
        }
        .cmd-del:disabled { opacity: 0.4; cursor: not-allowed; }

        .fallback-ta {
          width: 100%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(124, 58, 237, 0.15);
          color: #fff;
          padding: 11px 14px;
          border-radius: 10px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          outline: none;
          resize: vertical;
          transition: all 0.2s ease;
        }
        .fallback-ta:focus {
          border-color: rgba(124, 58, 237, 0.4);
          background: rgba(124, 58, 237, 0.08);
        }
        .fallback-ta::placeholder { color: rgba(255, 255, 255, 0.3); }
        .saving-hint { font-size: 12px; color: rgba(255, 255, 255, 0.3); }

        /* ── Settings tab ── */
        .settings-rows {
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(124, 58, 237, 0.15);
          border-radius: 12px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.02);
        }

        .settings-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 18px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(124, 58, 237, 0.1);
        }
        .settings-row:last-child { border-bottom: none; }

        .settings-key {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.4);
          min-width: 110px;
          flex-shrink: 0;
        }

        .settings-val {
          flex: 1;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          word-break: break-all;
        }
        .settings-val.mono { font-family: 'Courier New', monospace; }

        .eye-btn {
          background: none;
          border: none;
          font-size: 15px;
          cursor: pointer;
          flex-shrink: 0;
          padding: 4px;
          transition: opacity 0.2s;
        }
        .eye-btn:hover { opacity: 0.7; }

        .danger-section {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 12px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .danger-title {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #fca5a5;
          margin: 0;
        }

        .danger-desc {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.6;
          margin: 0;
        }

        .delete-btn {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          font-size: 13px;
          font-weight: 700;
          padding: 11px 20px;
          border-radius: 10px;
          cursor: pointer;
          align-self: flex-start;
          transition: all 0.2s ease;
        }
        .delete-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.25);
          border-color: rgba(239, 68, 68, 0.4);
        }
        .delete-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── JS Editor Modal ── */
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .modal {
          width: 100%;
          max-width: 760px;
          max-height: 88vh;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1e 100%);
          border: 1px solid rgba(124, 58, 237, 0.25);
          border-radius: 16px;
          box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6);
          overflow: hidden;
          animation: modalIn 0.2s ease;
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
          padding: 20px 22px;
          border-bottom: 1px solid rgba(124, 58, 237, 0.15);
          background: rgba(255, 255, 255, 0.02);
        }

        .modal-title {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

        .modal-icon {
          font-family: 'Courier New', monospace;
          font-size: 16px;
          font-weight: 800;
          background: rgba(124, 58, 237, 0.15);
          color: #a78bfa;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          flex-shrink: 0;
        }

        .modal-trigger {
          font-family: 'Courier New', monospace;
          font-size: 15px;
          font-weight: 800;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #fff;
        }

        .modal-sub {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          margin: 3px 0 0;
        }

        .modal-close {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid rgba(239, 68, 68, 0.2);
          background: rgba(255, 255, 255, 0.02);
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .modal-close:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .modal-body {
          padding: 22px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 14px;
          flex: 1;
        }

        .code-editor {
          width: 100%;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.8;
          background: #0d0d12;
          border: 1px solid rgba(124, 58, 237, 0.2);
          border-radius: 10px;
          color: #10b981;
          padding: 16px 18px;
          min-height: 320px;
          white-space: pre;
          outline: none;
          resize: vertical;
          transition: all 0.2s ease;
        }
        .code-editor:focus {
          border-color: rgba(124, 58, 237, 0.4);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }

        .modal-foot {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 18px 22px;
          border-top: 1px solid rgba(124, 58, 237, 0.1);
          background: rgba(255, 255, 255, 0.02);
        }

        .modal-cancel {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(124, 58, 237, 0.2);
          color: rgba(255, 255, 255, 0.7);
          font-size: 13px;
          font-weight: 700;
          padding: 9px 18px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .modal-cancel:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(124, 58, 237, 0.3);
        }

        .modal-save {
          background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
          border: none;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          padding: 9px 20px;
          border-radius: 10px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);
          transition: all 0.2s ease;
        }
        .modal-save:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(124, 58, 237, 0.4);
        }
        .modal-save:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
