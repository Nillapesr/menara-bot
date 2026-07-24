import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ user: null });

  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: { id: payload.sub, email: payload.email, role: payload.role },
  });
}
