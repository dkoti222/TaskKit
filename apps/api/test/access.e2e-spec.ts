import { createTestApp, seedTeam, type TestApp } from './helpers';

type Team = Awaited<ReturnType<typeof seedTeam>>;

describe('Workspace and board access (e2e)', () => {
  let t: TestApp;
  let team: Team;

  beforeAll(async () => {
    t = await createTestApp();
    team = await seedTeam(t);
  });
  afterAll(async () => {
    await t.close();
  });

  describe('workspace role rules', () => {
    it('members see the workspace; outsiders get 404', async () => {
      for (const u of [team.owner, team.admin, team.member, team.viewer]) {
        await t.api().get(`/api/v1/workspaces/${team.workspace.id}`).set(u.auth).expect(200);
      }
      await t.api().get(`/api/v1/workspaces/${team.workspace.id}`).set(team.outsider.auth).expect(404);
    });

    it('only Owner and Admin can invite; only the Owner can invite an Admin', async () => {
      const path = `/api/v1/workspaces/${team.workspace.id}/invitations`;
      await t.api().post(path).set(team.member.auth).send({ email: 'a@e2e.test', role: 'MEMBER' }).expect(403);
      await t.api().post(path).set(team.viewer.auth).send({ email: 'a@e2e.test', role: 'MEMBER' }).expect(403);
      await t.api().post(path).set(team.admin.auth).send({ email: 'b@e2e.test', role: 'ADMIN' }).expect(403);
      await t.api().post(path).set(team.admin.auth).send({ email: 'b@e2e.test', role: 'MEMBER' }).expect(201);
      await t.api().post(path).set(team.owner.auth).send({ email: 'c@e2e.test', role: 'ADMIN' }).expect(201);
    });

    it('nobody can change or remove the Owner, and Admins cannot promote to Admin', async () => {
      const members = `/api/v1/workspaces/${team.workspace.id}/members`;
      await t.api().delete(`${members}/${team.owner.id}`).set(team.admin.auth).expect(403);
      await t.api().patch(`${members}/${team.member.id}`).set(team.admin.auth).send({ role: 'ADMIN' }).expect(403);
      await t.api().patch(`${members}/${team.member.id}`).set(team.admin.auth).send({ role: 'MEMBER' }).expect(200);
    });

    it('a Viewer cannot create boards', async () => {
      const path = `/api/v1/workspaces/${team.workspace.id}/boards`;
      await t.api().post(path).set(team.viewer.auth).send({ name: 'Nope' }).expect(403);
      await t.api().post(path).set(team.member.auth).send({ name: 'Mine' }).expect(201);
    });
  });

  describe('effective board role', () => {
    const roleOn = async (boardId: string, auth: Record<string, string>) => {
      const res = await t.api().get(`/api/v1/boards/${boardId}`).set(auth);
      return res.status === 200 ? res.body.role : res.status;
    };

    it('WORKSPACE board: everyone in the workspace, with their workspace role', async () => {
      expect(await roleOn(team.open.id, team.owner.auth)).toBe('OWNER');
      expect(await roleOn(team.open.id, team.admin.auth)).toBe('ADMIN');
      expect(await roleOn(team.open.id, team.member.auth)).toBe('MEMBER');
      expect(await roleOn(team.open.id, team.viewer.auth)).toBe('VIEWER');
      expect(await roleOn(team.open.id, team.outsider.auth)).toBe(404);
    });

    it('PRIVATE board: the Owner and people added (with their board role); others 404', async () => {
      expect(await roleOn(team.secret.id, team.owner.auth)).toBe('OWNER');
      expect(await roleOn(team.secret.id, team.member.auth)).toBe('VIEWER'); // added as Viewer
      expect(await roleOn(team.secret.id, team.admin.auth)).toBe(404); // workspace Admin, not added
      expect(await roleOn(team.secret.id, team.viewer.auth)).toBe(404);
      expect(await roleOn(team.secret.id, team.outsider.auth)).toBe(404);
    });

    it('roles decide what you can change', async () => {
      const lists = `/api/v1/boards/${team.open.id}/lists`;
      await t.api().post(lists).set(team.viewer.auth).send({ name: 'V' }).expect(403);
      await t.api().post(lists).set(team.member.auth).send({ name: 'M' }).expect(201);
      // The member is only a Viewer on the private board.
      await t.api().post(`/api/v1/boards/${team.secret.id}/lists`).set(team.member.auth).send({ name: 'M' }).expect(403);
      // Board settings: Owner and Admin only.
      await t.api().patch(`/api/v1/boards/${team.open.id}`).set(team.member.auth).send({ name: 'X' }).expect(403);
      await t.api().patch(`/api/v1/boards/${team.open.id}`).set(team.admin.auth).send({ name: 'Open board' }).expect(200);
      // Cards on a board you can't see are 404, not 403.
      await t.api().get(`/api/v1/cards/${team.secretCard.id}`).set(team.admin.auth).expect(404);
    });

    it('making a board private removes access for people not added to it', async () => {
      const board = await t.api().post(`/api/v1/workspaces/${team.workspace.id}/boards`).set(team.owner.auth).send({ name: 'Soon private' }).expect(201);
      await t.api().get(`/api/v1/boards/${board.body.id}`).set(team.viewer.auth).expect(200);
      await t.api().patch(`/api/v1/boards/${board.body.id}`).set(team.owner.auth).send({ visibility: 'PRIVATE' }).expect(200);
      await t.api().get(`/api/v1/boards/${board.body.id}`).set(team.viewer.auth).expect(404);
    });
  });
});
