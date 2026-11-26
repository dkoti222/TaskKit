import { createTestApp, seedTeam, type TestApp } from './helpers';

type Team = Awaited<ReturnType<typeof seedTeam>>;

describe('Search (e2e)', () => {
  let t: TestApp;
  let team: Team;
  const titles = (body: { items: { title: string }[] }) => body.items.map((i) => i.title);

  beforeAll(async () => {
    t = await createTestApp();
    team = await seedTeam(t);
  });
  afterAll(async () => {
    await t.close();
  });

  const search = (auth: Record<string, string>, qs: string) =>
    t.api().get(`/api/v1/workspaces/${team.workspace.id}/search?${qs}`).set(auth);

  it('finds cards by words in the title and description, with highlights', async () => {
    const res = await search(team.admin.auth, 'q=login').expect(200);
    expect(titles(res.body)).toEqual(['Login API returns 500']);
    expect(res.body.items[0].titleParts[0]).toEqual({ text: 'Login', match: true });
    const byDescription = await search(team.admin.auth, 'q=crashes').expect(200);
    expect(byDescription.body.items[0].snippetParts.some((p: { match: boolean }) => p.match)).toBe(true);
  });

  it('never returns cards from private boards you are not on', async () => {
    for (const u of [team.admin, team.viewer]) {
      const res = await search(u.auth, 'q=login').expect(200);
      expect(titles(res.body)).not.toContain('Secret login redesign');
      const short = await search(u.auth, 'q=se').expect(200);
      expect(titles(short.body)).not.toContain('Secret login redesign');
      const byId = await search(u.auth, `q=secret&boardId=${team.secret.id}`).expect(200);
      expect(byId.body.items).toEqual([]);
    }
  });

  it('includes them for people who can see the board', async () => {
    expect(titles((await search(team.owner.auth, 'q=secret').expect(200)).body)).toContain('Secret login redesign');
    // The member was added to the private board (as a Viewer).
    expect(titles((await search(team.member.auth, 'q=secret').expect(200)).body)).toContain('Secret login redesign');
  });

  it('outsiders get 404; nonsense input is just text', async () => {
    await search(team.outsider.auth, 'q=login').expect(404);
    const res = await search(team.admin.auth, `q=${encodeURIComponent("login'; DROP TABLE cards; --")}`).expect(200);
    expect(res.body.items).toEqual([]);
    expect(await t.prisma.card.count()).toBeGreaterThan(0);
  });

  it('needs a query or a filter', async () => {
    await search(team.admin.auth, '').expect(400);
  });
});
