import 'dotenv/config';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const PRISMA_CLIENT_REVISION = 7;

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
    aiResourceComment?: { findMany?: unknown };
  };
  return (
    typeof c.aiResourceLike?.findMany === 'function' &&
    typeof c.aiResourceFavoriteTag?.findMany === 'function' &&
    typeof c.aiResourceComment?.findMany === 'function'
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
  // Cache in all environments so lazy proxy does not create a client per access.
  globalForPrisma.prisma = client;
  globalForPrisma.prismaRevision = PRISMA_CLIENT_REVISION;
  return client;
}

/**
 * Lazy Prisma accessor: import is safe during `next build` without DATABASE_URL.
 * Client is created on first property access (runtime request / seed / migrate scripts).
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    const existing = globalForPrisma.prisma;
    if (existing) {
      await existing.$disconnect();
    }
  });
}
