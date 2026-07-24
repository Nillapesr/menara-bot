import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/db';
import { verifyPassword, createSessionToken, SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const body = await req.json();
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  const user = await findUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: 'Email atau password salah.' }, { status: 400 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'Email atau password salah.' }, { status: 400 });
  }

  const token = await createSessionToken({
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  const res = NextResponse.json({
    ok: true,
    user: { email: user.email, name: user.name, role: user.role },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
