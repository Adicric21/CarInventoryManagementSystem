import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

loadDotenv({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const databaseUrl = process.env['DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/scripts/seed-admin.ts',
  },
  ...(databaseUrl === undefined ? {} : { datasource: { url: databaseUrl } }),
});
