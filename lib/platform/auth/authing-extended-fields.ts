/** Authing extended_fields helpers for platform user directory fields. */

export function parseAuthingExtendedFields(
  value: string | null | undefined,
): Record<string, unknown> | null {
  if (!value?.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function readAuthingExtendedString(
  extendedFields: string | null | undefined,
  key: string,
): string | null {
  const parsed = parseAuthingExtendedFields(extendedFields);
  const value = parsed?.[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export type AuthingSupervisorMatch = {
  id: string;
  displayName: string | null;
  username: string;
  empOriginId: string;
};

/**
 * Build emp_origin_id -> user map from candidates, then resolve leaders by emp_leader_origin_id.
 */
export function matchAuthingSupervisor(
  leaderOriginId: string | null,
  originIndex: Map<string, AuthingSupervisorMatch>,
): AuthingSupervisorMatch | null {
  if (!leaderOriginId) return null;
  return originIndex.get(leaderOriginId) ?? null;
}

export function buildEmpOriginIndex(
  users: Array<{
    id: string;
    username: string;
    displayName: string | null;
    extendedFields: string | null;
  }>,
): Map<string, AuthingSupervisorMatch> {
  const index = new Map<string, AuthingSupervisorMatch>();
  for (const user of users) {
    const empOriginId = readAuthingExtendedString(user.extendedFields, 'emp_origin_id');
    if (!empOriginId || index.has(empOriginId)) continue;
    index.set(empOriginId, {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      empOriginId,
    });
  }
  return index;
}
