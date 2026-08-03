// GET/POST /api/npq/projects — 项目列表 + 创建
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { createProject } from '@/lib/db/projects';
import { paginatedResponse, parsePagination } from '@/lib/pagination';
import { db } from '@/lib/database';

const listSelect = {
  id: true,
  name: true,
  status: true,
  currentStage: true,
  startDate: true,
  expectedEndDate: true,
} as const;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { page, pageSize, skip } = parsePagination(request.nextUrl.searchParams);
  const where =
    session.role === 'admin' || session.role === 'manager'
      ? undefined
      : { members: { some: { userId: session.sub } } };

  const [total, items] = await Promise.all([
    db.project.count({ where }),
    db.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
      select: listSelect,
    }),
  ]);

  return NextResponse.json(paginatedResponse(items, total, page, pageSize));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: {
    name?: string;
    description?: string;
    templateId?: string;
    activityTemplateSetId?: string;
    startDate?: string;
    expectedEndDate?: string;
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name || name.length === 0) {
    return NextResponse.json({ error: '项目名称为必填项' }, { status: 400 });
  }
  if (name.length > 200) return NextResponse.json({ error: '项目名称不超过 200 字符' }, { status: 400 });

  function parseOptionalDate(value?: string) {
    if (!value) return undefined;
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }

  // 🔧 H-2: templateId为falsy时传undefined，createProject内用所有isDefault模板
  const project = await createProject({
    name,
    description: body.description?.trim(),
    ownerId: session.sub,
    templateId: body.templateId || undefined,
    activityTemplateSetId: body.activityTemplateSetId || undefined,
    startDate: parseOptionalDate(body.startDate),
    expectedEndDate: parseOptionalDate(body.expectedEndDate),
  });

  return NextResponse.json(project, { status: 201 });
}
