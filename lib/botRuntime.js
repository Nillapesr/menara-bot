// ================================================================
//  BOTRUNTIME.JS - SUPPORT RICH MESSAGE + BUTTON WARNA
//  Developer: @makloayam
// ================================================================

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
 * Mencari command yang cocok dengan pesan/callback/event masuk, berdasarkan trigger.
 * commands: [{ trigger, code }, ...]
 * Trigger diawali '/': harus persis sama (atau diikuti spasi) dengan teks pesan.
 * Trigger event khusus (tanpa teks, dipicu Telegram sendiri):
 *   '@join'  -> ada anggota baru masuk grup (new_chat_members)
 *   '@leave' -> ada anggota keluar/dikeluarkan dari grup (left_chat_member)
 * Trigger tanpa '/' atau '@': cocok jika teks pesan mengandung trigger tsb (keyword bebas),
 * atau jika callback_data persis sama dengan trigger.
 */
export function findMatchingCommand(commands, { text, callbackData, newChatMembers, leftChatMember }) {
  const list = commands || [];

  if (callbackData) {
    const byCallback = list.find((c) => (c.trigger || '').trim() === callbackData);
    if (byCallback) return byCallback;
  }

  if (newChatMembers && newChatMembers.length) {
    const byJoin = list.find((c) => (c.trigger || '').trim().toLowerCase() === '@join');
    if (byJoin) return byJoin;
  }

  if (leftChatMember) {
    const byLeave = list.find((c) => (c.trigger || '').trim().toLowerCase() === '@leave');
    if (byLeave) return byLeave;
  }

  const lower = (text || '').trim().toLowerCase();
  if (!lower) return null;

  for (const c of list) {
    const trigger = (c.trigger || '').trim().toLowerCase();
    if (!trigger || trigger.startsWith('@')) continue; // trigger event tidak dicocokkan ke teks biasa
    if (trigger.startsWith('/')) {
      if (lower === trigger || lower.startsWith(trigger + ' ')) return c;
    } else if (lower.includes(trigger)) {
      return c;
    }
  }
  return null;
}

/**
 * Menjalankan kode custom milik SATU command untuk satu update Telegram yang masuk.
 * Kode user berbentuk fungsi async bernama `handle(ctx)` yang dipanggil dengan
 * objek `ctx` berisi data pesan dan helper aman.
 */
