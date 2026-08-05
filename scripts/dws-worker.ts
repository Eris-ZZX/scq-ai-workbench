import 'dotenv/config';
import { closeDatabase } from '@/db/client';
import { runDwsWorkerLoop } from '@/lib/dws/worker';

runDwsWorkerLoop()
  .catch((error) => {
    console.error('[dws-worker] stopped:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
