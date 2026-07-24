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
  // COMMENT INI BIAR setInterval BISA DIPAKE
  // /\bFunction\s*\(/,
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
    if (!trigger || trigger.startsWith('@')) continue;
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

const DEFAULT_PARSE_MODE = 'HTML';

function resolveParseMode(options) {
  if (Object.prototype.hasOwnProperty.call(options, 'parseMode')) {
    return options.parseMode || undefined;
  }
  return DEFAULT_PARSE_MODE;
}

// ===== STORAGE PERSISTEN =====
const globalStorage = new Map();

function buildContext({ token, update, chatId, env }) {
  const chat = update.message?.chat || update.callback_query?.message?.chat;
  const callbackMessageId = update.callback_query?.message?.message_id || null;

  return {
    update,
    message: update.message,
    text: update.message?.text || '',
    chatId,
    messageId: update.message?.message_id || callbackMessageId || null,
    callbackMessageId,
    chatType: chat?.type || null,
    newChatMembers: update.message?.new_chat_members || null,
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

    async sendMessage(text, options = {}) {
      return telegramCall(token, 'sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: resolveParseMode(options),
        reply_markup: options.buttons ? buildInlineKeyboard(options.buttons) : undefined,
      });
    },

    async sendPhoto(photoUrl, options = {}) {
      return telegramCall(token, 'sendPhoto', {
        chat_id: chatId,
        photo: photoUrl,
        caption: options.caption || undefined,
        parse_mode: resolveParseMode(options),
        reply_markup: options.buttons ? buildInlineKeyboard(options.buttons) : undefined,
      });
    },

    async sendButtons(text, buttons, options = {}) {
      return telegramCall(token, 'sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: resolveParseMode(options),
        reply_markup: buildInlineKeyboard(buttons),
      });
    },

    async editMessageText(text, options = {}) {
      return telegramCall(token, 'editMessageText', {
        chat_id: chatId,
        message_id: options.messageId || callbackMessageId || update.message?.message_id,
        text,
        parse_mode: resolveParseMode(options),
        reply_markup: options.buttons ? buildInlineKeyboard(options.buttons) : undefined,
      });
    },

    async editMessageCaption(caption, options = {}) {
      return telegramCall(token, 'editMessageCaption', {
        chat_id: chatId,
        message_id: options.messageId || callbackMessageId || update.message?.message_id,
        caption,
        parse_mode: resolveParseMode(options),
        reply_markup: options.buttons ? buildInlineKeyboard(options.buttons) : undefined,
      });
    },

    async editMessageReplyMarkup(buttons, options = {}) {
      return telegramCall(token, 'editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: options.messageId || callbackMessageId || update.message?.message_id,
        reply_markup: buttons && buttons.length ? buildInlineKeyboard(buttons) : { inline_keyboard: [] },
      });
    },

    async deleteMessage(messageId) {
      return telegramCall(token, 'deleteMessage', {
        chat_id: chatId,
        message_id: messageId || callbackMessageId || update.message?.message_id,
      });
    },

    // ===== ANIMASI BUTTON WARNA =====
    startButtonAnimation(buttons, intervalMs = 2000) {
      const styles = ["primary", "success", "danger"];
      let index = 0;
      
      const messageId = this.callbackMessageId || this.messageId;
      const chatId = this.chatId;

      function applyStyleToButtons(btnArray, style) {
        return btnArray.map(row =>
          row.map(btn => ({
            ...btn,
            style: style
          }))
        );
      }

      if (this._animationInterval) {
        clearInterval(this._animationInterval);
        delete this._animationInterval;
      }

      const interval = setInterval(async () => {
        try {
          index = (index + 1) % styles.length;
          const currentStyle = styles[index];
          
          const animatedButtons = applyStyleToButtons(buttons, currentStyle);
          
          await telegramCall(token, 'editMessageReplyMarkup', {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: buildInlineKeyboard(animatedButtons),
          });
        } catch (err) {
          clearInterval(interval);
        }
      }, intervalMs);

      this._animationInterval = interval;

      return {
        stop: () => {
          clearInterval(interval);
          delete this._animationInterval;
        }
      };
    },

    stopButtonAnimation() {
      if (this._animationInterval) {
        clearInterval(this._animationInterval);
        delete this._animationInterval;
      }
    },

    // ===== MODERASI GRUP =====
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

    storage: {
      get: (key) => globalStorage.get(`${chatId}_${key}`),
      set: (key, value) => globalStorage.set(`${chatId}_${key}`, value),
      delete: (key) => globalStorage.delete(`${chatId}_${key}`),
      clear: () => {
        const keys = Array.from(globalStorage.keys()).filter(k => k.startsWith(`${chatId}_`));
        keys.forEach(k => globalStorage.delete(k));
      }
    },
  };
}

// ===== BUILD INLINE KEYBOARD =====
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
  if (!buttons) return { inline_keyboard: [] };
  
  // Pastikan buttons dalam format array of arrays
  let rows;
  if (Array.isArray(buttons) && Array.isArray(buttons[0])) {
    rows = buttons;
  } else if (Array.isArray(buttons)) {
    rows = [buttons];
  } else {
    rows = [];
  }

  const cleanRows = rows.map((row) =>
    (row || [])
      .filter(Boolean)
      .map((btn) => {
        const clean = {};
        for (const field of TELEGRAM_BUTTON_FIELDS) {
          if (btn[field] !== undefined) {
            clean[field] = btn[field];
          }
        }

        // JANGAN DIHAPUS! Ini biar style tetap ada
        // if (clean.style && !VALID_STYLES.has(clean.style)) {
        //   delete clean.style;
        // }

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

  return { inline_keyboard: cleanRows };
}

async function telegramCall(token, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}
