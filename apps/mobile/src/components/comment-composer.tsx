import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';

import type { CardPerson, Comment } from '@/api/types';
import { commentPlainText } from '@/components/activity-ui';
import { MemberAvatar } from '@/components/workspace-ui';
import { colors, fonts, radius, spacing } from '@/theme';

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "@Ravi Kumar" for people picked from the list becomes "@[<id>]", which the API resolves. */
function toBody(text: string, picked: Map<string, string>) {
  let body = text.trim();
  const names = [...picked.keys()].sort((a, b) => b.length - a.length);
  for (const name of names) {
    body = body.replace(
      new RegExp(`@${escape(name)}(?![\\p{L}\\p{N}])`, 'gu'),
      `@[${picked.get(name)}]`,
    );
  }
  return body;
}

/**
 * "Write a comment, @ to mention" bar at the bottom of 15 · Card detail.
 * Typing @ shows matching board people; picking one inserts "@Full Name".
 * `editing` switches it to editing that comment (with a Cancel bar).
 */
export function CommentComposer({
  people,
  meId,
  editing,
  pending,
  onSubmit,
  onCancelEdit,
}: {
  people: CardPerson[];
  meId?: string;
  editing: Comment | null;
  pending: boolean;
  /** Called with the API body; call `done` after it saved to clear the field. */
  onSubmit: (body: string, done: () => void) => void;
  onCancelEdit: () => void;
}) {
  const [text, setText] = useState('');
  const [cursor, setCursor] = useState(0);
  const [picked, setPicked] = useState(() => new Map<string, string>());
  const [editingId, setEditingId] = useState<string | null>(null);
  const input = useRef<TextInputInstance>(null);

  // Start editing: fill in the comment's text, with its mentions already "picked".
  if ((editing?.id ?? null) !== editingId) {
    setEditingId(editing?.id ?? null);
    const value = editing ? commentPlainText(editing) : '';
    setText(value);
    setCursor(value.length);
    setPicked(new Map(editing?.mentions.map((m) => [m.name, m.id]) ?? []));
  }

  // Editing starts from a menu: put the cursor in the field.
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  // "@ra" just before the cursor → suggestions. Up to two words, so "@Ravi K" still matches.
  const match = /(?:^|\s)@([^\s@]*(?: [^\s@]*)?)$/u.exec(text.slice(0, cursor));
  const query = match?.[1].toLowerCase() ?? null;
  const suggestions =
    query === null
      ? []
      : people
          .filter((p) => p.id !== meId)
          .filter((p) => {
            const name = p.name.toLowerCase();
            return name.startsWith(query) || name.split(/\s+/).some((w) => w.startsWith(query));
          })
          .slice(0, 5);

  const pick = (person: CardPerson) => {
    const start = cursor - (match![1].length + 1); // where the "@" is
    const insert = `@${person.name} `;
    const next = text.slice(0, start) + insert + text.slice(cursor);
    setText(next);
    setCursor(start + insert.length);
    setPicked((old) => new Map(old).set(person.name, person.id));
    // Keep typing after picking someone.
    input.current?.focus();
  };

  const submit = () => {
    const body = toBody(text, picked);
    if (!body || pending) return;
    onSubmit(body, () => {
      setText('');
      setCursor(0);
      setPicked(new Map());
    });
  };

  return (
    <View style={styles.wrap}>
      {editing ? (
        <View style={styles.editBar}>
          <Feather name="edit-2" size={14} color={colors.muted} />
          <Text style={styles.editText}>Editing comment</Text>
          <Pressable accessibilityRole="button" onPress={onCancelEdit} hitSlop={10}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {suggestions.length ? (
        <View style={styles.suggestions} accessibilityRole="menu">
          {suggestions.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="menuitem"
              accessibilityLabel={`Mention ${p.name}`}
              onPress={() => pick(p)}
              style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
              <MemberAvatar name={p.name} seed={p.id} size={26} />
              <Text style={styles.suggestionText} numberOfLines={1}>
                {p.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.bar}>
        <TextInput
          ref={input}
          value={text}
          onChangeText={(value) => {
            setText(value);
            setCursor(value.length);
          }}
          onSelectionChange={(e) => setCursor(e.nativeEvent.selection.start)}
          placeholder="Write a comment, @ to mention"
          placeholderTextColor={colors.placeholder}
          multiline
          maxLength={5000}
          accessibilityLabel={editing ? 'Edit comment' : 'Write a comment'}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editing ? 'Save comment' : 'Send comment'}
          disabled={!text.trim() || pending}
          onPress={submit}
          style={({ pressed }) => [
            styles.send,
            (!text.trim() || pending) && styles.sendDisabled,
            pressed && styles.pressed,
          ]}>
          {pending ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : (
            <Feather name={editing ? 'check' : 'arrow-right'} size={20} color={colors.surface} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  editBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  cancel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  suggestions: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.control,
    overflow: 'hidden',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  suggestionText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  pressed: { opacity: 0.6 },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
});
