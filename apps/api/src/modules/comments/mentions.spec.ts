import { mentionTokenIds, parseMentions } from './mentions';

const RAVI = '11111111-1111-4111-8111-111111111111';
const SANA_A = '22222222-2222-4222-8222-222222222222';
const SANA_I = '33333333-3333-4333-8333-333333333333';
const people = [
  { id: RAVI, name: 'Ravi Kumar' },
  { id: SANA_A, name: 'Sana Ahmed' },
  { id: SANA_I, name: 'Sana Iyer' },
];

describe('parseMentions', () => {
  it('finds @[userId] tokens for people with access', () => {
    expect(parseMentions(`hi @[${RAVI}]`, people)).toEqual([RAVI]);
  });

  it('ignores @[userId] tokens for people without access', () => {
    expect(parseMentions('hi @[99999999-9999-4999-8999-999999999999]', people)).toEqual([]);
  });

  it('matches a typed full name, case-insensitive', () => {
    expect(parseMentions('thanks @ravi kumar!', people)).toEqual([RAVI]);
  });

  it('matches a unique first name', () => {
    expect(parseMentions('@Ravi can you check?', people)).toEqual([RAVI]);
  });

  it('does not match an ambiguous first name, but does match the full name', () => {
    expect(parseMentions('@Sana please', people)).toEqual([]);
    expect(parseMentions('@Sana Iyer please', people)).toEqual([SANA_I]);
  });

  it('needs the name to end there ("@Ravish" is not "@Ravi")', () => {
    expect(parseMentions('@Ravish', people)).toEqual([]);
    expect(parseMentions('(@Ravi)', people)).toEqual([RAVI]);
  });

  it('lists each person once', () => {
    expect(parseMentions(`@Ravi @[${RAVI}] @Ravi Kumar`, people)).toEqual([RAVI]);
  });

  it('is not confused by regex characters in names', () => {
    const odd = [{ id: RAVI, name: 'R. (Ravi) K+' }];
    expect(parseMentions('@R. (Ravi) K+ hello', odd)).toEqual([RAVI]);
    expect(parseMentions('@Rx (Ravi) K+', odd)).toEqual([]);
  });

  it('finds nothing in plain text or emails', () => {
    expect(parseMentions('no mentions here', people)).toEqual([]);
    expect(parseMentions('mail ravi@company.com', people)).toEqual([]);
  });
});

describe('mentionTokenIds', () => {
  it('returns the ids in @[…] tokens, lower-cased', () => {
    expect(mentionTokenIds(`@[${RAVI.toUpperCase()}] and @[${SANA_A}]`)).toEqual([RAVI, SANA_A]);
  });
});
