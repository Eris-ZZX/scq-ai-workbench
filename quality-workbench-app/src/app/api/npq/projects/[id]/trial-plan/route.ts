import { NextResponse } from 'next/server';
import { canAccessProject } from '@/lib/db/activities';
import { isProjectOwner } from '@/lib/db/npq-permissions';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/platform/auth/auth.config';

type TrialPlanNodeInput = {
  item?: string;
  plannedStartDate?: string | null;
  plannedDueDate?: string | null;
  note?: string | null;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id: projectId } = await params;
  const allowed = await canAccessProject(projectId, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: '无权访问' }, { status: 403 });

  const rows = await prisma.projectTrialPlanNode.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
  });
  return NextResponse.json(rows);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id: projectId } = await params;
  const allowed = await isProjectOwner(session.sub, projectId);
  if (!allowed) return NextResponse.json({ error: '无权维护试产计划' }, { status: 403 });

  let body: { rows?: TrialPlanNodeInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  const cleanRows = rows
    .map((row, index) => ({
      projectId,
      item: row.item?.trim() ?? '',
      plannedStartDate: parseDate(row.plannedStartDate),
      plannedDueDate: parseDate(row.plannedDueDate),
      note: row.note?.trim() || null,
      sortOrder: index,
    }))
    .filter((row) => row.item);

  const savedRows = await prisma.$transaction(async (tx) => {
    await tx.projectTrialPlanNode.deleteMany({ where: { projectId } });
    if (cleanRows.length > 0) {
      await tx.projectTrialPlanNode.createMany({ data: cleanRows });
    }
    return tx.projectTrialPlanNode.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });
  });

  return NextResponse.json(savedRows);
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
