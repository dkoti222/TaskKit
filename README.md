# TaskKit

[![CI](https://github.com/dkoti222/TaskKit/actions/workflows/ci.yml/badge.svg)](https://github.com/dkoti222/TaskKit/actions/workflows/ci.yml)

A Trello-style team task app with role-based access (Owner, Admin, Member, Viewer).

- `apps/api`: NestJS + Prisma + PostgreSQL, Socket.IO, BullMQ (Redis)
- `apps/mobile`: Expo (React Native) with Expo Router
- `docs/`: build plan, permissions, Postman collections and learning notes per step

## Run it locally

API (needs PostgreSQL; Redis for notifications):

```sh
cd apps/api
cp .env.example .env        # fill in DATABASE_URL and secrets
npm install
npx prisma migrate deploy
npm run start:dev           # http://localhost:3000/api/v1, docs at /api/docs
```

Without Redis, set `NOTIFICATIONS_ENABLED="false"` in `.env`; everything else works.

Mobile:

```sh
cd apps/mobile
cp .env.example .env        # EXPO_PUBLIC_API_URL=http://<your-mac-ip>:3000/api/v1
npm install
npx expo start
```

## Tests

```sh
cd apps/api
npm test                    # unit tests
cp .env.test.example .env.test   # point DATABASE_URL at a *_test database
npm run test:db:reset       # create/reset the test database from the migrations
npm run test:e2e            # end-to-end tests (empties the test database)
npm run test:cov            # unit tests with coverage

cd ../mobile
npm test                    # Jest (jest-expo) + React Native Testing Library
```

CI (`.github/workflows/ci.yml`) runs all of this on every push and on pull requests to `dev` and `main`.
