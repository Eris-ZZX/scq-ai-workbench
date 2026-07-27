import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { extractStoredFileName, hashBuffer, type FileManifestEntry } from './shared';
import type { SourceSnapshot } from './source';

function collectAttachmentFileNames(snapshot: SourceSnapshot): Set<string> {
  const names = new Set<string>();
  for (const resource of snapshot.resources) {
    if (!resource.attachments) continue;
    try {
      const parsed = JSON.parse(resource.attachments) as Array<{ url?: string }>;
      if (!Array.isArray(parsed)) continue;
      for (const item of parsed) {
        if (!item?.url) continue;
        const stored = extractStoredFileName(item.url);
        if (stored) names.add(stored);
      }
    } catch {
      // ignore malformed attachment JSON
    }
  }
  return names;
}

export async function promoteAttachmentFiles(
  snapshot: SourceSnapshot,
  sourceStoragePath: string,
  targetUploadsDir: string,
): Promise<{ manifest: FileManifestEntry[]; created: number; reused: number }> {
  const fileNames = collectAttachmentFileNames(snapshot);
  await fsPromises.mkdir(targetUploadsDir, { recursive: true });

  const manifest: FileManifestEntry[] = [];
  let created = 0;
  let reused = 0;

  for (const fileName of fileNames) {
    const sourcePath = path.join(sourceStoragePath, fileName);
    const targetPath = path.join(targetUploadsDir, fileName);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source attachment missing: ${sourcePath}`);
    }

    const sourceBytes = await fsPromises.readFile(sourcePath);
    const sourceHash = hashBuffer(sourceBytes);

    if (fs.existsSync(targetPath)) {
      const targetBytes = await fsPromises.readFile(targetPath);
      const targetHash = hashBuffer(targetBytes);
      if (targetHash !== sourceHash) {
        throw new Error(
          `Attachment hash conflict at ${targetPath}: existing ${targetHash} vs source ${sourceHash}`,
        );
      }
      manifest.push({
        action: 'REUSED',
        sourceHash,
        targetPath,
        targetHash,
      });
      reused += 1;
      continue;
    }

    await fsPromises.copyFile(sourcePath, targetPath);
    manifest.push({
      action: 'CREATED',
      sourceHash,
      targetPath,
      targetHash: sourceHash,
    });
    created += 1;
  }

  return { manifest, created, reused };
}

export async function rollbackCreatedFiles(manifest: FileManifestEntry[]) {
  for (const entry of manifest) {
    if (entry.action !== 'CREATED') continue;
    try {
      await fsPromises.unlink(entry.targetPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
