import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getBot, saveBot } from '@/lib/db';
import { validateCustomCode } from '@/lib/botRuntime';
import { getSessionFromCookies } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_COMMANDS_PER_IMPORT = 200;

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

// POST: import banyak command sekaligus dari file JSON yang diupload di dashboard.
// Body: { items: [{ trigger, code }, ...], mode: 'merge' | 'replace' }
//
// Catatan keamanan: setiap `code` tetap divalidasi lewat validateCustomCode
// (blokir require/process/fs/eval/dll) dan tetap dieksekusi lewat sandbox
// runCustomHandler yang sama seperti command yang ditulis manual di editor.
// Import JSON TIDAK memberi jalan pintas untuk menjalankan kode di luar
// sandbox itu — ini murni cara mengisi banyak command sekaligus.
export async function POST(req, { params }) {
  const { bot, error } = await authorize(params.id);
  if (error) return error;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'File bukan JSON yang valid.' }, { status: 400 });
  }

  const items = Array.isArray(body?.items) ? body.items : Array.isArray(body) ? body : null;
  if (!items) {
    return NextResponse.json(
      { error: 'Format tidak dikenali. Harus berupa array command, atau { "items": [...] }.' },
      { status: 400 }
    );
  }
  if (items.length === 0) {
    return NextResponse.json({ error: 'File JSON tidak berisi command apa pun.' }, { status: 400 });
  }
  if (items.length > MAX_COMMANDS_PER_IMPORT) {
    return NextResponse.json(
      { error: `Terlalu banyak command dalam satu file (maksimal ${MAX_COMMANDS_PER_IMPORT}).` },
      { status: 400 }
    );
  }

  const replace = body?.mode === 'replace';

  const existing = replace ? [] : Array.isArray(bot.commands) ? [...bot.commands] : [];
  const existingTriggers = new Set(existing.map((c) => c.trigger));

  const rejected = [];
  const imported = [];

  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const trigger = (raw?.trigger || '').toString().trim();
    const code = (raw?.code || '').toString().trim();

    if (!trigger) {
      rejected.push({ index: i, reason: 'Trigger kosong.' });
      continue;
    }
    if (code) {
      const validation = validateCustomCode(code);
      if (!validation.valid) {
        rejected.push({ index: i, trigger, reason: validation.error });
        continue;
      }
    }
    if (existingTriggers.has(trigger)) {
      rejected.push({ index: i, trigger, reason: 'Trigger sudah dipakai command lain, dilewati.' });
      continue;
    }

    const newCommand = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${i}`,
      trigger,
      code,
    };
    existing.push(newCommand);
    existingTriggers.add(trigger);
    imported.push(newCommand);
  }

  if (imported.length === 0) {
    return NextResponse.json(
      { error: 'Tidak ada command yang berhasil diimpor.', rejected },
      { status: 400 }
    );
  }

  bot.commands = existing;
  bot.mode = 'commands';
  await saveBot(bot);

  return NextResponse.json({
    ok: true,
    commands: existing,
    importedCount: imported.length,
    rejected,
  });
}
