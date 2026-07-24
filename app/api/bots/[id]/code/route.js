import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getBot, saveBot } from '@/lib/db';
import { validateCustomCode } from '@/lib/botRuntime';
import { getSessionFromCookies } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  const session = await getSessionFromCookies(cookies());
  if (!session) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });

  const bot = await getBot(params.id);
  if (!bot) return NextResponse.json({ error: 'Bot tidak ditemukan' }, { status: 404 });
  if (bot.ownerId !== session.sub && session.role !== 'admin') {
    return NextResponse.json({ error: 'Bukan bot milikmu.' }, { status: 403 });
  }

  const body = await req.json();
  const code = (body.code || '').trim();

  if (code) {
    const validation = validateCustomCode(code);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  bot.customCode = code || '';
  bot.mode = code ? 'custom' : 'rules';
  await saveBot(bot);

  return NextResponse.json({ ok: true, mode: bot.mode });
}
