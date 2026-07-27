import { prisma } from '../src/lib/prisma';

async function main() {
  const [resources, logs, memberships, reviews, favorites, admins, runs] = await Promise.all([
    prisma.aiResource.count(),
    prisma.aiResourceUpdateLog.count(),
    prisma.aiResourceMembership.count(),
    prisma.aiResourceReviewRequest.count(),
    prisma.aiResourceFavorite.count(),
    prisma.aiResourceMembership.count({
      where: { role: 'admin', user: { status: 'active' } },
    }),
    prisma.aiResourceMigrationRun.findMany({
      select: { id: true, status: true, startedAt: true },
      orderBy: { startedAt: 'desc' },
      take: 3,
    }),
  ]);

  console.log(
    JSON.stringify(
      { resources, logs, memberships, reviews, favorites, effectiveAdmins: admins, runs },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
