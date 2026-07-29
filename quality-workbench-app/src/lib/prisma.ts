import 'dotenv/config';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const PRISMA_CLIENT_REVISION = 5;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaRevision?: number;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }
  if (!connectionString.startsWith('postgres://') && !connectionString.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string');
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter } as never);
}

function isCompatibleClient(client: PrismaClient) {
  const c = client as {
    aiResourceLike?: { findMany?: unknown };
    aiResourceFavoriteTag?: { findMany?: unknown };
  };
  return (
    typeof c.aiResourceLike?.findMany === 'function' &&
    typeof c.aiResourceFavoriteTag?.findMany === 'function'
  );
}

function getPrismaClient() {
  const existing = globalForPrisma.prisma;
  if (
    existing &&
    globalForPrisma.prismaRevision === PRISMA_CLIENT_REVISION &&
    isCompatibleClient(existing)
  ) {
    return existing;
  }

  if (existing) {
    void existing.$disconnect().catch(() => undefined);
  }

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaRevision = PRISMA_CLIENT_REVISION;
  }
  return client;
}

export const prisma = getPrismaClient();

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    await prisma.$disconnect();
  });
}
