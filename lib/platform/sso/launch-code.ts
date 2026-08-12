import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { PlatformLaunchToken } from '@/db/schema';

export const DRAWING_RELIABILITY_APP_ID = 'sqm-drawing-reliability';
export const PLATFORM_LAUNCH_CODE_TTL_SECONDS = 60;

function configuredDrawingReliabilityUrl() {
  const raw = process.env.SQM_DRAWING_RELIABILITY_URL?.trim();
  if (!raw) {
    throw new Error('SQM_DRAWING_RELIABILITY_URL is not configured');
  }

  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('SQM_DRAWING_RELIABILITY_URL must use http or https');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('SQM_DRAWING_RELIABILITY_URL must not contain credentials or query parameters');
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('SQM_DRAWING_RELIABILITY_URL must use https in production');
  }
  return url;
}

export function getDrawingReliabilityLaunchEndpoint() {
  const base = configuredDrawingReliabilityUrl();
  const path = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`;
  base.pathname = path;
  return new URL('api/auth/sso/launch', base).toString();
}

export function hashLaunchCode(code: string) {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

export async function issueLaunchCode(subjectUserId: string, appId = DRAWING_RELIABILITY_APP_ID) {
  if (!subjectUserId.trim()) throw new Error('subjectUserId is required');

  const code = randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PLATFORM_LAUNCH_CODE_TTL_SECONDS * 1000);
  const database = getDatabase();

  // Keep the short-lived table bounded without introducing a separate worker.
  await database
    .delete(PlatformLaunchToken)
    .where(lt(PlatformLaunchToken.expiresAt, now));

  await database.insert(PlatformLaunchToken).values({
    appId,
    tokenHash: hashLaunchCode(code),
    subjectUserId,
    expiresAt,
    createdAt: now,
  });

  return code;
}

export async function consumeLaunchCode(code: string, appId = DRAWING_RELIABILITY_APP_ID) {
  const normalizedCode = code.trim();
  if (!normalizedCode || normalizedCode.length > 256) return null;

  const now = new Date();
  const [consumed] = await getDatabase()
    .update(PlatformLaunchToken)
    .set({ consumedAt: now })
    .where(and(
      eq(PlatformLaunchToken.appId, appId),
      eq(PlatformLaunchToken.tokenHash, hashLaunchCode(normalizedCode)),
      isNull(PlatformLaunchToken.consumedAt),
      gt(PlatformLaunchToken.expiresAt, now),
    ))
    .returning({
      subjectUserId: PlatformLaunchToken.subjectUserId,
    });

  return consumed ?? null;
}
