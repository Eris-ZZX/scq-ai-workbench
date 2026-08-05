import { NextRequest, NextResponse } from 'next/server';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceRoleApi } from '@/modules/ai-resources/guards';
import { getAiResourceDashboard } from '@/modules/ai-resources/dashboard';

export async function GET(request: NextRequest) {
  try {
    await requireAiResourceRoleApi('admin');
    const params = request.nextUrl.searchParams;
    const rawDays = params.get('days');
    const days = rawDays === 'all' ? 'all' : Number(rawDays ?? 30);
    return NextResponse.json(await getAiResourceDashboard({
      days,
      start: params.get('start') ?? undefined,
      end: params.get('end') ?? undefined,
    }));
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
