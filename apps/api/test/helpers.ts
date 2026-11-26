import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { MailService } from '../src/modules/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/modules/auth/token.service';

/** Instead of logging emails, keep them so tests can read verification codes and links. */
export class FakeMail {
  codes = new Map<string, string>();
  resets = new Map<string, string>();
  invites = new Map<string, string>();
  async sendVerificationCode(email: string, code: string) {
    this.codes.set(email, code);
  }
  async sendPasswordReset(email: string, link: string) {
    this.resets.set(email, link);
  }
  async sendInvitation(email: string, _workspace: string, link: string) {
    this.invites.set(email, link);
  }
  async sendMention() {}
}

export type TestApp = {
  app: INestApplication;
  prisma: PrismaService;
  mail: FakeMail;
  /** supertest against the running app, already under /api/v1. */
  api: () => ReturnType<typeof request>;
  close: () => Promise<void>;
};

/** The whole API (same modules and settings as production), with a fake mail service. */
export async function createTestApp(): Promise<TestApp> {
  const mail = new FakeMail();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  const prisma = app.get(PrismaService);
  await resetDb(prisma);
  return {
    app,
    prisma,
    mail,
    api: () => request(app.getHttpServer()),
    close: () => app.close(),
  };
}

/** Empties every table (fixed list from the database itself, no user input). */
export async function resetDb(prisma: PrismaService) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

let counter = 0;

/** A verified user and a valid access token for them (no login, so no rate limit). */
export async function makeUser(t: TestApp, name: string) {
  counter++;
  const user = await t.prisma.user.create({
    data: {
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}.${counter}@e2e.test`,
      passwordHash: 'not-used',
      emailVerifiedAt: new Date(),
    },
  });
  const { accessToken } = await t.app.get(TokenService).issueTokens(user);
  return { ...user, token: accessToken, auth: { Authorization: `Bearer ${accessToken}` } };
}

export type TestUser = Awaited<ReturnType<typeof makeUser>>;

/**
 * A workspace with one person per role, a WORKSPACE board and a PRIVATE board.
 * On the private board, `member` is added as a VIEWER (a board override); nobody else is added.
 * `outsider` belongs to another workspace.
 */
export async function seedTeam(t: TestApp) {
  const owner = await makeUser(t, 'Owner');
  const admin = await makeUser(t, 'Admin');
  const member = await makeUser(t, 'Member');
  const viewer = await makeUser(t, 'Viewer');
  const outsider = await makeUser(t, 'Outsider');

  const workspace = await t.prisma.workspace.create({
    data: {
      name: 'E2E workspace',
      createdById: owner.id,
      members: {
        create: [
          { userId: owner.id, role: 'OWNER' },
          { userId: admin.id, role: 'ADMIN' },
          { userId: member.id, role: 'MEMBER' },
          { userId: viewer.id, role: 'VIEWER' },
        ],
      },
    },
  });
  await t.prisma.workspace.create({
    data: { name: 'Other', createdById: outsider.id, members: { create: { userId: outsider.id, role: 'OWNER' } } },
  });

  const open = await t.prisma.board.create({
    data: { workspaceId: workspace.id, name: 'Open board', visibility: 'WORKSPACE', createdById: owner.id },
  });
  const secret = await t.prisma.board.create({
    data: {
      workspaceId: workspace.id,
      name: 'Secret board',
      visibility: 'PRIVATE',
      createdById: owner.id,
      members: { create: { userId: member.id, role: 'VIEWER' } },
    },
  });

  const todo = await t.prisma.list.create({ data: { boardId: open.id, name: 'To do', position: 1000 } });
  const done = await t.prisma.list.create({ data: { boardId: open.id, name: 'Done', position: 2000 } });
  const card = await t.prisma.card.create({
    data: { listId: todo.id, title: 'Login API returns 500', description: 'Wrong password crashes the login endpoint', position: 1000, createdById: owner.id },
  });
  const secretList = await t.prisma.list.create({ data: { boardId: secret.id, name: 'Plans', position: 1000 } });
  const secretCard = await t.prisma.card.create({
    data: { listId: secretList.id, title: 'Secret login redesign', position: 1000, createdById: owner.id },
  });

  return { owner, admin, member, viewer, outsider, workspace, open, secret, todo, done, card, secretList, secretCard };
}
