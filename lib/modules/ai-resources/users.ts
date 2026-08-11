import { db } from '@/lib/database';
import { AiResourceError } from './errors';

export type AiResourceUserOption = {
  id: string;
  username: string;
  displayName: string | null;
};

export async function listActiveAiResourceUsers(): Promise<AiResourceUserOption[]> {
  return db.user.findMany({
    where: { status: 'active' },
    select: { id: true, username: true, displayName: true },
    orderBy: { username: 'asc' },
  });
}

export async function resolveActiveAiResourceUser(userId: string): Promise<AiResourceUserOption> {
  const user = await db.user.findFirst({
    where: { id: userId, status: 'active' },
    select: { id: true, username: true, displayName: true },
  });
  if (!user) {
    throw new AiResourceError('负责人不存在或已停用。', 400, 'INVALID_OWNER');
  }
  return user;
}
