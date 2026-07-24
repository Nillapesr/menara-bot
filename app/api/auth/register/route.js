import { NextResponse } from 'next/server';
import { createUser, findUserByEmail } from '@/lib/db';
import { hashPassword, createSessionToken, SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const body = await req.json();
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const name = (body.name || '').trim();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email tidak valid.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password minimal 6 karakter.' }, { status: 400 });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: 'Email sudah terdaftar. Coba login.' }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const user = {
    email,
    name: name || email.split('@')[0],
    passwordHash,
    role: 'user', // role pertama selalu 'user'; admin diset manual lewat database
    createdAt: Date.now(),
  };
  await createUser(user);

  const fresh = await findUserByEmail(email);
  const token = await createSessionToken({
    sub: fresh._id.toString(),
    email: fresh.email,
    role: fresh.role,
  });

  const res = NextResponse.json({
    ok: true,
    user: { email: fresh.email, name: fresh.name, role: fresh.role },
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
