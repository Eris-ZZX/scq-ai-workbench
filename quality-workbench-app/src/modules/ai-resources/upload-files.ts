import { access } from 'fs/promises';
import { join } from 'path';

export function isSafeStoredFileName(name: string) {
  return Boolean(name) && !name.includes('..') && !name.includes('/') && !name.includes('\\');
}

export async function resolveAiResourceUploadPath(storedName: string) {
  const candidates = [
    join(process.cwd(), 'storage', 'ai-resources', 'uploads', storedName),
    join(process.cwd(), 'storage', 'uploads', storedName),
    join(process.cwd(), 'public', 'uploads', storedName),
  ];

  for (const path of candidates) {
    try {
      await access(path);
      return path;
    } catch {
      // try next
    }
  }
  return null;
}
