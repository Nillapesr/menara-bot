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
//
// Semua teks/caption otomatis dirender pakai format HTML Telegram, jadi tag
// seperti <b>tebal</b>, <i>miring</i>, <u>garis bawah</u>, <s>coret</s>,
// <code>kode</code>, <pre>blok kode</pre>, <a href="https://...">link</a>,
// <blockquote>kutipan</blockquote>, dan <tg-spoiler>spoiler</tg-spoiler>
// langsung tampil terformat tanpa perlu setting apa pun.

async function handle(ctx) {
  await ctx.sendMessage(
    '<b>Halo!</b> Bot ini pakai kode custom.\\n<blockquote>Bisa pakai tag HTML kayak gini.</blockquote>',
    { buttons: [[{ text: 'Lihat gambar', callback_data: 'lihat_gambar' }]] }
  );
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

const TEMPLATE_WELCOME = `// Trigger command ini WAJIB diisi "@join" (bukan teks biasa).
// Otomatis jalan tiap kali ada anggota baru masuk grup.
// Syarat: bot harus jadi admin grup di Telegram (Add Admin), minimal
// dengan izin "Invite Users" supaya bisa baca event anggota masuk.

async function handle(ctx) {
  const names = (ctx.newChatMembers || [])
    .map((u) => u.first_name || u.username || 'teman baru')
    .join(', ');

  await ctx.sendMessage(
    \`👋 Selamat datang, \${names}! Baca dulu aturan grup ya sebelum chat.\`
  );
}`;

const TEMPLATE_MODERATION = `// Contoh command moderasi grup: /mute, /kick, /ban, /pin (balas pesan target lalu ketik command).
// Trigger command ini contohnya diisi "/mute".
// PENTING:
// - Bot harus jadi admin grup di Telegram dengan izin "Restrict/Ban/Pin Members".
// - Kode ini SELALU cek dulu apakah yang memanggil command adalah admin grup,
//   supaya member biasa tidak bisa nge-mute/ban orang lain.
// - Command harus dipakai dengan cara reply ke pesan orang yang mau dimoderasi.

async function handle(ctx) {
  // Cegah pemakaian di luar grup
  if (ctx.chatType !== 'group' && ctx.chatType !== 'supergroup') {
    await ctx.sendMessage('Command ini cuma bisa dipakai di dalam grup.');
    return;
  }

  // Hanya admin grup yang boleh pakai command ini
  const callerIsAdmin = await ctx.isGroupAdmin(ctx.from?.id);
  if (!callerIsAdmin) {
    await ctx.sendMessage('Cuma admin grup yang boleh pakai command ini.');
    return;
  }

  // User target harus didapat dari pesan yang di-reply
  const target = ctx.message?.reply_to_message?.from;
  if (!target) {
    await ctx.sendMessage('Reply pesan orang yang mau dimoderasi, baru ketik command ini.');
    return;
  }

  // --- Pilih salah satu aksi sesuai kebutuhan, hapus yang lain ---

  // Mute 1 jam:
  await ctx.muteUser(target.id, 60 * 60);
  await ctx.sendMessage(\`🔇 \${target.first_name} dimute selama 1 jam.\`);

  // Unmute:
  // await ctx.unmuteUser(target.id);

  // Kick (boleh join lagi nanti):
  // await ctx.kickUser(target.id);

  // Ban permanen:
  // await ctx.banUser(target.id);

  // Unban:
  // await ctx.unbanUser(target.id);

  // Pin pesan yang di-reply:
  // await ctx.pinMessage(target.message_id);
}`;

const TEMPLATE_EDIT_DELETE = `// Contoh command dengan tombol yang mengedit / menghapus pesannya sendiri.
// Trigger command ini contohnya diisi "/menu" (untuk munculkan pesan+tombol awal),
// lalu buat 2 command LAIN dengan trigger PERSIS SAMA dengan callback_data
// tombolnya, misalnya "edit_ya" dan "hapus_ya" (tanpa '/' di depan).

async function handle(ctx) {
  if (ctx.callbackData === 'edit_ya') {
    // Tombol "Edit" diklik -> ubah teks & tombol pesan yang sama (bukan kirim pesan baru)
    await ctx.editMessageText('<b>Pesan sudah diedit ✅</b>\\nIsi barunya kayak gini.', {
      buttons: [[{ text: 'Hapus pesan ini', callback_data: 'hapus_ya' }]],
    });
    await ctx.answerCallback('Berhasil diedit!');
    return;
  }

  if (ctx.callbackData === 'hapus_ya') {
    // Tombol "Hapus" diklik -> hapus pesannya
    await ctx.deleteMessage();
    await ctx.answerCallback('Pesan dihapus.');
    return;
  }

  // Belum ada callback -> ini pemanggilan awal command (mis. ketik "/menu")
  await ctx.sendMessage('Pilih aksi untuk pesan ini:', {
    buttons: [
      [{ text: '✏️ Edit pesan', callback_data: 'edit_ya' }],
      [{ text: '🗑️ Hapus pesan', callback_data: 'hapus_ya' }],
    ],
  });
}`;

const TABS = [
  { id: 'intro', label: 'Intro', icon: '▦' },
  { id: 'commands', label: 'Commands', icon: '</>' },
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

  // ---- Import/export JSON state ----
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null); // { type: 'ok' | 'error', text }

  // ---- Settings state (rules mode masih tersedia sebagai fallback) ----
  const [fallback, setFallback] = useState(bot.fallbackMessage || '');
  const [savingFallback, setSavingFallback] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const isActive = bot.status === 'active';
  const maskedToken = bot.token ? bot.token.replace(/./g, '•').slice(0, 34) : '';

  useEffect(() => {
    if (!editingId) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') closeEditor();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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

  function loadTemplate(tpl, defaultTrigger = '/start') {
    const trigger = newTrigger.trim() || defaultTrigger;
    setNewTrigger(trigger);
    addCommand(tpl, trigger);
  }

  // ---- Export: unduh semua command bot ini sebagai file .json ----
  function exportCommands() {
    const payload = {
      exportedFrom: 'menara-bot',
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

  // ---- Import: pilih file .json, kirim ke server buat divalidasi & disimpan ----
  function pickImportFile() {
    setImportMsg(null);
    fileInputRef.current?.click();
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset supaya bisa pilih file sama lagi nanti
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setImportMsg({ type: 'error', text: 'File harus berformat .json.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setImportMsg({ type: 'error', text: 'File terlalu besar (maksimal 2MB).' });
      return;
    }

    setImporting(true);
    setImportMsg(null);
    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        setImportMsg({ type: 'error', text: 'File bukan JSON yang valid.' });
        return;
      }

      const items = Array.isArray(parsed) ? parsed : parsed.items;
      if (!Array.isArray(items)) {
        setImportMsg({
          type: 'error',
          text: 'Format tidak dikenali. File harus berisi array command atau { "items": [...] }.',
        });
        return;
      }

      const res = await fetch(`/api/bots/${bot.id}/commands/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();

      if (!res.ok) {
        setImportMsg({ type: 'error', text: data.error || 'Gagal mengimpor command.' });
        return;
      }

      setCommands(data.commands);
      onChange?.();

      const skipped = data.rejected?.length || 0;
      setImportMsg({
        type: 'ok',
        text: skipped
          ? `${data.importedCount} command diimpor, ${skipped} dilewati (lihat konsol untuk detail).`
          : `${data.importedCount} command berhasil diimpor.`,
      });
      if (skipped) console.warn('Command dilewati saat import:', data.rejected);
    } catch (err) {
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
    <div className="row">
      <div className="row-head">
        <button className="row-head-main" onClick={() => setOpen((o) => !o)}>
          <span className="avatar">{initials(bot.firstName || bot.username)}</span>
          <span className="row-info">
            <span className="row-name">{bot.firstName || bot.username}</span>
            <span className="row-username">@{bot.username}</span>
          </span>
          <span className={`status-pill ${isActive ? 'ok' : 'off'}`}>
            {isActive ? 'Working' : 'Stopped'}
          </span>
        </button>
        <button
          className={`gear-btn ${tab === 'settings' && open ? 'active' : ''}`}
          onClick={() => {
            setTab('settings');
            setOpen(true);
          }}
          aria-label="Pengaturan bot"
        >
          ⚙
        </button>
        <button className="manage-btn" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : 'Manage'}
        </button>
      </div>

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
            <button
              className={`tab tab-settings ${tab === 'settings' ? 'active' : ''}`}
              onClick={() => setTab('settings')}
              aria-label="Settings"
            >
              <span className="tab-icon">⚙</span>
            </button>
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
                <button className="btn-add" onClick={() => loadTemplate(TEMPLATE_BASIC, '/start')}>
                  Dasar (teks + tombol)
                </button>
                <button className="btn-add" onClick={() => loadTemplate(TEMPLATE_AI, '/ai')}>
                  Terhubung AI
                </button>
                <button className="btn-add" onClick={() => loadTemplate(TEMPLATE_WELCOME, '@join')}>
                  Welcome Grup
                </button>
                <button className="btn-add" onClick={() => loadTemplate(TEMPLATE_MODERATION, '/mute')}>
                  Moderasi (mute/kick/ban/pin)
                </button>
                <button className="btn-add" onClick={() => loadTemplate(TEMPLATE_EDIT_DELETE, '/menu')}>
                  Edit/Hapus Pesan via Tombol
                </button>
              </div>
              <p className="template-hint" style={{ opacity: 0.7, fontSize: '0.85em', margin: '4px 0 12px' }}>
                💡 Template "Edit/Hapus Pesan via Tombol" butuh 3 command: satu untuk trigger
                utama (mis. <code>/menu</code>), dan dua lagi dengan trigger persis sama dengan
                callback_data tombolnya (<code>edit_ya</code> dan <code>hapus_ya</code>) —
                semuanya bisa pakai kode yang sama, karena kode itu mengecek{' '}
                <code>ctx.callbackData</code> untuk tahu tombol mana yang diklik.
              </p>

              <div className="io-row">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportFile}
                  style={{ display: 'none' }}
                />
                <button className="io-btn" onClick={pickImportFile} disabled={importing}>
                  <span className="io-icon">⇧</span> {importing ? 'Mengimpor…' : 'Import JSON'}
                </button>
                <button className="io-btn" onClick={exportCommands} disabled={commands.length === 0}>
                  <span className="io-icon">⇩</span> Export JSON
                </button>
                <span className="io-count">{commands.length} command</span>
              </div>

              {importMsg && (
                <p className={importMsg.type === 'error' ? 'code-error' : 'code-ok'}>
                  {importMsg.text}
                </p>
              )}

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
                        onClick={() => openEditor(cmd)}
                      >
                        <span className="btn-edit-code-icon">{'</>'}</span> Edit JS
                      </button>
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={() => removeCommand(cmd.id)}
                        aria-label="Hapus command"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {editingId && (
                <div className="editor-overlay" onClick={closeEditor}>
                  <div className="editor-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="editor-modal-head">
                      <div className="editor-modal-title">
                        <span className="editor-modal-icon">{'</>'}</span>
                        <div>
                          <p className="editor-modal-trigger">
                            {commands.find((c) => c.id === editingId)?.trigger}
                          </p>
                          <p className="editor-modal-sub">Kode JavaScript command</p>
                        </div>
                      </div>
                      <button className="editor-close" onClick={closeEditor} aria-label="Tutup editor">✕</button>
                    </div>

                    <div className="editor-modal-body">
                      <textarea
                        className="code-editor"
                        value={draftCode}
                        onChange={(e) => {
                          setDraftCode(e.target.value);
                          setDraftSaved(false);
                        }}
                        rows={16}
                        spellCheck={false}
                        placeholder="async function handle(ctx) {&#10;  await ctx.sendMessage('Halo!');&#10;}"
                        autoFocus
                      />

                      <p className="code-hint">
                        Wajib mendefinisikan <code>async function handle(ctx)</code>. Tersedia:{' '}
                        <code>ctx.text</code>, <code>ctx.callbackData</code>, <code>ctx.sendMessage()</code>,{' '}
                        <code>ctx.sendPhoto()</code>, <code>ctx.editMessageText()</code>,{' '}
                        <code>ctx.editMessageCaption()</code>, <code>ctx.editMessageReplyMarkup()</code>,{' '}
                        <code>ctx.deleteMessage()</code>, <code>ctx.answerCallback()</code>,{' '}
                        <code>ctx.callAI()</code>, <code>ctx.fetchJSON()</code>. Untuk grup:{' '}
                        <code>ctx.chatType</code>, <code>ctx.newChatMembers</code>,{' '}
                        <code>ctx.isGroupAdmin()</code>, <code>ctx.muteUser()</code>,{' '}
                        <code>ctx.unmuteUser()</code>, <code>ctx.kickUser()</code>,{' '}
                        <code>ctx.banUser()</code>, <code>ctx.unbanUser()</code>,{' '}
                        <code>ctx.pinMessage()</code>, <code>ctx.unpinMessage()</code>. Trigger event khusus:{' '}
                        <code>@join</code> (anggota baru), <code>@leave</code> (anggota keluar). Semua teks/caption
                        otomatis diformat pakai <code>HTML</code> Telegram (<code>&lt;b&gt;</code>,{' '}
                        <code>&lt;i&gt;</code>, <code>&lt;u&gt;</code>, <code>&lt;s&gt;</code>,{' '}
                        <code>&lt;code&gt;</code>, <code>&lt;pre&gt;</code>, <code>&lt;a href&gt;</code>,{' '}
                        <code>&lt;blockquote&gt;</code>, <code>&lt;tg-spoiler&gt;</code>) — override dengan{' '}
                        <code>{'{ parseMode: null }'}</code> kalau mau teks polos.
                      </p>

                      {draftError && <p className="code-error">{draftError}</p>}
                      {draftSaved && <p className="code-ok">Kode tersimpan dan aktif.</p>}
                    </div>

                    <div className="editor-modal-foot">
                      <button className="btn-cancel" onClick={closeEditor}>Batal</button>
                      <button
                        onClick={() => saveCommandCode(editingId)}
                        disabled={draftSaving}
                        className="btn-save"
                      >
                        {draftSaving ? 'Menyimpan…' : 'Simpan & Aktifkan'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
          background: var(--bru-white);
          border: var(--bru-border);
          box-shadow: var(--bru-shadow-sm);
          margin-bottom: 4px;
        }

        .row-head {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 18px;
        }

        .row-head-main {
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
          width: 42px;
          height: 42px;
          border-radius: 0;
          background: var(--bru-yellow);
          color: var(--bru-ink);
          border: var(--bru-border);
          font-family: var(--display);
          font-weight: 800;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .avatar-lg {
          width: 54px;
          height: 54px;
          font-size: 18px;
        }

        .row-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .row-name {
          font-family: var(--display);
          font-weight: 800;
          font-size: 14px;
          color: var(--bru-ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .row-username {
          font-size: 12px;
          color: #555;
          font-family: var(--mono);
          font-weight: 600;
        }

        .status-pill {
          font-size: 10px;
          font-family: var(--mono);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 5px 10px;
          border: 2px solid var(--bru-ink);
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
          background: var(--bru-green);
          color: var(--bru-ink);
        }

        .status-pill.off {
          background: var(--bru-bg);
          color: #666;
        }

        .manage-btn {
          background: var(--bru-ink);
          color: var(--bru-bg);
          font-size: 12px;
          font-weight: 800;
          padding: 8px 16px;
          border: var(--bru-border);
          flex-shrink: 0;
          cursor: pointer;
        }

        .gear-btn {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border: var(--bru-border);
          background: var(--bru-white);
          color: var(--bru-ink);
          font-size: 16px;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .gear-btn:hover {
          background: var(--bru-yellow);
          transform: rotate(35deg);
        }

        .gear-btn.active {
          background: var(--bru-yellow);
          box-shadow: var(--bru-shadow-sm);
        }

        .tab-settings {
          margin-left: auto;
          flex: 0 0 auto;
          padding: 10px 14px;
        }

        .panel {
          border-top: var(--bru-border);
          padding: 18px;
        }

        .tabbar {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          background: var(--bru-bg);
          padding: 6px;
          border: var(--bru-border);
          margin-bottom: 18px;
        }

        .tab {
          flex-shrink: 0;
          background: transparent;
          border: none;
          color: #555;
          padding: 9px 16px;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .tab-icon {
          font-family: var(--mono);
          margin-right: 3px;
        }

        .tab.active {
          color: var(--bru-ink);
          background: var(--bru-yellow);
          box-shadow: var(--bru-shadow-sm);
        }

        .tab-body {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .intro-card {
          background: var(--bru-bg);
          border: var(--bru-border);
          padding: 20px;
        }

        .intro-top {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 12px;
        }

        .intro-name {
          font-family: var(--display);
          font-weight: 800;
          font-size: 17px;
          margin: 0 0 8px;
        }

        .intro-username {
          color: #555;
          font-family: var(--mono);
          font-weight: 700;
          font-size: 13px;
          margin: 0;
        }

        .intro-id {
          color: #888;
          font-family: var(--mono);
          font-size: 12px;
          margin: 2px 0 16px;
        }

        .stop-btn {
          width: 100%;
          border: var(--bru-border);
          padding: 13px;
          font-weight: 800;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: var(--bru-shadow-sm);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }

        .stop-btn.danger {
          background: var(--bru-pink);
          color: var(--bru-white);
        }

        .stop-btn.ok {
          background: var(--bru-green);
          color: var(--bru-ink);
        }

        .stop-btn:hover:not(:disabled) {
          transform: translate(-2px, -2px);
          box-shadow: 6px 6px 0 var(--bru-ink);
        }

        .stop-btn:active:not(:disabled) {
          transform: translate(0, 0);
          box-shadow: 2px 2px 0 var(--bru-ink);
        }

        .stop-dot {
          width: 8px;
          height: 8px;
          background: currentColor;
        }

        .section-label {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--bru-ink);
          margin: 6px 0 0;
        }

        .stat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .stat-card {
          background: var(--bru-bg);
          border: var(--bru-border);
          padding: 14px;
        }

        .stat-card.wide {
          grid-column: 1 / -1;
        }

        .stat-icon {
          font-size: 15px;
        }

        .stat-label {
          font-size: 11px;
          font-weight: 700;
          color: #666;
          margin: 8px 0 2px;
        }

        .stat-value {
          font-family: var(--display);
          font-size: 22px;
          font-weight: 800;
          margin: 0;
        }

        .status-block {
          background: var(--bru-bg);
          border: var(--bru-border);
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .status-text {
          font-size: 12px;
          font-weight: 600;
          color: #444;
        }

        .template-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          font-size: 11px;
        }

        .template-label {
          color: #666;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .btn-add {
          background: var(--bru-white);
          border: 2px solid var(--bru-ink);
          color: var(--bru-ink);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          padding: 6px 10px;
          transition: background 0.12s ease;
        }

        .btn-add:hover {
          background: var(--bru-yellow);
        }

        .io-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .io-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--bru-white);
          border: 2px solid var(--bru-ink);
          color: var(--bru-ink);
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
        }

        .io-btn:hover:not(:disabled) {
          background: var(--bru-blue);
          color: var(--bru-white);
        }

        .io-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }

        .io-icon {
          font-size: 13px;
        }

        .io-count {
          margin-left: auto;
          font-size: 11px;
          font-weight: 700;
          color: #777;
        }

        .cmd-toolbar {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bru-bg);
          border: var(--bru-border);
          padding: 0 12px;
        }

        .search-icon {
          color: #777;
          font-size: 13px;
        }

        .search-box input {
          border: none;
          background: none;
          padding: 10px 0;
          box-shadow: none !important;
        }

        .add-command-row {
          display: flex;
          gap: 8px;
        }

        .trigger-input {
          flex: 1;
        }

        .new-cmd-btn {
          background: var(--bru-ink);
          color: var(--bru-bg);
          border: var(--bru-border);
          padding: 0 20px;
          font-weight: 800;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
          box-shadow: var(--bru-shadow-sm);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }

        .new-cmd-btn:disabled {
          opacity: 0.5;
          cursor: default;
          box-shadow: none;
        }

        .new-cmd-btn:not(:disabled):hover {
          transform: translate(-2px, -2px);
          box-shadow: 5px 5px 0 var(--bru-ink);
        }

        .empty-rules {
          font-size: 12px;
          font-weight: 600;
          color: #777;
          margin: 4px 0;
        }

        .command-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 12px;
        }

        .command-item {
          position: relative;
          background: var(--bru-white);
          border: var(--bru-border);
          box-shadow: var(--bru-shadow-sm);
          padding: 14px;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }

        .command-item:hover {
          transform: translate(-2px, -2px);
          box-shadow: 6px 6px 0 var(--bru-ink);
        }

        .command-trigger {
          display: inline-block;
          font-family: var(--mono);
          font-weight: 800;
          font-size: 12px;
          color: var(--bru-ink);
          background: var(--bru-yellow);
          border: 2px solid var(--bru-ink);
          padding: 4px 10px;
          margin-bottom: 12px;
        }

        .command-row {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .btn-edit-code {
          flex: 1;
          background: var(--bru-ink);
          border: 2px solid var(--bru-ink);
          color: var(--bru-bg);
          padding: 9px 12px;
          font-size: 12px;
          font-weight: 800;
          font-family: var(--mono);
          cursor: pointer;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.12s ease, color 0.12s ease;
        }

        .btn-edit-code-icon {
          color: var(--bru-green);
        }

        .btn-edit-code:hover {
          background: var(--bru-blue);
          border-color: var(--bru-ink);
        }

        .btn-icon {
          background: var(--bru-white);
          border: 2px solid var(--bru-ink);
          color: var(--bru-ink);
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .btn-icon-danger:hover {
          background: var(--bru-pink);
          color: var(--bru-white);
        }

        /* --- Editor JS: modal overlay, bukan lagi inline --- */
        .editor-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 10, 10, 0.6);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 1000;
        }

        .editor-modal {
          width: 100%;
          max-width: 720px;
          max-height: 88vh;
          display: flex;
          flex-direction: column;
          background: var(--bru-white);
          border: var(--bru-border);
          box-shadow: 12px 12px 0 var(--bru-ink);
        }

        .editor-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 18px;
          border-bottom: var(--bru-border);
          background: var(--bru-yellow);
        }

        .editor-modal-title {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .editor-modal-icon {
          font-family: var(--mono);
          font-weight: 800;
          font-size: 20px;
          background: var(--bru-ink);
          color: var(--bru-yellow);
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 2px solid var(--bru-ink);
        }

        .editor-modal-trigger {
          font-family: var(--mono);
          font-weight: 800;
          font-size: 15px;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .editor-modal-sub {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 2px 0 0;
          color: #444;
        }

        .editor-close {
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          border: 2px solid var(--bru-ink);
          background: var(--bru-white);
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease;
        }

        .editor-close:hover {
          background: var(--bru-pink);
          color: var(--bru-white);
        }

        .editor-modal-body {
          padding: 18px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .editor-modal-foot {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 14px 18px;
          border-top: var(--bru-border);
          background: var(--bru-bg);
        }

        .btn-cancel {
          background: var(--bru-white);
          border: 2px solid var(--bru-ink);
          color: var(--bru-ink);
          padding: 10px 18px;
          font-weight: 800;
          font-size: 12px;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .btn-cancel:hover {
          background: var(--bru-bg);
        }

        .code-editor {
          width: 100%;
          font-family: var(--mono);
          font-size: 12.5px;
          line-height: 1.7;
          background: var(--bru-ink);
          border: var(--bru-border);
          color: #d8ffd8;
          padding: 14px 16px;
          min-height: 280px;
          white-space: pre;
          outline: none;
          resize: vertical;
        }

        .code-editor:focus {
          box-shadow: 4px 4px 0 var(--bru-blue);
        }

        .code-hint {
          font-size: 11px;
          color: #555;
          line-height: 1.7;
          margin: 0;
          background: var(--bru-bg);
          border: 2px solid var(--bru-ink);
          padding: 10px 12px;
        }

        .code-hint code {
          background: var(--bru-yellow);
          border: 1px solid var(--bru-ink);
          padding: 1px 5px;
          font-weight: 700;
          color: var(--bru-ink);
        }

        .code-error {
          background: var(--bru-pink);
          color: var(--bru-white);
          border: var(--bru-border);
          font-size: 12px;
          font-weight: 700;
          padding: 10px 12px;
          margin: 0;
        }

        .code-ok {
          background: var(--bru-green);
          color: var(--bru-ink);
          border: var(--bru-border);
          font-size: 12px;
          font-weight: 700;
          padding: 10px 12px;
          margin: 0;
        }

        .btn-save {
          background: var(--bru-ink);
          color: var(--bru-bg);
          border: var(--bru-border);
          padding: 11px 22px;
          font-weight: 800;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          cursor: pointer;
          box-shadow: var(--bru-shadow-sm);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }

        .btn-save:hover:not(:disabled) {
          transform: translate(-2px, -2px);
          box-shadow: 6px 6px 0 var(--bru-ink);
          background: var(--bru-green);
          color: var(--bru-ink);
        }

        .btn-save:disabled {
          opacity: 0.5;
          cursor: default;
          box-shadow: none;
        }

        .editor-field label {
          display: block;
          font-size: 11px;
          font-weight: 800;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 6px;
        }

        .editor-field textarea {
          width: 100%;
          background: var(--bru-bg);
          border: var(--bru-border);
          color: var(--bru-ink);
          padding: 10px 12px;
          font-size: 13px;
          font-family: var(--sans);
          outline: none;
          resize: vertical;
        }

        .editor-field textarea:focus {
          box-shadow: 4px 4px 0 var(--bru-blue);
        }

        .saving-hint {
          font-size: 11px;
          font-weight: 700;
          color: #777;
        }

        .settings-card {
          background: var(--bru-bg);
          border: var(--bru-border);
          padding: 16px 18px;
        }

        .settings-label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #555;
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
          font-weight: 600;
          color: var(--bru-ink);
          word-break: break-all;
        }

        .settings-value.mono {
          font-family: var(--mono);
          font-size: 12px;
        }

        .eye-btn {
          background: var(--bru-white);
          border: 2px solid var(--bru-ink);
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          cursor: pointer;
        }

        .danger-zone {
          border-color: var(--bru-ink);
          background: #fff0f0;
        }

        .danger-label {
          color: #b3003b;
        }

        .danger-desc {
          font-size: 12px;
          font-weight: 600;
          color: #444;
          line-height: 1.7;
          margin: 0 0 12px;
        }

        .delete-btn {
          background: var(--bru-pink);
          color: var(--bru-white);
          border: var(--bru-border);
          padding: 12px 18px;
          font-weight: 800;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          cursor: pointer;
          width: 100%;
          box-shadow: var(--bru-shadow-sm);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }

        .delete-btn:hover:not(:disabled) {
          transform: translate(-2px, -2px);
          box-shadow: 6px 6px 0 var(--bru-ink);
        }

        .delete-btn:disabled {
          opacity: 0.5;
          box-shadow: none;
        }
      `}</style>
    </div>
  );
}
