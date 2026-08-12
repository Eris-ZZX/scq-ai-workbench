import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Runtime connection settings for independently deployed platform
 * applications. Secrets are stored encrypted; plaintext is never persisted.
 */
export const PlatformExternalAppConnection = pgTable('platform_external_app_connections', {
  appId: text('app_id').notNull().primaryKey(),
  displayName: text('display_name').notNull(),
  launchUrl: text('launch_url').notNull().default(''),
  note: text('note').notNull().default(''),
  exchangeSecretCiphertext: text('exchange_secret_ciphertext').notNull().default(''),
  enabled: boolean('enabled').notNull().default(true),
  updatedByUserId: text('updated_by_user_id'),
  createdAt: timestamp('created_at', { precision: 3, withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => ({
  enabledIdx: index('platform_external_app_connections_enabled_idx').on(table.enabled),
  updatedByIdx: index('platform_external_app_connections_updated_by_idx').on(table.updatedByUserId),
}));

export type PlatformExternalAppConnectionInsert =
  typeof PlatformExternalAppConnection.$inferInsert;
