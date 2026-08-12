import { DEFAULT_AFTER_LOGIN } from '@/platform/auth/constants';

export const AUTH_RETURN_COOKIE = 'auth_return_to';

/** Only allow same-origin relative paths (block open redirects). */
export function sanitizeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.trim();
  if (/^https?:\/\//i.test(path)) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (path.startsWith('/login') || path.startsWith('/api/auth')) return null;
  return path;
}

export function resolveReturnPath(raw: string | null | undefined, fallback = DEFAULT_AFTER_LOGIN) {
  return sanitizeReturnPath(raw) ?? fallback;
}
