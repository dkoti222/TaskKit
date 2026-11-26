// npm run test:db:reset — recreates the test database from the migrations.
// Reads DATABASE_URL from .env.test (or the environment in CI) and refuses anything not *_test.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { config } from 'dotenv';

if (existsSync('.env.test')) config({ path: '.env.test', override: true });

const url = process.env.DATABASE_URL;
const db = url ? new URL(url).pathname.slice(1) : '';
if (!db.endsWith('_test')) {
  console.error(`Refusing to reset "${db || '(no DATABASE_URL)'}": it must be a *_test database.`);
  process.exit(1);
}

const result = spawnSync('npx', ['prisma', 'migrate', 'reset', '--force'], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(result.status ?? 1);
