import { NextResponse } from 'next/server';
import { listBots } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const bots = await listBots();
  return NextResponse.json({ ok: true, activeBots: bots.length, checkedAt: Date.now() });
}
