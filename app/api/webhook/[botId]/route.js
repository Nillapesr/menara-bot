import { NextResponse } from 'next/server';
import { getBot, saveBot, pushLog, getStorage, setStorage } from '@/lib/db';
import { findReply, sendTelegramMessage } from '@/lib/botEngine';
import { runCustomHandler, findMatchingCommand } from '@/lib/botRuntime';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  const bot = await getBot(params.botId);
  if (!bot) return NextResponse.json({ ok: false }, { status: 404 });

  if (bot.status === 'paused') {
    return NextResponse.json({ ok: true }); // bot dijeda, abaikan pesan diam-diam
  }

  const update = await req.json();
  const message = update.message;
  const callbackQuery = update.callback_query;

  if (!message && !callbackQuery) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message?.chat?.id || callbackQuery?.message?.chat?.id;
  const text = message?.text || '';
  const callbackData = callbackQuery?.data || '';
  const fromUser = message?.from || callbackQuery?.from;
  const from = fromUser?.username || fromUser?.first_name || 'unknown';

  // Mode 1: bot berbasis command dengan kode JS per-command
  if (bot.mode === 'commands' && Array.isArray(bot.commands) && bot.commands.length) {
    const matched = findMatchingCommand(bot.commands, {
      text,
      callbackData,
      newChatMembers: message?.new_chat_members,
      leftChatMember: message?.left_chat_member,
    });

    if (matched && matched.code) {
      try {
        const storageData = await getStorage(bot.id);
        await runCustomHandler({
          code: matched.code,
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
        await pushLog(bot.id, {
          from,
          text: text || (callbackData ? `[callback] ${callbackData}` : eventLabel(message)),
          reply: `(dijalankan oleh command "${matched.trigger}")`,
        });
      } catch (err) {
        await pushLog(bot.id, { from, text, reply: `ERROR: ${err.message}` });
        if (chatId) {
          try {
            await sendTelegramMessage(bot.token, chatId, `⚠️ Bot error: ${err.message}`);
          } catch (_) {}
        }
      }
    } else if (text) {
      // Tidak ada command yang cocok, pakai fallback message jika ada
      if (bot.fallbackMessage) {
        await sendTelegramMessage(bot.token, chatId, bot.fallbackMessage);
      }
      await pushLog(bot.id, { from, text, reply: bot.fallbackMessage || '(tidak ada balasan)' });
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

function eventLabel(message) {
  if (message?.new_chat_members?.length) {
    const names = message.new_chat_members.map((u) => u.username || u.first_name).join(', ');
    return `[anggota baru] ${names}`;
  }
  if (message?.left_chat_member) {
    const u = message.left_chat_member;
    return `[anggota keluar] ${u.username || u.first_name}`;
  }
  return '(event)';
}
