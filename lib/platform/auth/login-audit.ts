import { db } from '@/lib/database';

export type AuthLoginProvider = 'authing' | 'dingtalk' | 'password' | 'sqm-sso';
export type AuthLoginStage =
  | 'initiation'
  | 'callback'
  | 'credentials'
  | 'session';
export type AuthLoginOutcome = 'success' | 'failure';

const SAFE_ERROR_PARAM_KEYS = new Set([
  'error',
  'error_code',
  'error_description',
  'error_reason',
  'error_uri',
]);

const SENSITIVE_AUTHING_KEYS = new Set([
  'access_token',
  'authorization',
  'client_secret',
  'code',
  'code_verifier',
  'cookie',
  'id_token',
  'nonce',
  'password',
  'refresh_token',
  'secret',
  'state',
  'token',
]);

const MAX_AUTHING_DATA_LENGTH = 128 * 1024;

function truncate(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function redactErrorMessage(value: string | null | undefined) {
  const normalized = truncate(value, 1000);
  if (!normalized) return null;
  return normalized.replace(
    /\b(access_token|id_token|refresh_token|client_secret|code_verifier|password|nonce|state|code)=([^\s&,]+)/gi,
    '$1=[REDACTED]',
  );
}

export function safeAuthErrorParams(url: URL | string) {
  const parsed = typeof url === 'string' ? new URL(url) : url;
  const safe: Record<string, string> = {};
  for (const key of SAFE_ERROR_PARAM_KEYS) {
    const value = parsed.searchParams.get(key);
    if (value) safe[key] = value.slice(0, 500);
  }
  return safe;
}

export function parseAuthErrorParams(value: unknown): Record<string, string> {
  if (typeof value !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, item]) => SAFE_ERROR_PARAM_KEYS.has(key) && typeof item === 'string',
      ),
    );
  } catch {
    return {};
  }
}

function sanitizeAuthingValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuthingValue);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_AUTHING_KEYS.has(key.toLowerCase()))
      .map(([key, item]) => [key, sanitizeAuthingValue(item)]),
  );
}

function serializeAuthingData(value: unknown) {
  if (value === undefined || value === null) return null;
  const serialized = JSON.stringify(sanitizeAuthingValue(value));
  if (serialized.length <= MAX_AUTHING_DATA_LENGTH) return serialized;
  return JSON.stringify({
    truncated: true,
    value: serialized.slice(0, MAX_AUTHING_DATA_LENGTH),
  });
}

export function parseAuthingData(value: unknown): unknown {
  if (typeof value !== 'string') return null;
  try {
    return sanitizeAuthingValue(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}

export function authRequestContext(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ipAddress = forwardedFor?.split(',')[0]?.trim() || realIp?.trim() || null;
  return {
    requestPath: truncate(new URL(request.url).pathname, 500),
    ipAddress: truncate(ipAddress, 128),
    userAgent: truncate(request.headers.get('user-agent'), 512),
  };
}

export async function recordAuthLoginEvent(input: {
  request: Request;
  provider: AuthLoginProvider;
  stage: AuthLoginStage;
  outcome: AuthLoginOutcome;
  username?: string | null;
  displayName?: string | null;
  userId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  errorParams?: Record<string, string>;
  authingData?: unknown;
}) {
  const context = authRequestContext(input.request);
  try {
    await db.authLoginLog.create({
      data: {
        userId: truncate(input.userId, 255),
        provider: input.provider,
        stage: input.stage,
        outcome: input.outcome,
        username: truncate(input.username, 255),
        displayName: truncate(input.displayName, 255),
        errorCode: truncate(input.errorCode, 100),
        errorMessage: redactErrorMessage(input.errorMessage),
        errorParams: JSON.stringify(input.errorParams ?? {}),
        authingData: serializeAuthingData(input.authingData),
        requestPath: context.requestPath,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
  } catch (error) {
    // Login telemetry must never make a valid login fail.
    console.error('[auth] failed to persist login audit event', error);
  }
}
