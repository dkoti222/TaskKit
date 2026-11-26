import type { ActivityItem } from '@/api/types';
import { firstName } from './format';
import { ROLE_LABEL } from './roles';

/** A piece of an activity sentence. `strong` parts are shown in semibold (names of things). */
export type Part = { text: string; strong?: boolean };

const FIELD_LABEL = { title: 'title', description: 'description', dueAt: 'due date' } as const;

const s = (text: string | null | undefined, fallback: string): Part => ({
  text: text || fallback,
  strong: true,
});
const t = (text: string): Part => ({ text });

/**
 * The sentence for one activity entry, after the actor's name:
 * "moved **Drag and drop** from To do to Doing".
 *
 * On the card's own timeline (`onCard`) the card is "this card" / "this".
 */
export function describeActivity(
  item: ActivityItem,
  meId: string | undefined,
  onCard = false,
): Part[] {
  const d = item.data;
  const card: Part = onCard ? t('this card') : s(d.cardTitle, 'a card');
  const it: Part = onCard ? t('this') : s(d.cardTitle, 'a card');
  const person = (id?: string, name?: string | null): Part =>
    id && id === meId ? t('you') : s(name ? firstName(name) : null, 'someone');
  const self = d.userId === item.actor.id;

  switch (item.type) {
    case 'card.created':
      return onCard
        ? [t('created this card'), ...(d.listName ? [t(' in '), t(d.listName)] : [])]
        : [t('added '), card, ...(d.listName ? [t(' to '), t(d.listName)] : [])];
    case 'card.updated': {
      const fields = (d.fields ?? []).map((f) => FIELD_LABEL[f]);
      const what = fields.length ? fields.join(' and ') : 'details';
      return [t(`changed the ${what} of `), card];
    }
    case 'card.archived':
      return [t(d.archived ? 'archived ' : 'restored '), card];
    case 'card.moved':
      return [
        t('moved '),
        it,
        t(` from ${d.fromListName ?? 'a list'} to ${d.toListName ?? 'another list'}`),
      ];
    case 'card.assignee.added':
      return self
        ? [t('joined '), card]
        : [t('added '), person(d.userId, d.userName), t(' to '), card];
    case 'card.assignee.removed':
      return self
        ? [t('left '), card]
        : [t('removed '), person(d.userId, d.userName), t(' from '), card];
    case 'card.label.added':
      return [t('added the label '), s(d.labelName, 'a label'), t(' to '), card];
    case 'card.label.removed':
      return [t('removed the label '), s(d.labelName, 'a label'), t(' from '), card];
    case 'checklist.changed': {
      const item_ = s(d.text, 'an item');
      const on = onCard ? [] : [t(' on '), card];
      switch (d.action) {
        case 'checked':
          return [t('completed '), item_, ...on];
        case 'unchecked':
          return [t('marked '), item_, t(' incomplete'), ...on];
        case 'added':
          return [t('added '), item_, t(' to the checklist'), ...on];
        case 'deleted':
          return [t('removed '), item_, t(' from the checklist'), ...on];
        default:
          return [t('edited the checklist item '), item_, ...on];
      }
    }
    case 'comment.created':
      return onCard ? [t('commented')] : [t('commented on '), card];
    case 'card.attachment.added':
      return [t('attached '), s(d.fileName, 'a file'), ...(onCard ? [] : [t(' to '), card])];
    case 'card.attachment.removed':
      return [t('removed '), s(d.fileName, 'a file'), ...(onCard ? [] : [t(' from '), card])];
    case 'list.created':
      return [t('created the list '), s(d.listName, 'a list')];
    case 'list.updated':
      return [t('renamed a list to '), s(d.listName, 'a list')];
    case 'list.archived':
      return [t(d.archived ? 'archived the list ' : 'restored the list '), s(d.listName, 'a list')];
    case 'list.moved':
      return [t('moved the list '), s(d.listName, 'a list')];
    case 'label.created':
      return [t('created the label '), s(d.labelName, 'a label')];
    case 'label.deleted':
      return [t('deleted the label '), s(d.labelName, 'a label')];
    case 'board.created':
      return [t('created the board '), s(d.boardName, 'a board')];
    case 'board.updated': {
      const c = d.changes ?? {};
      if (c.archived !== undefined)
        return [t(c.archived ? 'archived the board' : 'restored the board')];
      if (c.visibility) {
        return [
          t(
            c.visibility === 'PRIVATE'
              ? 'made the board private'
              : 'made the board visible to the workspace',
          ),
        ];
      }
      if (c.name) return [t('renamed the board to '), s(c.name, 'a new name')];
      if (c.color) return [t('changed the board color')];
      return [t('changed the board settings')];
    }
    case 'board.member.changed': {
      const who = person(d.userId, d.userName);
      if (!d.role) return [t('removed '), who, t(' from the board')];
      return [
        t('changed '),
        who.text === 'you' ? t('your') : { ...who, text: `${who.text}’s` },
        t(` board role to ${ROLE_LABEL[d.role]}`),
      ];
    }
    default:
      return [t('made a change')];
  }
}

/** "Sana" or "You", for the start of the sentence. */
export function actorName(item: ActivityItem, meId: string | undefined) {
  return item.actor.id === meId ? 'You' : firstName(item.actor.name);
}

/** The whole sentence as plain text (for accessibility labels). */
export function activitySentence(item: ActivityItem, meId: string | undefined, onCard = false) {
  return `${actorName(item, meId)} ${describeActivity(item, meId, onCard)
    .map((p) => p.text)
    .join('')}`;
}
