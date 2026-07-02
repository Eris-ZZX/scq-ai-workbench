// GET/POST /api/npq/projects — 项目列表 + 创建
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { getProjectsByUser, createProject } from '@/lib/db/projects';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  // admin/manager 可查看所有项目
  if (session.role === 'admin' || session.role === 'manager') {
    return NextResponse.json(
      await prisma.project.findMany({
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, status: true, currentStage: true, startDate: true, expectedEndDate: true },
      }),
    );
  }
  const projects = await getProjectsByUser(session.sub);
  return NextResponse.json(projects);
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
