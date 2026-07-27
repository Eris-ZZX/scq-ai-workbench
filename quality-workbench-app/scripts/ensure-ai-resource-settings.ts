import { prisma } from '../src/lib/prisma';

async function main() {
  await prisma.aiResourceModuleSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', maintenanceMode: false },
    update: {},
  });
  console.log('AiResourceModuleSettings ready');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
