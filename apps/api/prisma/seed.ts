/**
 * Demo data: `npm run db:seed` (or `npx prisma db seed`). Safe to run again: it skips what
 * already exists. Add `-- --many` to also make a board with 10,000 cards (search speed check).
 *
 * Accounts (password Test1234): owner@demo.taskkit, admin@demo.taskkit, member@demo.taskkit,
 * viewer@demo.taskkit.
 */
import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const DAY = 24 * 60 * 60 * 1000;

async function user(name: string, email: string, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    create: { name, email, passwordHash, emailVerifiedAt: new Date() },
    update: {},
  });
}

async function main() {
  const passwordHash = await argon2.hash('Test1234');
  const owner = await user('Olivia Owner', 'owner@demo.taskkit', passwordHash);
  const admin = await user('Adam Admin', 'admin@demo.taskkit', passwordHash);
  const member = await user('Maya Member', 'member@demo.taskkit', passwordHash);
  const viewer = await user('Victor Viewer', 'viewer@demo.taskkit', passwordHash);

  let workspace = await prisma.workspace.findFirst({ where: { name: 'Demo workspace', createdById: owner.id } });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: 'Demo workspace',
        description: 'Seeded demo data',
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

    const board = await prisma.board.create({
      data: {
        workspaceId: workspace.id,
        name: 'Website',
        color: '#12936A',
        createdById: owner.id,
        members: { create: { userId: admin.id, role: 'ADMIN' } },
      },
    });
    const [backend, frontend, bug, design] = await Promise.all(
      [
        ['Backend', '#2F5BEA'],
        ['Frontend', '#12936A'],
        ['Bug', '#B42335'],
        ['Design', '#E8833A'],
      ].map(([name, color]) => prisma.label.create({ data: { boardId: board.id, name, color } })),
    );
    const lists = await Promise.all(
      ['To do', 'Doing', 'QA', 'Done'].map((name, i) =>
        prisma.list.create({ data: { boardId: board.id, name, position: (i + 1) * 1000 } }),
      ),
    );
    const cards: [number, string, string | null, number | null, string[], string[]][] = [
      [0, 'Login API returns 500 on wrong password', 'Wrong password crashes the login endpoint.', -1, [backend.id, bug.id], [member.id]],
      [0, 'Push notification settings screen', null, null, [design.id], [admin.id]],
      [1, 'Drag and drop', 'Cards move within and across lists.', 5, [frontend.id], [member.id]],
      [1, 'Invite flow', 'Admins invite people by email with a role.', 1, [backend.id, frontend.id], [owner.id, member.id]],
      [2, 'Realtime board updates', null, 2, [design.id], [admin.id]],
      [3, 'Sign up and login', null, null, [], [owner.id]],
    ];
    for (const [i, [listIndex, title, description, dueInDays, labelIds, assigneeIds]] of cards.entries()) {
      await prisma.card.create({
        data: {
          listId: lists[listIndex].id,
          title,
          description,
          dueAt: dueInDays === null ? null : new Date(Date.now() + dueInDays * DAY),
          position: (i + 1) * 1000,
          createdById: owner.id,
          labels: { create: labelIds.map((labelId) => ({ labelId })) },
          assignees: { create: assigneeIds.map((userId) => ({ userId })) },
          checklistItems:
            title === 'Invite flow'
              ? {
                  create: ['Invitations table with expiry', 'Send invite endpoint', 'Accept invite deep link'].map(
                    (text, n) => ({ text, done: n < 2, position: (n + 1) * 1000 }),
                  ),
                }
              : undefined,
        },
      });
    }

    // A private board: only the Owner, the Admin and the Viewer (as a board Viewer) see it.
    const roadmap = await prisma.board.create({
      data: {
        workspaceId: workspace.id,
        name: 'Roadmap',
        color: '#7B61FF',
        visibility: 'PRIVATE',
        createdById: owner.id,
        members: { create: [{ userId: admin.id, role: 'ADMIN' }, { userId: viewer.id, role: 'VIEWER' }] },
      },
    });
    const plans = await prisma.list.create({ data: { boardId: roadmap.id, name: 'Next quarter', position: 1000 } });
    await prisma.card.create({
      data: { listId: plans.id, title: 'Offline mode', position: 1000, createdById: owner.id },
    });
    console.log('Seeded Demo workspace (Website and Roadmap boards).');
  } else {
    console.log('Demo workspace already exists: nothing to add.');
  }

  if (process.argv.includes('--many')) {
    const existing = await prisma.board.findFirst({ where: { workspaceId: workspace.id, name: 'Load test' } });
    if (existing) {
      console.log('Load test board already exists.');
    } else {
      const board = await prisma.board.create({
        data: { workspaceId: workspace.id, name: 'Load test', createdById: owner.id },
      });
      const words = ['login', 'invite', 'search', 'board', 'card', 'drag', 'push', 'email', 'offline', 'label'];
      for (let l = 0; l < 20; l++) {
        const list = await prisma.list.create({ data: { boardId: board.id, name: `List ${l + 1}`, position: (l + 1) * 1000 } });
        await prisma.card.createMany({
          data: Array.from({ length: 500 }, (_, c) => ({
            listId: list.id,
            title: `${words[(l + c) % words.length]} task ${l * 500 + c + 1}`,
            description: `Seeded card about ${words[(c * 7) % words.length]} and ${words[(c * 3) % words.length]}.`,
            position: (c + 1) * 1000,
            createdById: owner.id,
          })),
        });
      }
      console.log('Seeded Load test board with 10,000 cards.');
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
