/**
 * AI resource library feature gate.
 * Keep false until migration Run is COMPLETED (or explicit empty bootstrap).
 * Server-only: do not import from client components.
 */
export function isAiResourcesEnabled() {
  return process.env.AI_RESOURCES_ENABLED === 'true';
}

/** PostgreSQL row locks (FOR SHARE / FOR UPDATE). Local SQLite skips locks. */
export function supportsAiResourceRowLocks() {
  const url = process.env.DATABASE_URL ?? '';
  return (
    process.env.AI_RESOURCES_ROW_LOCKS === 'true' ||
    url.startsWith('postgres://') ||
    url.startsWith('postgresql://')
  );
}
