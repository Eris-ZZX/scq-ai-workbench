import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { isProjectOwner, isProjectMember } from '@/lib/db/npq-permissions';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId') ?? undefined;
  const actions = (url.searchParams.get('actions') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const result: Record<string, boolean> = {};
  for (const actionKey of actions) {
    result[actionKey] = await checkNpqAction(actionKey, session, projectId);
  }

  return NextResponse.json(result);
}

async function checkNpqAction(
  actionKey: string,
  session: { sub: string; role: string },
  projectId?: string,
): Promise<boolean> {
  // Admin can do everything
  if (session.role === 'admin') return true;

  // project.create: any authenticated user (admin pages gate this separately)
  if (actionKey === 'project.create') return true;

  // All other actions require a projectId
  if (!projectId) return false;

  // Ownership-gated actions
  const ownerActions = new Set([
    'activity.parent_close',
    'activity.snapshot_adjust',
    'activity.batch_update',
    'stage_gate.pass',
  ]);
  if (ownerActions.has(actionKey)) {
    return isProjectOwner(session.sub, projectId);
  }

  // Member-gated actions
  const memberActions = new Set(['activity.child_update_own']);
  if (memberActions.has(actionKey)) {
    return isProjectMember(session.sub, projectId);
  }

  // Default: require at least membership
  return isProjectMember(session.sub, projectId);
}
