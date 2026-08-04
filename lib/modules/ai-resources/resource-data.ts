import type { InferInsertModel } from 'drizzle-orm';
import type { AiResource } from '@/db/schema';
import { serializeList } from '@/modules/ai-resources/list-fields';
import { toJsonString } from '@/modules/ai-resources/json';
import { resolveActiveAiResourceUser } from './users';

export async function withResolvedResourceOwner<
  T extends { ownerId: string; ownerName?: string; resourceUrl?: string | null },
>(value: T): Promise<T & { ownerName: string }> {
  const owner = await resolveActiveAiResourceUser(String(value.ownerId ?? ''));
  return {
    ...value,
    ownerId: owner.id,
    ownerName: owner.username,
  };
}

export function toDbResourceData(value: Record<string, unknown>) {
  return {
    ...value,
    tags: serializeList(value.tags),
    visibleDeptIds: serializeList(value.visibleDeptIds),
    visibleUserIds: serializeList(value.visibleUserIds),
    attachments: value.attachments == null ? null : toJsonString(value.attachments),
    extension: value.extension == null ? null : toJsonString(value.extension),
    resourceUrl: (value.resourceUrl as string | null) || null,
  } as Omit<InferInsertModel<typeof AiResource>, 'createdById' | 'id'>;
}
