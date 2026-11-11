type Person = { id: string; name: string };

const TOKEN = /@\[([0-9a-f-]{36})\]/gi;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Who is @mentioned in a comment. Only people in `people` (those with board access) count.
 *
 * Two forms:
 * - `@[<userId>]`: what the app sends after you pick someone from the @ list.
 * - `@Name`: typed by hand. The full name matches ("@Ravi Kumar"), and so does a first name
 *   when only one person has it ("@Ravi").
 */
export function parseMentions(body: string, people: Person[]): string[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const found = new Set<string>();

  for (const match of body.matchAll(TOKEN)) {
    const id = match[1].toLowerCase();
    if (byId.has(id)) found.add(id);
  }

  const firstNameCount = new Map<string, number>();
  for (const p of people) {
    const first = p.name.split(' ')[0].toLowerCase();
    firstNameCount.set(first, (firstNameCount.get(first) ?? 0) + 1);
  }

  for (const p of people) {
    const first = p.name.split(' ')[0];
    const candidates = [p.name];
    if (firstNameCount.get(first.toLowerCase()) === 1) candidates.push(first);
    for (const name of candidates) {
      // "@Ravi" but not "@Ravish": the name must not run on into more letters.
      const pattern = new RegExp(`@${escape(name)}(?![\\p{L}\\p{N}])`, 'iu');
      if (pattern.test(body)) found.add(p.id);
    }
  }

  return [...found];
}

/** The user ids written as `@[<userId>]` tokens, to show their names. */
export function mentionTokenIds(body: string): string[] {
  return [...body.matchAll(TOKEN)].map((m) => m[1].toLowerCase());
}
