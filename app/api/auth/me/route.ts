// GET /api/auth/me — 获取当前用户安全资料 (F2.S4)
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { findById } from '@/lib/db/auth';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 🔧 Agent 2-#6: 仅返回安全字段，不暴露 internalSource/internalId/syncAt
  const user = await findById(session.sub);
  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }
  return NextResponse.json(user);
}
