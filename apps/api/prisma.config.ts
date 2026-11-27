import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // `npx prisma db seed` (also run by `prisma migrate reset`): demo data, see prisma/seed.ts.
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});