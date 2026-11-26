# Step 14: Testing and CI

## What was built
- **API unit tests** (`npm test`, files next to the code as `*.spec.ts`): `positionAt`, every
  effective-role case of `BoardAccessService.resolve`, refresh-token rotation and reuse detection,
  and the mention parser.
- **API e2e tests** (`npm run test:e2e`, files in `test/`): the whole app against a real test
  database. They cover the auth flow, workspace role rules, board access for Owner, Admin, Member,
  Viewer and an outsider on WORKSPACE and PRIVATE boards, card moves including the 409, comments,
  and search never leaking private boards.
- **Mobile tests** (`npm test` in apps/mobile, jest-expo + React Native Testing Library): the
  session store, the axios refresh interceptor (one shared refresh, then retry), the board cache
  after a move, and the offline/reconnecting banner.
- **CI** (`.github/workflows/ci.yml`): on every push and on pull requests to `dev` and `main`. It
  runs an API job (Postgres and Redis containers, lint, build, unit, e2e) and a mobile job (type
  check, lint, tests). The README has the status badge.

## New concepts

**Unit vs e2e tests.** A unit test checks one piece alone, with its dependencies replaced by fakes:
`BoardAccessService` gets a fake Prisma that returns whatever each case needs, so all 4 rules ×
every role run in milliseconds without a database. An e2e (end-to-end) test starts the real app
(`AppModule`, same validation and prefix as production via `src/app.setup.ts`) and sends real HTTP
requests with supertest to a real database. Unit tests show the logic is right; e2e tests show the
pieces are wired together (guards, DTOs, SQL).

**A separate test database.** e2e tests empty every table before each file (`resetDb` in
`test/helpers.ts`: `TRUNCATE … RESTART IDENTITY CASCADE`), so they must never run on your real
data. They use `taskkit_test` from `.env.test`, and `test/setup-env.ts` refuses to start unless the
database name ends in `_test`. `npm run test:db:reset` rebuilds it from the migrations
(`prisma migrate reset --force`, with the same `_test` check).

**Fakes instead of the real world.** `FakeMail` replaces `MailService`, so the auth test reads the
6-digit code the API "emailed". Tests make users and tokens directly (`makeUser` uses
`TokenService.issueTokens`) instead of logging in, so the 5-per-minute login limit isn't hit.
The notifications module is switched off in tests (`NOTIFICATIONS_ENABLED=false`, through Nest's
`ConditionalModule`), so e2e tests don't need Redis.

**Testing the refresh interceptor without a server.** axios lets you replace the code that sends
requests (an *adapter*). The mobile test installs a fake server function before `client.ts` is
loaded. It can answer 401 to three parallel requests, then check that `/auth/refresh` was called
exactly once and all three were retried with the new token.

**Why the Jest config looks unusual.** Nest 12 and `expo-server-sdk` ship ES modules, but Jest
(before Node 24.9) runs tests as CommonJS. So Jest compiles those packages too
(`transformIgnorePatterns` lets it into `node_modules/@nestjs` and `expo-server-sdk`).
`test/jest-transform.cjs` wraps ts-jest to replace `import.meta.url`, which only exists in ES
modules, in those files. On Node 24.9+ none of this would be needed.

**CI.** GitHub Actions starts a fresh Ubuntu machine for every push. The API job also gets
Postgres and Redis as *service containers*. Then it runs `npm ci` (exact versions from the lock
file), `prisma migrate deploy` (apply migrations, never reset), lint, build and both test suites.
A red ✗ on a commit or pull request means something broke. The README badge shows the latest
result on GitHub.

## Files touched and why
| File | Why |
|---|---|
| `src/**/*.spec.ts` | Unit tests |
| `test/*.e2e-spec.ts`, `test/helpers.ts`, `test/setup-env.ts` | e2e tests, app/test-data helpers, the `_test` safety check |
| `jest.config.ts`, `test/jest-e2e.json`, `test/jest-transform.cjs` | Jest setup for Nest 12's ES modules |
| `scripts/test-db-reset.mjs`, `.env.test.example`, `.gitignore` | Test database reset; `.env.test`, `uploads-test/`, `coverage/` ignored |
| `src/app.setup.ts`, `src/main.ts` | One place for prefix, CORS and validation (used by tests too) |
| `src/app.module.ts` | `NOTIFICATIONS_ENABLED` switch |
| `test/app.e2e-spec.ts` (removed) | Nest's starter test expected `GET /` → "Hello World!", which this API doesn't have |
| `apps/mobile/src/**/*.test.ts(x)`, `jest.setup.js`, `src/jest-env.d.ts`, `package.json` | Mobile tests and Jest setup |
| `.github/workflows/ci.yml`, `README.md` | CI and the badge |

## How an e2e test runs
1. `npm run test:e2e` starts Jest with `test/jest-e2e.json`, which loads `.env.test` and checks
   that the database name ends in `_test`.
2. `createTestApp()` builds the real `AppModule` with `FakeMail`, applies `configureApp`, starts
   it in memory, and empties every table.
3. `seedTeam()` writes one user per role, a WORKSPACE board and a PRIVATE board straight into the
   database, and gives each user an access token.
4. Each test sends requests (`t.api().get('/api/v1/boards/…').set(viewer.auth)`) and checks status
   codes and bodies. Some also read the database to confirm what was saved.
5. `afterAll` closes the app. The next file starts again from empty tables.
