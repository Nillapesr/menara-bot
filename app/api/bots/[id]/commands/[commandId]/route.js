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

// PATCH: ubah trigger dan/atau kode command tertentu
export async function PATCH(req, { params }) {
  const { bot, error } = await authorize(params.id);
  if (error) return error;

  const body = await req.json();
  const commands = Array.isArray(bot.commands) ? [...bot.commands] : [];
  const idx = commands.findIndex((c) => c.id === params.commandId);
  if (idx === -1) {
    return NextResponse.json({ error: 'Command tidak ditemukan.' }, { status: 404 });
  }

  if (typeof body.code === 'string') {
    const code = body.code.trim();
    if (code) {
      const validation = validateCustomCode(code);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }
    commands[idx] = { ...commands[idx], code };
  }

  if (typeof body.trigger === 'string') {
    const trigger = body.trigger.trim();
    if (!trigger) {
      return NextResponse.json({ error: 'Trigger command tidak boleh kosong.' }, { status: 400 });
    }
    if (commands.some((c, i) => i !== idx && c.trigger === trigger)) {
      return NextResponse.json({ error: 'Command dengan trigger ini sudah ada.' }, { status: 400 });
    }
    commands[idx] = { ...commands[idx], trigger };
  }

  bot.commands = commands;
  await saveBot(bot);

  return NextResponse.json({ ok: true, command: commands[idx], commands });
}

// DELETE: hapus command tertentu
export async function DELETE(req, { params }) {
  const { bot, error } = await authorize(params.id);
  if (error) return error;

  const commands = (bot.commands || []).filter((c) => c.id !== params.commandId);
  bot.commands = commands;
  await saveBot(bot);

  return NextResponse.json({ ok: true, commands });
}
