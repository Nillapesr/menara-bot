// Engine ini menentukan bagaimana bot membalas pesan masuk,
// berdasarkan "rules" yang disimpan per-bot (diatur dari dashboard, tanpa coding).
//
// Setiap rule: { trigger: "halo", type: "contains" | "exact" | "starts", reply: "Halo juga!" }
// Ada juga fallback default dan command bawaan /start, /help.

export function findReply(bot, incomingText) {
  const text = (incomingText || '').trim();
  const lower = text.toLowerCase();

  if (lower === '/start') {
    return bot.welcomeMessage || 'Halo! Bot ini sudah aktif dan siap membalas pesanmu.';
  }

  if (lower === '/help') {
    const list = (bot.rules || [])
      .map((r) => `• ${r.trigger}`)
      .join('\n');
    return list
      ? `Kata kunci yang saya kenali:\n${list}`
      : 'Belum ada kata kunci yang diatur untuk bot ini.';
  }

  const rules = bot.rules || [];
  for (const rule of rules) {
    const trigger = (rule.trigger || '').toLowerCase();
    if (!trigger) continue;

    if (rule.type === 'exact' && lower === trigger) return rule.reply;
    if (rule.type === 'starts' && lower.startsWith(trigger)) return rule.reply;
    if ((rule.type === 'contains' || !rule.type) && lower.includes(trigger)) return rule.reply;
  }

  return bot.fallbackMessage || null;
}

export async function sendTelegramMessage(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return res.json();
}

export async function setWebhook(token, url) {
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return res.json();
}

export async function deleteWebhook(token) {
  const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
    method: 'POST',
  });
  return res.json();
}

export async function getMe(token) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  return res.json();
}
