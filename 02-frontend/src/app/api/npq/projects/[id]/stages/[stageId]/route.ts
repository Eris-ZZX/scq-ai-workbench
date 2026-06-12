// PATCH/DELETE /api/npq/projects/[id]/stages/[stageId] (F3.S5)
// 🔧 S-1: Added project membership verification
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { getProjectById, updateStage, deleteStage } from '@/lib/db/projects';

async function checkStageAccess(stageId: string) {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 };
  // 通过 stage 查找对应 project 并验证 membership
  const prisma = (await import('@/lib/prisma')).prisma;
  const stage = await prisma.projectStage.findUnique({
    where: { id: stageId },
    select: { projectId: true },
  });
  if (!stage) return { error: '阶段不存在', status: 404 };
  const project = await getProjectById(stage.projectId, session.sub);
  if (!project) return { error: '项目不存在', status: 404 };
  return { session, project, stage, status: 0 };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; stageId: string }> }) {
  const { stageId } = await params;
  const result = await checkStageAccess(stageId);
  if (result.status) return NextResponse.json({ error: result.error }, { status: result.status });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  const stage = await updateStage(stageId, body);
  return NextResponse.json(stage);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; stageId: string }> }) {
  const { stageId } = await params;
  const result = await checkStageAccess(stageId);
  if (result.status) return NextResponse.json({ error: result.error }, { status: result.status });
  await deleteStage(stageId);
  return NextResponse.json({ ok: true });
}
