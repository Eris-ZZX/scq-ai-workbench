// GET/POST /api/npq/projects — 项目列表 + 创建 (F3.S1/S3)
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { getProjectsByUser, createProject } from '@/lib/db/projects';
import { canExecuteNpqAction } from '@/lib/db/npq-permissions';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const projects = await getProjectsByUser(session.sub);
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const allowed = await canExecuteNpqAction({ actionKey: 'project.create', session });
  if (!allowed) return NextResponse.json({ error: '无权创建 NPQ 项目' }, { status: 403 });

  let body: {
    name?: string;
    description?: string;
    templateId?: string;
    activityTemplateSetId?: string;
    positionAssignments?: { positionRoleId: string; userId: string }[];
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name || name.length === 0) {
    return NextResponse.json({ error: '项目名称为必填项' }, { status: 400 });
  }
  if (name.length > 200) return NextResponse.json({ error: '项目名称不超过 200 字符' }, { status: 400 });

  // 🔧 H-2: templateId为falsy时传undefined，createProject内用所有isDefault模板
  const project = await createProject({
    name,
    description: body.description?.trim(),
    ownerId: session.sub,
    templateId: body.templateId || undefined,
    activityTemplateSetId: body.activityTemplateSetId || undefined,
    positionAssignments: Array.isArray(body.positionAssignments) ? body.positionAssignments : undefined,
  });

  return NextResponse.json(project, { status: 201 });
}
