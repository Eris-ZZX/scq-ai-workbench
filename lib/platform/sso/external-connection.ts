import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { PlatformExternalAppConnection } from '@/db/schema';
import { getSecretKey } from '@/platform/auth/auth.jwt';

export const DRAWING_RELIABILITY_APP_ID = 'sqm-drawing-reliability';
export const DRAWING_RELIABILITY_DISPLAY_NAME = '图纸可靠性匹配';
const DEFAULT_DRAWING_RELIABILITY_URL = 'http://127.0.0.1:8001';
const SECRET_FORMAT = 'v1';

export type ExternalAppConnection = {
  appId: string;
  displayName: string;
  launchUrl: string;
  exchangeSecret: string;
  enabled: boolean;
  source: 'database' | 'environment' | 'default';
};

export type ExternalAppConnectionView = {
  appId: string;
  displayName: string;
  launchUrl: string;
  note: string;
  enabled: boolean;
  secretConfigured: boolean;
  secretHint: string;
  source: ExternalAppConnection['source'];
  updatedAt: Date | null;
};

export type DrawingReliabilityConnection = ExternalAppConnection;
export type DrawingReliabilityConnectionView = ExternalAppConnectionView;

export class ExternalConnectionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ExternalConnectionError';
  }
}

function encryptionKey() {
  return createHash('sha256')
    .update(getSecretKey())
    .update('platform-external-app-connection-v1')
    .digest();
}

export function encryptExternalAppSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  return [
    SECRET_FORMAT,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptExternalAppSecret(value: string) {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = value.split('.');
  if (
    version !== SECRET_FORMAT
    || !ivEncoded
    || !tagEncoded
    || !ciphertextEncoded
  ) {
    throw new ExternalConnectionError(
      'INVALID_EXTERNAL_SECRET',
      '外挂应用密钥格式无效。',
    );
  }

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(ivEncoded, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new ExternalConnectionError(
      'INVALID_EXTERNAL_SECRET',
      '外挂应用密钥无法解密。',
    );
  }
}

export function validateExternalAppLaunchUrl(raw: string) {
  const value = raw.trim();
  if (!value) {
    throw new ExternalConnectionError(
      'INVALID_EXTERNAL_APP_URL',
      '外挂应用地址不能为空。',
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ExternalConnectionError(
      'INVALID_EXTERNAL_APP_URL',
      '外挂应用地址格式无效。',
    );
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ExternalConnectionError(
      'INVALID_EXTERNAL_APP_URL',
      '外挂应用地址必须使用 http 或 https。',
    );
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new ExternalConnectionError(
      'INVALID_EXTERNAL_APP_URL',
      '外挂应用地址不能包含账号、密码、查询参数或片段。',
    );
  }
  return url.toString();
}

function isPrivateProbeHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized === '::1'
    || normalized === '0.0.0.0'
    || /^f[cd][0-9a-f]{2}:/i.test(normalized)
    || /^fe[89ab][0-9a-f]:/i.test(normalized)
  ) {
    return true;
  }

  const octets = normalized.split('.');
  if (octets.length !== 4 || octets.some((octet) => !/^\d+$/.test(octet))) return false;
  const [first = 0, second = 0] = octets.map(Number);
  return first === 10
    || first === 127
    || first === 169 && second === 254
    || first === 172 && second >= 16 && second <= 31
    || first === 192 && second === 168;
}

export function validateExternalAppProbeUrl(raw: string) {
  const normalized = validateExternalAppLaunchUrl(raw);
  const url = new URL(normalized);
  if (process.env.NODE_ENV === 'production' && isPrivateProbeHostname(url.hostname)) {
    throw new ExternalConnectionError(
      'UNSAFE_EXTERNAL_APP_URL',
      '生产环境禁止对内网地址执行服务端连接测试。',
    );
  }
  return normalized;
}

