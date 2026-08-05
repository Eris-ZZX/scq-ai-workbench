import type { JWTPayload } from 'jose';

export type AuthingClaims = {
  issuer: string;
  subject: string;
  username: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
};

function claimString(claims: JWTPayload, key: string) {
  const value = claims[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function mapAuthingClaims(issuer: string, claims: JWTPayload): AuthingClaims {
  const subject = claimString(claims, 'sub');
  const username =
    claimString(claims, 'username') ??
    claimString(claims, 'preferred_username');

  if (!subject) throw new Error('Authing id_token 缺少 sub');
  if (!username) throw new Error('Authing 未返回 username claim，无法登录');

  return {
    issuer,
    subject,
    username,
    name: claimString(claims, 'name'),
    email: claimString(claims, 'email'),
    avatar: claimString(claims, 'picture') ?? claimString(claims, 'avatar'),
  };
}

export function authingIdentityKey(identity: Pick<AuthingClaims, 'issuer' | 'subject'>) {
  return `${identity.issuer.replace(/\/+$/, '')}:${identity.subject}`;
}
