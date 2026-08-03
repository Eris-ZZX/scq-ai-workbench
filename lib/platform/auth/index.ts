// platform/auth — 认证模块出口
export {
  AUTH_CONFIG,
  createSession,
  destroySession,
  getSession,
  getSecretKey,
  maybeRefreshSession,
} from './auth.config';
export { getCurrentUser } from './session';
export type { SessionUser } from './session';
export { authMiddleware } from './middleware';
