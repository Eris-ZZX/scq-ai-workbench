export function toJsonString(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function fromJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function parseJsonForDisplay(value: unknown) {
  if (typeof value !== 'string') return value ?? {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
