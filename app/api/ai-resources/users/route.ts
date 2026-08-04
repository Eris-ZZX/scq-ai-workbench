import { NextResponse } from 'next/server';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { listActiveAiResourceUsers } from '@/modules/ai-resources/users';

export async function GET() {
  try {
    const actor = await requireAiResourceUserApi();
    const users = await listActiveAiResourceUsers();
    return NextResponse.json({ users, currentUserId: actor.userId });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
