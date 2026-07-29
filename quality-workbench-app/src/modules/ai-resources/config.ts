/**
 * AI resource library helpers.
 * The module is always part of the product surface (no feature flag).
 * Server-only: do not import from client components.
 */

/** PostgreSQL row locks (FOR SHARE / FOR UPDATE). Local SQLite skips locks. */
export function supportsAiResourceRowLocks() {
  const url = process.env.DATABASE_URL ?? '';
  return (
    process.env.AI_RESOURCES_ROW_LOCKS === 'true' ||
    url.startsWith('postgres://') ||
    url.startsWith('postgresql://')
  );
}
