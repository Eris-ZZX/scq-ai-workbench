// platform/auth/session.ts — 会话类型与工具 (F2.S2-S4)
export type SessionUser = {
  sub: string;
  username: string;
  role: string;
};

export { getSession as getCurrentUser } from './auth.config';
