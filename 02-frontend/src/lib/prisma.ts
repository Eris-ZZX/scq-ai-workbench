import { PrismaClient } from '@/generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'node:path';
import fs from 'node:fs';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const cwd = process.cwd();
  const candidates = [cwd, path.resolve(cwd, '..'), path.resolve(cwd, '..', '..')];
  let dbFile = path.join(cwd, 'dev.db');
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'dev.db'))) {
      dbFile = path.join(dir, 'dev.db');
      break;
    }
  }
  const dbUrl = `file:${dbFile}`;
  // PrismaLibSql 接受 { url } 配置，内部自己创建 client，不是接受 pre-made client
  const adapter = new PrismaLibSql({ url: dbUrl });
  return new PrismaClient({ adapter } as never);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    await prisma.$disconnect();
  });
}
