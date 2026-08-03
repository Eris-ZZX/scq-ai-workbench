// GET /api/stage-templates — 阶段模板列表 (F3.S2)
// 🔧 H-1(static): Added auth session check
import { NextResponse } from 'next/server';
import { getSession } from '@/platform/auth/auth.config';
import { getStageTemplates } from '@/lib/db/projects';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const templates = await getStageTemplates();
  return NextResponse.json(templates);
}
