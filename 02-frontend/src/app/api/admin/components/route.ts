// GET /api/admin/components — 组件开关列表 (F5.S4/F7)
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { prisma } from '@/lib/prisma';

async function checkAdmin() {
  const session = await getSession();
  if (!session) return { error: '未登录', status: 401 };
  if (session.role !== 'admin') return { error: '需要管理员权限', status: 403 };
  return { ok: true, session };
}

export async function GET() {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const comps = await prisma.componentConfig.findMany({ orderBy: { order: 'asc' } });
  return NextResponse.json(comps);
}

export async function PATCH(request: Request) {
  const r = await checkAdmin();
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  let body: { id?: string; enabled?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: '无效的请求体' }, { status: 400 }); }
  if (!body.id || typeof body.enabled !== 'boolean') return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const comp = await prisma.componentConfig.update({
    where: { id: body.id },
    data: { enabled: body.enabled },
  });
  return NextResponse.json(comp);
}
