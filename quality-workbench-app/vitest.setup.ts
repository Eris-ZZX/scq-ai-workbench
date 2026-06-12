import path from 'node:path';

// PrismaClient v7 with libsql adapter still validates DATABASE_URL exists
process.env.DATABASE_URL = `file:${path.resolve(process.cwd(), 'dev.db')}`;
