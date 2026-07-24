import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getBot, saveBot } from '@/lib/db';
import { validateCustomCode } from '@/lib/botRuntime';
import { getSessionFromCookies } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function authorize(id) {
  const session = await getSessionFromCookies(cookies());
  if (!session) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };

  const bot = await getBot(id);
  if (!bot) return { error: NextResponse.json({ error: 'Bot tidak ditemukan' }, { status: 404 }) };
  if (bot.ownerId !== session.sub && session.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Bukan bot milikmu.' }, { status: 403 }) };
  }
  return { bot };
}

// GET: daftar semua command milik bot
export async function GET(req, { params }) {
  const { bot, error } = await authorize(params.id);
  if (error) return error;
  return NextResponse.json({ commands: bot.commands || [] });
}

// POST: tambah command baru { trigger, code }
export async function POST(req, { params }) {
  const { bot, error } = await authorize(params.id);
  if (error) return error;

  const body = await req.json();
  const trigger = (body.trigger || '').trim();
  const code = (body.code || '').trim();

  if (!trigger) {
    return NextResponse.json({ error: 'Trigger command tidak boleh kosong.' }, { status: 400 });
  }
  if (code) {
    const validation = validateCustomCode(code);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  const commands = Array.isArray(bot.commands) ? [...bot.commands] : [];
  if (commands.some((c) => c.trigger === trigger)) {
    return NextResponse.json({ error: 'Command dengan trigger ini sudah ada.' }, { status: 400 });
  }

  const newCommand = { id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, trigger, code };
  commands.push(newCommand);

  bot.commands = commands;
  bot.mode = 'commands';
  await saveBot(bot);

  return NextResponse.json({ ok: true, command: newCommand, commands });
}
