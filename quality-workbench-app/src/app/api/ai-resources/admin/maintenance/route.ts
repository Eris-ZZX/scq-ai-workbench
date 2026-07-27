import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatZodError } from '@/modules/ai-resources/api-errors';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceRoleApi } from '@/modules/ai-resources/guards';
import {
  getMaintenanceMode,
  setMaintenanceModeInTransaction,
} from '@/modules/ai-resources/maintenance';
import { maintenanceModeSchema } from '@/modules/ai-resources/validation';

export async function GET() {
  try {
    await requireAiResourceRoleApi('admin');
    const maintenanceMode = await getMaintenanceMode();
    return NextResponse.json({ maintenanceMode });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAiResourceRoleApi('admin');
    const payload = maintenanceModeSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: formatZodError(payload.error) }, { status: 400 });
    }

    const settings = await prisma.$transaction(async (tx) => {
      return setMaintenanceModeInTransaction(tx, payload.data.enabled);
    });

    return NextResponse.json({ maintenanceMode: settings.maintenanceMode });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
