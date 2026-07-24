import { NextResponse } from 'next/server';
import { getBot, saveBot, pushLog, getStorage, setStorage } from '@/lib/db';
import { findReply, sendTelegramMessage } from '@/lib/botEngine';
import { runCustomHandler } from '@/lib/botRuntime';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  const bot = await getBot(params.botId);
  if (!bot) return NextResponse.json({ ok: false }, { status: 404 });

  if (bot.status === 'paused') {
    return NextResponse.json({ ok: true }); // bot dijeda, abaikan pesan diam-diam
  }

  const update = await req.json();
  const message = update.message;

  if (!message) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat?.id;
  const text = message.text || '';
  const from = message.from?.username || message.from?.first_name || 'unknown';

  // Mode 1: kode custom milik user (engine JS bebas dalam sandbox terbatas)
  if (bot.mode === 'custom' && bot.customCode) {
    try {
      const storageData = await getStorage(bot.id);
      await runCustomHandler({
        code: bot.customCode,
        token: bot.token,
        update,
        env: {
          storage: {
            get: (key) => storageData?.[key],
            set: async (key, value) => {
              storageData[key] = value;
              await setStorage(bot.id, storageData);
            },
          },
        },
      });
      await pushLog(bot.id, { from, text, reply: '(dijalankan oleh kode custom)' });
    } catch (err) {
      await pushLog(bot.id, { from, text, reply: `ERROR: ${err.message}` });
      // Beri tahu user di Telegram kalau kodenya error, supaya gampang debug
      try {
        await sendTelegramMessage(bot.token, chatId, `⚠️ Bot error: ${err.message}`);
      } catch (_) {}
    }
  } else {
    // Mode 2 (default): rule-based sederhana, tanpa coding
    if (!text) return NextResponse.json({ ok: true });
    const reply = findReply(bot, text);
    if (reply) {
      await sendTelegramMessage(bot.token, chatId, reply);
    }
    await pushLog(bot.id, { from, text, reply: reply || '(tidak ada balasan)' });
  }

  bot.messageCount = (bot.messageCount || 0) + 1;
  await saveBot(bot);

  return NextResponse.json({ ok: true });
}

// Telegram kadang cek endpoint dengan GET saat setup, balas OK saja
export async function GET() {
  return NextResponse.json({ ok: true, message: 'Webhook aktif' });
}
