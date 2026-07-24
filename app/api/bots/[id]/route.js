import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getBot, saveBot, deleteBot, getLogs } from '@/lib/db';
import { deleteWebhook } from '@/lib/botEngine';
import { getSessionFromCookies } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function requireOwnership(id, session) {
  const bot = await getBot(id);
  if (!bot) return { error: NextResponse.json({ error: 'Bot tidak ditemukan' }, { status: 404 }) };
  if (bot.ownerId !== session.sub && session.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Bukan bot milikmu.' }, { status: 403 }) };
  }
  return { bot };
}

export async function GET(req, { params }) {
  const session = await getSessionFromCookies(cookies());
  if (!session) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });

  const { bot, error } = await requireOwnership(params.id, session);
  if (error) return error;

  const logs = await getLogs(params.id);
  return NextResponse.json({ bot: { ...bot, token: undefined }, logs });
}

export async function PATCH(req, { params }) {
  const session = await getSessionFromCookies(cookies());
  if (!session) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });

  const { bot, error } = await requireOwnership(params.id, session);
  if (error) return error;

  const body = await req.json();
  const updated = {
    ...bot,
    welcomeMessage: body.welcomeMessage ?? bot.welcomeMessage,
    fallbackMessage: body.fallbackMessage ?? bot.fallbackMessage,
    rules: body.rules ?? bot.rules,
    status: body.status ?? bot.status,
  };

  await saveBot(updated);
  return NextResponse.json({ bot: { ...updated, token: undefined } });
}

export async function DELETE(req, { params }) {
  const session = await getSessionFromCookies(cookies());
  if (!session) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });

  const { bot, error } = await requireOwnership(params.id, session);
  if (error) return error;

  await deleteWebhook(bot.token);
  await deleteBot(params.id);
  return NextResponse.json({ ok: true });
}