async function findConnection(appId: string) {
  if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL?.trim() || '')) {
    // Unit tests and pre-migration local smoke runs may only exercise the
    // environment fallback without a live PostgreSQL connection.
    return undefined;
  }
  try {
    const [record] = await getDatabase()
      .select()
      .from(PlatformExternalAppConnection)
      .where(eq(
        PlatformExternalAppConnection.appId,
        appId,
      ))
      .limit(1);
    return record;
  } catch (error) {
    const candidate = error as { code?: unknown; cause?: { code?: unknown } };
    if (candidate.code === '42P01' || candidate.cause?.code === '42P01') {
      // Keep the environment-variable migration fallback usable until the
      // versioned migration has been applied in an existing deployment.
      return undefined;
    }
    throw error;
  }
}

function fallbackLaunchUrl() {
  const configured = process.env.SQM_DRAWING_RELIABILITY_URL?.trim();
  return configured || DEFAULT_DRAWING_RELIABILITY_URL;
}

function fallbackSecret() {
  return process.env.SQM_LAUNCH_EXCHANGE_SECRET?.trim() || '';
}

function fallbackFor(appId: string) {
  if (appId !== DRAWING_RELIABILITY_APP_ID) {
    return {
      displayName: appId,
      launchUrl: '',
      exchangeSecret: '',
      enabled: false,
      source: 'default' as const,
    };
  }

  return {
    displayName: DRAWING_RELIABILITY_DISPLAY_NAME,
    launchUrl: fallbackLaunchUrl(),
    exchangeSecret: fallbackSecret(),
    enabled: true,
    source: 'environment' as const,
  };
}

function sourceFor(
  record: typeof PlatformExternalAppConnection.$inferSelect | undefined,
  appId: string,
) {
  if (record) return 'database' as const;
  if (
    appId === DRAWING_RELIABILITY_APP_ID
    && (process.env.SQM_DRAWING_RELIABILITY_URL || process.env.SQM_LAUNCH_EXCHANGE_SECRET)
  ) {
    return 'environment' as const;
  }
  return 'default' as const;
}

export async function getExternalAppConnection(appId: string): Promise<ExternalAppConnection> {
  const fallback = fallbackFor(appId);
  const record = await findConnection(appId);
  const launchUrl = record?.launchUrl?.trim() || fallback.launchUrl;
  let exchangeSecret = fallback.exchangeSecret;

  if (record?.exchangeSecretCiphertext) {
    exchangeSecret = decryptExternalAppSecret(record.exchangeSecretCiphertext);
  }

  return {
    appId,
    displayName: record?.displayName || fallback.displayName,
    launchUrl,
    exchangeSecret,
    enabled: record?.enabled ?? fallback.enabled,
    source: sourceFor(record, appId),
  };
}

function maskSecret(secret: string) {
  if (!secret) return '';
  return `••••${secret.slice(-4)}`;
}

export async function getExternalAppConnectionView(
  appId: string,
  displayName?: string,
): Promise<ExternalAppConnectionView> {
  const fallback = fallbackFor(appId);
  const record = await findConnection(appId);
  const secret = record?.exchangeSecretCiphertext
    ? decryptExternalAppSecret(record.exchangeSecretCiphertext)
    : fallback.exchangeSecret;

  return {
    appId,
    displayName: record?.displayName || displayName || fallback.displayName,
    launchUrl: record?.launchUrl?.trim() || fallback.launchUrl,
    note: record?.note || '',
    enabled: record?.enabled ?? fallback.enabled,
    secretConfigured: Boolean(secret),
    secretHint: maskSecret(secret),
    source: sourceFor(record, appId),
    updatedAt: record?.updatedAt ?? null,
  };
}

