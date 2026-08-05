import { NextRequest, NextResponse } from 'next/server';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceRoleApi } from '@/modules/ai-resources/guards';
import { getAiResourceDashboard } from '@/modules/ai-resources/dashboard';

export async function GET(request: NextRequest) {
  try {
    await requireAiResourceRoleApi('admin');
    const rawDays = Number(new URL(request.url).searchParams.get('days') ?? 30);
    return NextResponse.json(await getAiResourceDashboard(rawDays));
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
