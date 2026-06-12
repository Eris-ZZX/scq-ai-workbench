// platform/auth/auth.config.ts - server-side auth helpers (F2.S2-S4)
import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { AUTH_CONFIG, COOKIE_NAME, getSecretKey } from './auth.jwt';

export { AUTH_CONFIG, getSecretKey } from './auth.jwt';

const revokedTokens = new Map<string, number>();

async function isSecureRequest() {
  const hdrs = await headers();
  const forwardedProto = hdrs.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwardedProto) return forwardedProto === 'https';

  const host = hdrs.get('host') ?? '';
  if (
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('[::1]')
  ) {
    return false;
  }

  return process.env.NODE_ENV === 'production';
}

export async function createSession(user: {
  id: string;
  username: string;
  role: string;
}) {
  const authAt = Date.now();
  const token = await new SignJWT({
    sub: user.id,
    username: user.username,
    role: user.role,
    authAt,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${AUTH_CONFIG.maxAge}s`)
    .sign(getSecretKey());

  const jar = await cookies();
  const secure = await isSecureRequest();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: AUTH_CONFIG.maxAge,
    path: '/',
  });
}

export async function maybeRefreshSession(existing: {
  sub: string;
  username: string;
  role: string;
}) {
  await createSession({
    id: existing.sub,
    username: existing.username,
    role: existing.role,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecretKey());
      rememberRevokedToken(token, payload);
      if (isValidPayload(payload)) {
        await prisma.user.update({
          where: { id: payload.sub },
          data: { updatedAt: new Date() },
          select: { id: true },
        });
      }
    } catch {
      rememberRevokedToken(token);
      // Cookie deletion should still happen when the token is already invalid.
    }
  }
  jar.delete(COOKIE_NAME);
}

function rememberRevokedToken(token: string, payload?: unknown) {
  const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const expiresAt = typeof p.exp === 'number' ? p.exp * 1000 : Date.now() + AUTH_CONFIG.maxAge * 1000;
  revokedTokens.set(token, expiresAt);
}

function isRevokedToken(token: string) {
  const expiresAt = revokedTokens.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    revokedTokens.delete(token);
    return false;
  }
  return true;
}

function isValidPayload(
  payload: unknown,
): payload is { sub: string; username: string; role: string; iat?: number; authAt?: number } {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.sub === 'string' &&
    typeof p.username === 'string' &&
    typeof p.role === 'string' &&
    (p.iat === undefined || typeof p.iat === 'number') &&
    (p.authAt === undefined || typeof p.authAt === 'number')
  );
}

export async function getSession(): Promise<{
  sub: string;
  username: string;
  role: string;
} | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  if (isRevokedToken(token)) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!isValidPayload(payload)) {
      console.warn('[auth] Invalid JWT payload');
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });
    if (!user || user.status !== 'active') return null;

    const issuedAtMs = typeof payload.authAt === 'number'
      ? payload.authAt
      : typeof payload.iat === 'number'
        ? payload.iat * 1000
        : 0;
    const clockSkewMs = typeof payload.authAt === 'number' ? 0 : 1000;
    if (!issuedAtMs || issuedAtMs < user.updatedAt.getTime() - clockSkewMs) {
      return null;
    }

    return {
      sub: user.id,
      username: user.username,
      role: user.role,
    };
  } catch {
    return null;
  }
}
