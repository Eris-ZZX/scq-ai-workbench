import type { InferSelectModel } from 'drizzle-orm';
import type { AiResource } from './schema';

export type AiResourceRecord = InferSelectModel<typeof AiResource>;
