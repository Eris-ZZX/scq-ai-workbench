import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceUserApi } from '@/modules/ai-resources/guards';
import { getMaintenanceMode } from '@/modules/ai-resources/maintenance';
import { isAiResourcesEnabled } from '@/modules/ai-resources/config';

export async function GET() {
  try {
    if (!isAiResourcesEnabled()) {
      return Response.json(
        { enabled: false, error: 'AI 资源库未启用', code: 'DISABLED' },
        { status: 503 },
      );
    }

    const actor = await requireAiResourceUserApi();
    const maintenanceMode = await getMaintenanceMode();

    return Response.json({
      enabled: true,
      maintenanceMode,
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
