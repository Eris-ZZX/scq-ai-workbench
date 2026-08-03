export function isSafeStoredFileName(name: string) {
  return Boolean(name) && !name.includes('..') && !name.includes('/') && !name.includes('\\');
}
