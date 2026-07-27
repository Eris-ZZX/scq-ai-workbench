import type { Prisma } from '@/generated/prisma/client';
import { serializeList } from '@/modules/ai-resources/list-fields';
import { toJsonString } from '@/modules/ai-resources/json';

export function toDbResourceData(value: Record<string, unknown>) {
  return {
    ...value,
    tags: serializeList(value.tags),
    visibleDeptIds: serializeList(value.visibleDeptIds),
    visibleUserIds: serializeList(value.visibleUserIds),
    attachments: value.attachments == null ? null : toJsonString(value.attachments),
    extension: value.extension == null ? null : toJsonString(value.extension),
    resourceUrl: (value.resourceUrl as string | null) || null,
  } as Omit<Prisma.AiResourceUncheckedCreateInput, 'createdById' | 'id'>;
}
