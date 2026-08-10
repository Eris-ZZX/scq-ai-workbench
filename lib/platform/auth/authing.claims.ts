import type { JWTPayload } from 'jose';

export type AuthingClaims = {
  issuer: string;
  subject: string;
  username: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  // 全量 OIDC claims（与 users 表列名一致）
  unionid: string | null;
  phoneNumber: string | null;
  phoneNumberVerified: boolean | null;
  emailVerified: boolean | null;
  address: string | null;
  birthdate: string | null;
  gender: string | null;
  locale: string | null;
  nickname: string | null;
  preferredUsername: string | null;
  profile: string | null;
  website: string | null;
  zoneinfo: string | null;
  externalId: string | null;
  extendedFields: string | null;
  employeeNumber: string | null;
  tenantId: string | null;
  userpoolId: string | null;
  roles: string | null;
};

function claimString(claims: JWTPayload, key: string) {
  const value = claims[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function claimBoolean(claims: JWTPayload, key: string): boolean | null {
  const value = claims[key];
  return typeof value === 'boolean' ? value : null;
}

function parseExtendedFields(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function mapAuthingClaims(issuer: string, claims: JWTPayload): AuthingClaims {
  const subject = claimString(claims, 'sub');
  const username =
    claimString(claims, 'username') ??
    claimString(claims, 'preferred_username');

  if (!subject) throw new Error('Authing id_token 缺少 sub');
  if (!username) throw new Error('Authing 未返回 username claim，无法登录');

  // extended_fields 是对象，序列化为 JSON 文本存储
  const extendedFields = claims.extended_fields;
  const extendedFieldsObject = parseExtendedFields(extendedFields);
  const extendedFieldsText = extendedFieldsObject
    ? JSON.stringify(extendedFieldsObject)
    : claimString(claims, 'extended_fields');
  const employeeNumber = typeof extendedFieldsObject?.emp_no === 'string'
    && extendedFieldsObject.emp_no.trim()
    ? extendedFieldsObject.emp_no.trim()
    : null;

  const roles = claims.roles;
  const rolesText = Array.isArray(roles)
    ? JSON.stringify(roles)
    : typeof roles === 'string' && roles.trim()
      ? roles
      : null;

  return {
    issuer,
    subject,
    username,
    name: claimString(claims, 'name'),
    email: claimString(claims, 'email'),
    avatar: claimString(claims, 'picture') ?? claimString(claims, 'avatar'),
    unionid: claimString(claims, 'unionid'),
    phoneNumber: claimString(claims, 'phone_number'),
    phoneNumberVerified: claimBoolean(claims, 'phone_number_verified'),
    emailVerified: claimBoolean(claims, 'email_verified'),
    address: claimString(claims, 'address'),
    birthdate: claimString(claims, 'birthdate'),
    gender: claimString(claims, 'gender'),
    locale: claimString(claims, 'locale'),
    nickname: claimString(claims, 'nickname'),
    preferredUsername: claimString(claims, 'preferred_username'),
    profile: claimString(claims, 'profile'),
    website: claimString(claims, 'website'),
    zoneinfo: claimString(claims, 'zoneinfo'),
    externalId: claimString(claims, 'external_id'),
    extendedFields: extendedFieldsText,
    employeeNumber,
    tenantId: claimString(claims, 'tenant_id'),
    userpoolId: claimString(claims, 'userpool_id'),
    roles: rolesText,
  };
}

export function authingIdentityKey(identity: Pick<AuthingClaims, 'issuer' | 'subject'>) {
  return `${identity.issuer.replace(/\/+$/, '')}:${identity.subject}`;
}
