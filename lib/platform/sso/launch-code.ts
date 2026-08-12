import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { PlatformLaunchToken } from '@/db/schema';
import {
  DRAWING_RELIABILITY_APP_ID as DRAWING_RELIABILITY_CONNECTION_APP_ID,
  validateExternalAppLaunchUrl,
} from './external-connection';

export const DRAWING_RELIABILITY_APP_ID = DRAWING_RELIABILITY_CONNECTION_APP_ID;
export const PLATFORM_LAUNCH_CODE_TTL_SECONDS = 60;

function configuredDrawingReliabilityUrl(rawValue?: string) {
  // Local development can use the default single-port drawing app. Production
  // still fails closed below unless an explicit HTTPS deployment URL is set.
  const raw = rawValue?.trim()
    || process.env.SQM_DRAWING_RELIABILITY_URL?.trim()
    || 'http://127.0.0.1:8001';
  return new URL(validateExternalAppLaunchUrl(raw));
}

export function getDrawingReliabilityLaunchEndpoint(launchUrl?: string) {
  const base = configuredDrawingReliabilityUrl(launchUrl);
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
