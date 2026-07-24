import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies, resolveRole } from '@/lib/auth';
import { listUsers, listBots } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const session = await getSessionFromCookies(cookies());
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Khusus admin.' }, { status: 403 });
  }

  const users = await listUsers();
  const bots = await listBots();

  // Peta ownerId -> user, supaya tabel bot bisa tampilkan email pemilik, bukan cuma ID mentah.
  const userById = new Map(users.map((u) => [u._id.toString(), u]));

  const proto = req.headers.get('host')?.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${proto}://${req.headers.get('host')}`;

  const safeUsers = users.map((u) => ({
    id: u._id.toString(),
    email: u.email,
    name: u.name,
    role: resolveRole(u.email),
    createdAt: u.createdAt,
  }));

  const safeBots = bots.map((b) => {
    const owner = userById.get(b.ownerId);
    return {
      id: b.id,
      username: b.username,
      firstName: b.firstName,
      status: b.status,
      ownerId: b.ownerId,
      ownerEmail: owner?.email || '—',
      ownerName: owner?.name || '—',
      messageCount: b.messageCount || 0,
      commandCount: Array.isArray(b.commands) ? b.commands.length : 0,
      mode: b.mode || 'rules',
      createdAt: b.createdAt,
      serverUrl: `${baseUrl}/api/webhook/${b.id}`,
    };
  });

  return NextResponse.json({ users: safeUsers, bots: safeBots });
}
