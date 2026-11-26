import { createTestApp, seedTeam, type TestApp } from './helpers';

type Team = Awaited<ReturnType<typeof seedTeam>>;

describe('Cards: move and comments (e2e)', () => {
  let t: TestApp;
  let team: Team;

  beforeAll(async () => {
    t = await createTestApp();
    team = await seedTeam(t);
  });
  afterAll(async () => {
    await t.close();
  });

  describe('move', () => {
    it('moves a card to another list and bumps its version', async () => {
      const res = await t.api()
        .patch(`/api/v1/cards/${team.card.id}/move`)
        .set(team.member.auth)
        .send({ listId: team.done.id, index: 0, version: 1 })
        .expect(200);
      expect(res.body).toEqual(expect.objectContaining({ listId: team.done.id, version: 2 }));
    });

    it('409 when the version is stale (someone else changed the card first)', async () => {
      const res = await t.api()
        .patch(`/api/v1/cards/${team.card.id}/move`)
        .set(team.admin.auth)
        .send({ listId: team.todo.id, index: 0, version: 1 })
        .expect(409);
      expect(res.body.message).toMatch(/changed by someone else/);
      const card = await t.prisma.card.findUniqueOrThrow({ where: { id: team.card.id } });
      expect(card.listId).toBe(team.done.id); // unchanged
    });

    it('a Viewer cannot move cards; a list on another board is refused', async () => {
      await t.api().patch(`/api/v1/cards/${team.card.id}/move`).set(team.viewer.auth).send({ listId: team.todo.id, index: 0, version: 2 }).expect(403);
      await t.api().patch(`/api/v1/cards/${team.card.id}/move`).set(team.owner.auth).send({ listId: team.secretList.id, index: 0, version: 2 }).expect(400);
    });

    it('keeps the order when cards are dropped between others', async () => {
      const make = (title: string, position: number) =>
        t.prisma.card.create({ data: { listId: team.todo.id, title, position, createdById: team.owner.id } });
      const a = await make('A', 1000);
      await make('B', 2000);
      await make('C', 3000);
      await t.api().patch(`/api/v1/cards/${a.id}/move`).set(team.owner.auth).send({ listId: team.todo.id, index: 2, version: 1 }).expect(200);
      const order = (await t.prisma.card.findMany({ where: { listId: team.todo.id, archivedAt: null }, orderBy: { position: 'asc' } })).map((c) => c.title);
      expect(order).toEqual(['B', 'C', 'A']);
    });
  });

  describe('comments', () => {
    let commentId: string;

    it('Members comment; Viewers cannot', async () => {
      await t.api().post(`/api/v1/cards/${team.card.id}/comments`).set(team.viewer.auth).send({ body: 'hi' }).expect(403);
      const res = await t.api()
        .post(`/api/v1/cards/${team.card.id}/comments`)
        .set(team.member.auth)
        .send({ body: `@[${team.admin.id}] can you check?` })
        .expect(201);
      commentId = res.body.id;
      expect(res.body.mentions).toEqual([{ id: team.admin.id, name: 'Admin' }]);
    });

    it('anyone with access can read them; outsiders get 404', async () => {
      const res = await t.api().get(`/api/v1/cards/${team.card.id}/comments`).set(team.viewer.auth).expect(200);
      expect(res.body.items.map((c: { id: string }) => c.id)).toContain(commentId);
      await t.api().get(`/api/v1/cards/${team.card.id}/comments`).set(team.outsider.auth).expect(404);
    });

    it('only the author edits; author or board Owner/Admin deletes', async () => {
      await t.api().patch(`/api/v1/comments/${commentId}`).set(team.owner.auth).send({ body: 'x' }).expect(403);
      await t.api().patch(`/api/v1/comments/${commentId}`).set(team.member.auth).send({ body: 'edited' }).expect(200);
      await t.api().delete(`/api/v1/comments/${commentId}`).set(team.viewer.auth).expect(403);
      await t.api().delete(`/api/v1/comments/${commentId}`).set(team.admin.auth).expect(200);
      await t.api().delete(`/api/v1/comments/${commentId}`).set(team.admin.auth).expect(404);
    });

    it('the card timeline shows the comment as deleted', async () => {
      // Activity rows are written by a listener right after the request.
      await new Promise((r) => setTimeout(r, 200));
      const res = await t.api().get(`/api/v1/cards/${team.card.id}/activity`).set(team.viewer.auth).expect(200);
      const entry = res.body.items.find((a: { type: string }) => a.type === 'comment.created');
      expect(entry.comment).toEqual(expect.objectContaining({ id: commentId, deleted: true, body: '' }));
    });
  });
});
