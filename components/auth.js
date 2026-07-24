import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const SESSION_COOKIE = 'menara_session';
const secretKey = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'ganti-ini-di-production-lewat-env-var'
);

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey);
}

export async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (e) {
    return null;
  }
}

export { SESSION_COOKIE };

// Daftar admin diatur lewat ENV, BUKAN lewat field role di MongoDB.
// Isi ADMIN_EMAILS di .env / .env.local, pisahkan dengan koma kalau lebih dari satu:
// ADMIN_EMAILS=owner@email.com,admin2@email.com
function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email) {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

// Role efektif dihitung dari ENV setiap saat, tidak pernah dipercaya dari DB/token lama.
export function resolveRole(email) {
  return isAdminEmail(email) ? 'admin' : 'user';
}

export async function getSessionFromCookies(cookieStore) {
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  // Selalu timpa role dari payload lama dengan hasil cek ENV terbaru.
  return { ...payload, role: resolveRole(payload.email) };
}
