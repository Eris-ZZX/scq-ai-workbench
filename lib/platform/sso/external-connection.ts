import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { PlatformExternalAppConnection } from '@/db/schema';
import { getSecretKey } from '@/platform/auth/auth.jwt';

export const DRAWING_RELIABILITY_APP_ID = 'sqm-drawing-reliability';
export const DRAWING_RELIABILITY_DISPLAY_NAME = '图纸可靠性匹配';
const DEFAULT_DRAWING_RELIABILITY_URL = 'http://127.0.0.1:8001';
const SECRET_FORMAT = 'v1';

export type DrawingReliabilityConnection = {
  appId: string;
  displayName: string;
  launchUrl: string;
  exchangeSecret: string;
  enabled: boolean;
  source: 'database' | 'environment' | 'default';
};

export type DrawingReliabilityConnectionView = {
  appId: string;
  displayName: string;
  launchUrl: string;
  note: string;
  enabled: boolean;
  secretConfigured: boolean;
  secretHint: string;
  source: DrawingReliabilityConnection['source'];
  updatedAt: Date | null;
};

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
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new ExternalConnectionError(
      'INVALID_EXTERNAL_APP_URL',
      '外挂应用地址 must use https in production。',
    );
  }

  return url.toString();
}

async function findConnection() {
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
        DRAWING_RELIABILITY_APP_ID,
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

function sourceFor(record: typeof PlatformExternalAppConnection.$inferSelect | undefined) {
  if (record) return 'database' as const;
  if (process.env.SQM_DRAWING_RELIABILITY_URL || process.env.SQM_LAUNCH_EXCHANGE_SECRET) {
    return 'environment' as const;
  }
  return 'default' as const;
}

export async function getDrawingReliabilityConnection(): Promise<DrawingReliabilityConnection> {
  const record = await findConnection();
  const launchUrl = record?.launchUrl?.trim() || fallbackLaunchUrl();
  let exchangeSecret = fallbackSecret();

  if (record?.exchangeSecretCiphertext) {
    exchangeSecret = decryptExternalAppSecret(record.exchangeSecretCiphertext);
  }

  return {
    appId: DRAWING_RELIABILITY_APP_ID,
    displayName: record?.displayName || DRAWING_RELIABILITY_DISPLAY_NAME,
    launchUrl,
    exchangeSecret,
    enabled: record?.enabled ?? true,
    source: sourceFor(record),
  };
}

function maskSecret(secret: string) {
  if (!secret) return '';
  return `••••${secret.slice(-4)}`;
}

export async function getDrawingReliabilityConnectionView(): Promise<DrawingReliabilityConnectionView> {
  const record = await findConnection();
  const secret = record?.exchangeSecretCiphertext
    ? decryptExternalAppSecret(record.exchangeSecretCiphertext)
    : fallbackSecret();

  return {
    appId: DRAWING_RELIABILITY_APP_ID,
    displayName: record?.displayName || DRAWING_RELIABILITY_DISPLAY_NAME,
    launchUrl: record?.launchUrl?.trim() || fallbackLaunchUrl(),
    note: record?.note || '',
    enabled: record?.enabled ?? true,
    secretConfigured: Boolean(secret),
    secretHint: maskSecret(secret),
    source: sourceFor(record),
    updatedAt: record?.updatedAt ?? null,
  };
}

export async function saveDrawingReliabilityConnection(input: {
  launchUrl: string;
  note: string;
  exchangeSecret?: string;
  enabled: boolean;
  updatedByUserId: string;
}) {
  const launchUrl = validateExternalAppLaunchUrl(input.launchUrl);
  const note = input.note.trim().slice(0, 500);
  const record = await findConnection();
  const secret = input.exchangeSecret?.trim() || '';
  const encryptedSecret = secret
    ? encryptExternalAppSecret(secret)
    : record?.exchangeSecretCiphertext || '';

  if (input.enabled && !encryptedSecret && !fallbackSecret()) {
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
        displayName: DRAWING_RELIABILITY_DISPLAY_NAME,
        launchUrl,
        note,
        exchangeSecretCiphertext: encryptedSecret,
        enabled: input.enabled,
        updatedByUserId: input.updatedByUserId,
        updatedAt: new Date(),
      })
      .where(eq(
        PlatformExternalAppConnection.appId,
        DRAWING_RELIABILITY_APP_ID,
      ));
  } else {
    await database.insert(PlatformExternalAppConnection).values({
      appId: DRAWING_RELIABILITY_APP_ID,
      displayName: DRAWING_RELIABILITY_DISPLAY_NAME,
      launchUrl,
      note,
      exchangeSecretCiphertext: encryptedSecret,
      enabled: input.enabled,
      updatedByUserId: input.updatedByUserId,
    });
  }

  return getDrawingReliabilityConnectionView();
}

export async function testDrawingReliabilityConnection() {
  const connection = await getDrawingReliabilityConnection();
  if (!connection.enabled) {
    throw new ExternalConnectionError(
      'EXTERNAL_APP_DISABLED',
      '图纸可靠性入口已停用。',
    );
  }

  const base = new URL(validateExternalAppLaunchUrl(connection.launchUrl));
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
        `图纸可靠性应用健康检查失败（HTTP ${response.status}）。`,
      );
    }
    return {
      ok: true,
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
      message: '图纸可靠性应用连接正常。',
    };
  } catch (error) {
    if (error instanceof ExternalConnectionError) throw error;
    throw new ExternalConnectionError(
      'EXTERNAL_APP_UNREACHABLE',
      '无法连接图纸可靠性应用。',
    );
  } finally {
    clearTimeout(timer);
  }
}
