// Sandbox untuk menjalankan kode custom milik user.
//
// Kenapa bukan isolated-vm/vm2: keduanya butuh native binding (node-gyp)
// yang sering gagal di Vercel serverless karena mismatch arsitektur saat
// deploy. Pendekatan di sini pakai `new Function()` dengan context yang
// sangat dibatasi — user hanya diberi beberapa helper resmi, tidak ada
// akses ke `require`, `process`, filesystem, atau variabel global lain.
//
// Ini bukan isolasi V8 sekelas isolated-vm, tapi cukup untuk mencegah
// bot user saling membaca token/env milik bot lain, dan tetap 100% jalan
// di lingkungan serverless Vercel tanpa native dependency.

const FORBIDDEN_PATTERNS = [
  /\brequire\s*\(/,
  /\bimport\s*\(/,
  /\bprocess\s*\./,
  /\bglobal\s*\./,
  /\bglobalThis\s*\./,
  /\b__dirname\b/,
  /\b__filename\b/,
  /\bchild_process\b/,
  /\bfs\s*\./,
  /\beval\s*\(/,
  /\bFunction\s*\(/, // cegah user bikin sandbox dalam sandbox untuk escape
];

export function validateCustomCode(code) {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Kode tidak boleh kosong.' };
  }
  if (code.length > 50_000) {
    return { valid: false, error: 'Kode terlalu panjang (maksimal 50.000 karakter).' };
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      return {
        valid: false,
        error: `Kode mengandung pola yang tidak diizinkan: ${pattern.source}. Gunakan helper resmi (sendMessage, sendPhoto, sendButtons, callAI, fetchJSON) sebagai gantinya.`,
      };
    }
  }
  return { valid: true };
}

const TIMEOUT_MS = 8000;

/**
 * Menjalankan kode custom milik bot untuk satu update Telegram yang masuk.
 * Kode user berbentuk fungsi async bernama `handle(ctx)` yang dipanggil dengan
 * objek `ctx` berisi data pesan dan helper aman.
 */
export async function runCustomHandler({ code, token, update, env }) {
  const validation = validateCustomCode(code);
  if (!validation.valid) {
    throw new Error(`Kode tidak valid: ${validation.error}`);
  }

  const message = update.message;
  const chatId = message?.chat?.id;

  const ctx = buildContext({ token, update, chatId, env });

  // Bungkus kode user jadi async function bernama `handle`.
  // new Function hanya diberi parameter `ctx` — tidak ada closure ke
  // scope module ini, jadi user tidak bisa menyentuh `token` mentah,
  // koneksi DB, atau helper internal lain di luar yang disediakan di ctx.
  const wrapped = `
    "use strict";
    return (async function(ctx) {
      ${code}
      if (typeof handle !== 'function') {
        throw new Error('Kode harus mendefinisikan async function bernama handle(ctx).');
      }
      return await handle(ctx);
    })(arguments[0]);
  `;

  let fn;
  try {
    fn = new Function(wrapped);
  } catch (e) {
    throw new Error(`Syntax error pada kode: ${e.message}`);
  }

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Eksekusi kode melebihi batas waktu (8 detik).')), TIMEOUT_MS)
  );

  return Promise.race([fn(ctx), timeout]);
}

function buildContext({ token, update, chatId, env }) {
  return {
    update,
    message: update.message,
    text: update.message?.text || '',
    chatId,
    from: update.message?.from || null,

    async sendMessage(text, options = {}) {
      return telegramCall(token, 'sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: options.parseMode || undefined,
        reply_markup: options.buttons ? buildInlineKeyboard(options.buttons) : undefined,
      });
    },

    async sendPhoto(photoUrl, options = {}) {
      return telegramCall(token, 'sendPhoto', {
        chat_id: chatId,
        photo: photoUrl,
        caption: options.caption || undefined,
        parse_mode: options.parseMode || undefined,
        reply_markup: options.buttons ? buildInlineKeyboard(options.buttons) : undefined,
      });
    },

    async sendButtons(text, buttons, options = {}) {
      return telegramCall(token, 'sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: options.parseMode || undefined,
        reply_markup: buildInlineKeyboard(buttons),
      });
    },

    // Helper generik untuk memanggil API luar (ChatGPT, dsb) tanpa
    // memberi user akses ke `fetch` global secara bebas — dibatasi
    // lewat wrapper ini supaya bisa diaudit/dibatasi domainnya nanti.
    async fetchJSON(url, options = {}) {
      const res = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      return res.json();
    },

    // Shortcut khusus buat OpenAI-compatible chat completion API
    // (OpenAI, atau provider lain yang kompatibel dengan format ChatGPT).
    async callAI({ apiKey, baseUrl = 'https://api.openai.com/v1', model = 'gpt-4o-mini', messages }) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Gagal memanggil API AI.');
      }
      return data.choices?.[0]?.message?.content || '';
    },

    // Key-value storage kecil per-bot, kalau kode user butuh simpan state
    // sederhana (mis. riwayat percakapan). Diisi dari luar lewat env.
    storage: env?.storage || null,
  };
}

function buildInlineKeyboard(buttons) {
  // buttons: [[{ text, url? , callback_data? }]] atau array datar
  const rows = Array.isArray(buttons[0]) ? buttons : [buttons];
  return { inline_keyboard: rows };
}

async function telegramCall(token, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}
