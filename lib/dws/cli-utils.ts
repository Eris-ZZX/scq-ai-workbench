export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function stringValue(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

export function firstRecordArray(value: unknown, keys: string[]) {
  const record = asRecord(value);
  for (const key of keys) {
    const candidate = asArray(record[key]);
    if (candidate.length) return candidate.map(asRecord);
  }
  return asArray(value).map(asRecord);
}
