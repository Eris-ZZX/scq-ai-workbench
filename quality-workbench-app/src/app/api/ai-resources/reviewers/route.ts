import { NextResponse } from 'next/server';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { canAdmin } from '@/modules/ai-resources/policy';
import { listAssignableReviewers } from '@/modules/ai-resources/reviewers';

export async function GET() {
  try {
    const actor = await requireAiResourceUserApi();
    // Admins may self-assign for self-review; others cannot pick themselves.
    const reviewers = await listAssignableReviewers(canAdmin(actor) ? undefined : actor.userId);
    return NextResponse.json({ reviewers });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