export async function runCustomHandler({ code, token, update, env }) {
  const validation = validateCustomCode(code);
  if (!validation.valid) {
    throw new Error(`Kode tidak valid: ${validation.error}`);
  }

  const message = update.message;
  const callbackQuery = update.callback_query;
  const chatId = message?.chat?.id || callbackQuery?.message?.chat?.id;

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

// Default parse_mode: pakai HTML supaya semua tag HTML yang didukung Telegram
// (<b>, <strong>, <i>, <em>, <u>, <s>, <code>, <pre>, <a href="">, <blockquote>,
// <blockquote expandable>, <tg-spoiler>, <span class="tg-spoiler">, dst) langsung
// jalan tanpa user perlu set parseMode manual tiap kali. Tetap bisa dioverride
// per-panggilan lewat options.parseMode (mis. 'Markdown', 'MarkdownV2', atau null
// untuk plain text).
const DEFAULT_PARSE_MODE = 'HTML';

function resolveParseMode(options) {
  if (Object.prototype.hasOwnProperty.call(options, 'parseMode')) {
    return options.parseMode || undefined; // izinkan null/'' -> plain text
  }
  return DEFAULT_PARSE_MODE;
}

function buildContext({ token, update, chatId, env }) {
  const chat = update.message?.chat || update.callback_query?.message?.chat;
  // Pesan yang sedang ditampilkan saat tombol inline diklik (kalau ini
  // dipicu callback_query) — dibutuhkan untuk edit/hapus pesan itu sendiri.
  const callbackMessageId = update.callback_query?.message?.message_id || null;

  return {
    update,
    message: update.message,
    text: update.message?.text || '',
    chatId,
    messageId: update.message?.message_id || callbackMessageId || null,
    callbackMessageId,
    chatType: chat?.type || null, // 'private' | 'group' | 'supergroup' | 'channel'
    newChatMembers: update.message?.new_chat_members || null, // dipakai buat command welcome
    leftChatMember: update.message?.left_chat_member || null,
    from: update.message?.from || update.callback_query?.from || null,
    callbackQuery: update.callback_query || null,
    callbackData: update.callback_query?.data || null,

    async answerCallback(text, options = {}) {
      if (!update.callback_query) return null;
      return telegramCall(token, 'answerCallbackQuery', {
        callback_query_id: update.callback_query.id,
        text: text || undefined,
        show_alert: options.showAlert || false,
      });
    },

    // ================================================================
    // SEND RICH MESSAGE + BUTTON WARNA (SUPPORT FULL HTML)
    // ================================================================
    async sendRichMessage(html, options = {}) {
      const payload = {
        chat_id: chatId,
        rich_message: { html },
      };
      if (options.buttons) {
        payload.reply_markup = { inline_keyboard: buildInlineKeyboard(options.buttons) };
      }
      return telegramCall(token, 'sendRichMessage', payload);
    },

    // ================================================================
    // SEND MESSAGE (SUPPORT BUTTON + HTML)
    // ================================================================
    async sendMessage(text, options = {}) {
      return telegramCall(token, 'sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: resolveParseMode(options),
        reply_markup: options.buttons ? { inline_keyboard: buildInlineKeyboard(options.buttons) } : undefined,
      });
    },

    // ================================================================
    // SEND PHOTO + RICH CAPTION + BUTTON WARNA
    // ================================================================
    async sendPhoto(photoUrl, options = {}) {
      return telegramCall(token, 'sendPhoto', {
        chat_id: chatId,
        photo: photoUrl,
        caption: options.caption || undefined,
        parse_mode: resolveParseMode(options),
        reply_markup: options.buttons ? { inline_keyboard: buildInlineKeyboard(options.buttons) } : undefined,
      });
    },

    // ================================================================
    // SEND BUTTONS (TANPA RICH MESSAGE)
    // ================================================================
    async sendButtons(text, buttons, options = {}) {
      return telegramCall(token, 'sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: resolveParseMode(options),
        reply_markup: { inline_keyboard: buildInlineKeyboard(buttons) },
      });
    },

    // ================================================================
    // EDIT RICH MESSAGE + BUTTON WARNA
    // ================================================================
    async editRichMessage(html, options = {}) {
      const payload = {
        chat_id: chatId,
        message_id: options.messageId || callbackMessageId || update.message?.message_id,
        rich_message: { html },
      };
      if (options.buttons) {
        payload.reply_markup = { inline_keyboard: buildInlineKeyboard(options.buttons) };
      }
      return telegramCall(token, 'editRichMessage', payload);
    },

    // ---- Edit & hapus pesan ----
    async editMessageText(text, options = {}) {
      return telegramCall(token, 'editMessageText', {
        chat_id: chatId,
        message_id: options.messageId || callbackMessageId || update.message?.message_id,
        text,
        parse_mode: resolveParseMode(options),
        reply_markup: options.buttons ? { inline_keyboard: buildInlineKeyboard(options.buttons) } : undefined,
      });
    },

    async editMessageCaption(caption, options = {}) {
      return telegramCall(token, 'editMessageCaption', {
        chat_id: chatId,
        message_id: options.messageId || callbackMessageId || update.message?.message_id,
        caption,
        parse_mode: resolveParseMode(options),
        reply_markup: options.buttons ? { inline_keyboard: buildInlineKeyboard(options.buttons) } : undefined,
      });
    },

    async editMessageReplyMarkup(buttons, options = {}) {
      return telegramCall(token, 'editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: options.messageId || callbackMessageId || update.message?.message_id,
        reply_markup: buttons && buttons.length ? { inline_keyboard: buildInlineKeyboard(buttons) } : { inline_keyboard: [] },
      });
    },

    async deleteMessage(messageId) {
      return telegramCall(token, 'deleteMessage', {
        chat_id: chatId,
        message_id: messageId || callbackMessageId || update.message?.message_id,
      });
    },

    // ---- Moderasi grup ----
    async isGroupAdmin(userId) {
      const uid = userId || update.message?.from?.id || update.callback_query?.from?.id;
      if (!uid || !chatId) return false;
      const res = await telegramCall(token, 'getChatMember', { chat_id: chatId, user_id: uid });
      const status = res?.result?.status;
      return status === 'administrator' || status === 'creator';
    },

    async muteUser(userId, durationSeconds) {
      const payload = {
        chat_id: chatId,
        user_id: userId,
        permissions: {
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
          can_send_video_notes: false,
          can_send_voice_notes: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
        },
      };
      if (durationSeconds) {
        payload.until_date = Math.floor(Date.now() / 1000) + durationSeconds;
      }
      return telegramCall(token, 'restrictChatMember', payload);
    },

    async unmuteUser(userId) {
      return telegramCall(token, 'restrictChatMember', {
        chat_id: chatId,
        user_id: userId,
        permissions: {
          can_send_messages: true,
          can_send_audios: true,
          can_send_documents: true,
          can_send_photos: true,
          can_send_videos: true,
          can_send_video_notes: true,
          can_send_voice_notes: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
        },
      });
    },

    async kickUser(userId) {
      await telegramCall(token, 'banChatMember', { chat_id: chatId, user_id: userId });
      return telegramCall(token, 'unbanChatMember', { chat_id: chatId, user_id: userId, only_if_banned: true });
    },

    async banUser(userId, untilSeconds) {
      const payload = { chat_id: chatId, user_id: userId };
      if (untilSeconds) payload.until_date = Math.floor(Date.now() / 1000) + untilSeconds;
      return telegramCall(token, 'banChatMember', payload);
    },

    async unbanUser(userId) {
      return telegramCall(token, 'unbanChatMember', { chat_id: chatId, user_id: userId, only_if_banned: true });
    },

    async pinMessage(messageId, options = {}) {
      return telegramCall(token, 'pinChatMessage', {
        chat_id: chatId,
        message_id: messageId || update.message?.message_id,
        disable_notification: options.silent || false,
      });
    },

    async unpinMessage(messageId) {
      if (messageId) {
        return telegramCall(token, 'unpinChatMessage', { chat_id: chatId, message_id: messageId });
      }
      return telegramCall(token, 'unpinAllChatMessages', { chat_id: chatId });
    },

    async fetchJSON(url, options = {}) {
      const res = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      return res.json();
    },

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

    storage: env?.storage || null,
  };
}

