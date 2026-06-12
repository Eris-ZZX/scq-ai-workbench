const COOKIE_NAME = 'qe-session';

let _warnedDevSecret = false;

export function getSecretKey() {
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  if (!_warnedDevSecret && !process.env.JWT_SECRET) {
    console.warn('[auth] ⚠ JWT_SECRET 未设置，使用开发默认密钥。生产环境请设置环境变量！');
    _warnedDevSecret = true;
  }
  return new TextEncoder().encode(
    process.env.JWT_SECRET ?? 'qe-dev-secret-change-in-production',
  );
}

export const AUTH_CONFIG = {
  cookieName: COOKIE_NAME,
  /** JWT 有效期：7 天 */
  maxAge: 7 * 24 * 60 * 60,
  /** 距到期剩余少于此值时自动刷新 session（滑动窗口） */
  refreshThreshold: 1 * 24 * 60 * 60,
} as const;

export { COOKIE_NAME };
