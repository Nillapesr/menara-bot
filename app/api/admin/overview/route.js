import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/auth';
import { listUsers, listBots } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSessionFromCookies(cookies());
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Khusus admin.' }, { status: 403 });
  }

  const users = await listUsers();
  const bots = await listBots();

  const safeUsers = users.map((u) => ({
    id: u._id.toString(),
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt,
  }));

  const safeBots = bots.map((b) => ({
    id: b.id,
    username: b.username,
    firstName: b.firstName,
    status: b.status,
    ownerId: b.ownerId,
    messageCount: b.messageCount || 0,
    mode: b.mode || 'rules',
    createdAt: b.createdAt,
  }));

  return NextResponse.json({ users: safeUsers, bots: safeBots });
}
