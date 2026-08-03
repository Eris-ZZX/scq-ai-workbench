import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';

export async function GET() {
  try {
    const actor = await requireAiResourceUserApi();

    return Response.json({
      enabled: true,
      actor: {
        userId: actor.userId,
        username: actor.username,
        moduleRole: actor.moduleRole,
        isEffectiveAdmin: actor.isEffectiveAdmin,
      },
    });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
