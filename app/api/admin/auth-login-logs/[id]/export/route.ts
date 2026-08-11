import { db } from '@/lib/database';
import { parseAuthErrorParams } from '@/platform/auth/login-audit';
import { requireSystemAdminApi } from '@/platform/permissions/system-admin';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const row = await db.authLoginLog.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, username: true, displayName: true } },
    },
  });
  if (!row) return Response.json({ error: '登录日志不存在' }, { status: 404 });

  const exportData = {
    id: row.id,
    provider: row.provider,
    stage: row.stage,
    outcome: row.outcome,
    username: row.username,
    displayName: row.displayName,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    errorParams: parseAuthErrorParams(row.errorParams),
    requestPath: row.requestPath,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
    user: row.user
      ? {
          id: row.user.id,
          username: row.user.username,
          displayName: row.user.displayName || row.user.username,
        }
      : null,
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="auth-login-log-${row.id}.json"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
