// Runs before every e2e test file: load .env.test (in CI the variables come from the workflow).
import { config } from 'dotenv';
import { existsSync } from 'fs';

if (existsSync('.env.test')) config({ path: '.env.test', override: true });

// The tests empty every table. Never let them near a real database.
const db = new URL(process.env.DATABASE_URL ?? 'postgresql://missing/none').pathname.slice(1);
if (!db.endsWith('_test')) {
  throw new Error(
    `e2e tests refuse to run on database "${db}": DATABASE_URL must point at a *_test database (see .env.test.example).`,
  );
}
