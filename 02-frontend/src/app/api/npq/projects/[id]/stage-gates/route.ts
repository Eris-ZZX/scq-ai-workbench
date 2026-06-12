import { NextResponse } from 'next/server';
import { canAccessProject, ensureProjectActivities } from '@/lib/db/activities';
import { canExecuteNpqAction } from '@/lib/db/npq-permissions';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/platform/auth/auth.config';

const STAGES = ['TR1', 'TR2&3', 'TR4', 'TR4A', 'TR5', 'TR6'];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id: projectId } = await params;
  const allowed = await canAccessProject(projectId, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: '无权访问' }, { status: 403 });

  await ensureProjectActivities(projectId);
  const [project, gates, parents] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, currentStage: true, stageGateStatus: true, status: true },
    }),
    prisma.stageGateRecord.findMany({ where: { projectId } }),
    prisma.projectActivityParent.findMany({
      where: { projectId },
      select: { stage: true, status: true, hasBlocked: true },
    }),
  ]);
  if (!project) return NextResponse.json({ error: '项目不存在' }, { status: 404 });

  const parentStats = new Map<string, { total: number; open: number; blocked: number }>();
  for (const parent of parents) {
    const stats = parentStats.get(parent.stage) ?? { total: 0, open: 0, blocked: 0 };
    stats.total += 1;
    if (parent.status !== 'closed') stats.open += 1;
    if (parent.hasBlocked) stats.blocked += 1;
    parentStats.set(parent.stage, stats);
  }

  return NextResponse.json({
    project,
    gates: gates
      .map((gate) => ({
        ...gate,
        stats: parentStats.get(gate.stage) ?? { total: 0, open: 0, blocked: 0 },
      }))
      .sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage)),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id: projectId } = await params;
  const allowed = await canExecuteNpqAction({ actionKey: 'stage_gate.pass', session, projectId });
  if (!allowed) return NextResponse.json({ error: '无权通过阶段门' }, { status: 403 });

  let body: { stage?: string; conditionReleaseNote?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }
  const stage = body.stage?.trim();
  if (!stage || !STAGES.includes(stage)) return NextResponse.json({ error: '无效阶段' }, { status: 400 });

  const parents = await prisma.projectActivityParent.findMany({
    where: { projectId, stage },
    select: { id: true, status: true, hasBlocked: true, projectTaskName: true },
  });
  const openParents = parents.filter((parent) => parent.status !== 'closed');
  const blockedParents = parents.filter((parent) => parent.hasBlocked);
  const needsCondition = openParents.length > 0 || blockedParents.length > 0;
  const note = body.conditionReleaseNote?.trim() || null;
  if (needsCondition && !note) {
    return NextResponse.json({ error: '存在未关闭或阻塞母任务时，需要填写条件放行说明' }, { status: 422 });
  }

  const nextStage = nextStageOf(stage);
  const status = needsCondition ? 'conditional_release' : 'passed';
  const blockerSummary = needsCondition
    ? JSON.stringify({
        openParents: openParents.map((parent) => parent.projectTaskName),
        blockedParents: blockedParents.map((parent) => parent.projectTaskName),
      })
    : null;

  const result = await prisma.$transaction(async (tx) => {
    const gate = await tx.stageGateRecord.upsert({
      where: { projectId_stage: { projectId, stage } },
      create: {
        projectId,
        stage,
        status,
        passedAt: new Date(),
        passedById: session.sub,
        conditionReleaseNote: note,
        blockerSummary,
      },
      update: {
        status,
        passedAt: new Date(),
        passedById: session.sub,
        conditionReleaseNote: note,
        blockerSummary,
      },
    });

    await tx.project.update({
      where: { id: projectId },
      data: {
        currentStage: nextStage ?? stage,
        currentStageStartedAt: nextStage ? new Date() : undefined,
        stageGateStatus: nextStage ? 'active' : 'completed',
        status: nextStage ? undefined : 'completed',
        completedAt: nextStage ? undefined : new Date(),
      },
    });

    await tx.activityEvent.create({
      data: {
        projectId,
        actorUserId: session.sub,
        actorRole: 'NPQ',
        actionType: status === 'passed' ? 'pass_stage_gate' : 'conditional_release_stage_gate',
        afterValue: JSON.stringify({ stage, status, nextStage, openParentCount: openParents.length, blockedParentCount: blockedParents.length }),
        note,
      },
    });

    return gate;
  });

  return NextResponse.json(result);
}

function nextStageOf(stage: string) {
  const index = STAGES.indexOf(stage);
  if (index < 0 || index >= STAGES.length - 1) return null;
  return STAGES[index + 1]!;
}