export async function saveExternalAppConnection(input: {
  appId: string;
  displayName: string;
  mode: 'external-link' | 'external-sso';
  launchUrl: string;
  note: string;
  exchangeSecret?: string;
  enabled: boolean;
  updatedByUserId: string;
}) {
  const launchUrl = validateExternalAppLaunchUrl(input.launchUrl);
  const note = input.note.trim().slice(0, 500);
  const displayName = input.displayName.trim().slice(0, 100) || input.appId;
  const record = await findConnection(input.appId);
  const secret = input.exchangeSecret?.trim() || '';
  const encryptedSecret = secret
    ? encryptExternalAppSecret(secret)
    : record?.exchangeSecretCiphertext || '';

  const fallback = fallbackFor(input.appId);
  if (
    input.mode === 'external-sso'
    && input.enabled
    && !encryptedSecret
    && !fallback.exchangeSecret
  ) {
    throw new ExternalConnectionError(
      'EXTERNAL_APP_SECRET_REQUIRED',
      '启用外挂应用前必须配置兑换密钥。',
    );
  }

  const database = getDatabase();
  if (record) {
    await database
      .update(PlatformExternalAppConnection)
      .set({
        displayName,
        launchUrl,
        note,
        exchangeSecretCiphertext: encryptedSecret,
        enabled: input.enabled,
        updatedByUserId: input.updatedByUserId,
        updatedAt: new Date(),
      })
      .where(eq(
        PlatformExternalAppConnection.appId,
        input.appId,
      ));
  } else {
    await database.insert(PlatformExternalAppConnection).values({
      appId: input.appId,
      displayName,
      launchUrl,
      note,
      exchangeSecretCiphertext: encryptedSecret,
      enabled: input.enabled,
      updatedByUserId: input.updatedByUserId,
    });
  }

  return getExternalAppConnectionView(input.appId, displayName);
}

export async function deleteExternalAppConnection(appId: string) {
  await getDatabase()
    .delete(PlatformExternalAppConnection)
    .where(eq(PlatformExternalAppConnection.appId, appId));
}

export function getExternalAppLaunchEndpoint(launchUrl: string) {
  const base = new URL(validateExternalAppLaunchUrl(launchUrl));
  const path = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`;
  base.pathname = path;
  return new URL('api/auth/sso/launch', base).toString();
}

export async function testExternalAppConnection(
  appId: string,
  mode: 'external-link' | 'external-sso',
) {
  const connection = await getExternalAppConnection(appId);
  if (!connection.enabled) {
    throw new ExternalConnectionError(
      'EXTERNAL_APP_DISABLED',
      '外挂应用入口已停用。',
    );
  }

  const validatedUrl = mode === 'external-sso'
    ? validateExternalAppProbeUrl(connection.launchUrl)
    : validateExternalAppLaunchUrl(connection.launchUrl);
  if (mode === 'external-link') {
    return {
      ok: true,
      statusCode: null,
      latencyMs: 0,
      message: '外挂应用地址格式有效，可通过新标签页打开。',
    };
  }

  const base = new URL(validatedUrl);
  base.pathname = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`;
  const healthUrl = new URL('api/health', base);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  const startedAt = Date.now();

  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new ExternalConnectionError(
        'EXTERNAL_APP_UNHEALTHY',
        `外挂应用健康检查失败（HTTP ${response.status}）。`,
      );
    }
    return {
      ok: true,
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
      message: '外挂应用连接正常。',
    };
  } catch (error) {
    if (error instanceof ExternalConnectionError) throw error;
    throw new ExternalConnectionError(
      'EXTERNAL_APP_UNREACHABLE',
      '无法连接外挂应用。',
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function getDrawingReliabilityConnection(): Promise<DrawingReliabilityConnection> {
  return getExternalAppConnection(DRAWING_RELIABILITY_APP_ID);
}

export async function getDrawingReliabilityConnectionView(): Promise<DrawingReliabilityConnectionView> {
  return getExternalAppConnectionView(
    DRAWING_RELIABILITY_APP_ID,
    DRAWING_RELIABILITY_DISPLAY_NAME,
  );
}

export async function saveDrawingReliabilityConnection(input: {
  launchUrl: string;
  note: string;
  exchangeSecret?: string;
  enabled: boolean;
  updatedByUserId: string;
}) {
  return saveExternalAppConnection({
    appId: DRAWING_RELIABILITY_APP_ID,
    displayName: DRAWING_RELIABILITY_DISPLAY_NAME,
    mode: 'external-sso',
    ...input,
  });
}

export async function testDrawingReliabilityConnection() {
  return testExternalAppConnection(DRAWING_RELIABILITY_APP_ID, 'external-sso');
}
