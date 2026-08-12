import { randomUUID } from 'node:crypto';
import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Short-lived, single-use handoff codes for launching independently deployed
 * platform applications. The plaintext code is never persisted.
 */
export const PlatformLaunchToken = pgTable('platform_launch_tokens', {
  id: text('id').notNull().primaryKey().$defaultFn(() => randomUUID()),
  appId: text('app_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  subjectUserId: text('subject_user_id').notNull(),
  expiresAt: timestamp('expires_at', { precision: 3, withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { precision: 3, withTimezone: true }),
  createdAt: timestamp('created_at', { precision: 3, withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenHashUnique: uniqueIndex('platform_launch_tokens_token_hash_key').on(table.tokenHash),
  appExpiresIdx: index('platform_launch_tokens_app_expires_idx').on(table.appId, table.expiresAt),
  subjectUserIdx: index('platform_launch_tokens_subject_user_id_idx').on(table.subjectUserId),
}));