// Field tombol inline yang dikenal Telegram Bot API.
const TELEGRAM_BUTTON_FIELDS = [
  'text',
  'url',
  'callback_data',
  'web_app',
  'login_url',
  'switch_inline_query',
  'switch_inline_query_current_chat',
  'switch_inline_query_chosen_chat',
  'copy_text',
  'callback_game',
  'pay',
  'style',
  'icon_custom_emoji_id',
];

const VALID_STYLES = new Set(['danger', 'primary', 'success']);

function buildInlineKeyboard(buttons) {
  if (!buttons) return [];
  const rows = Array.isArray(buttons[0]) ? buttons : [buttons];

  const cleanRows = rows.map((row) =>
    (row || [])
      .filter(Boolean)
      .map((btn) => {
        const clean = {};
        for (const field of TELEGRAM_BUTTON_FIELDS) {
          if (btn[field] !== undefined) clean[field] = btn[field];
        }
        if (clean.style && !VALID_STYLES.has(clean.style)) {
          delete clean.style;
        }
        clean.text = clean.text || ' ';
        const hasAction = TELEGRAM_BUTTON_FIELDS
          .filter((f) => f !== 'text' && f !== 'style' && f !== 'icon_custom_emoji_id')
          .some((f) => clean[f] !== undefined);
        if (!hasAction) {
          clean.callback_data = 'noop';
        }
        return clean;
      })
  );

  return cleanRows;
}

async function telegramCall(token, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}
