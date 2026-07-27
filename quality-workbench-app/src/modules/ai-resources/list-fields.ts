export function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeList(value: unknown): string {
  return parseList(value).join(',');
}

export function listHas(value: unknown, item: string) {
  return parseList(value).includes(item);
}

export function listHasSome(value: unknown, items: unknown) {
  const left = parseList(value);
  const right = parseList(items);
  return right.some((item) => left.includes(item));
}
