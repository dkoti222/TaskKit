import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ChecklistItem } from '@/api/types';
import { AppText } from '@/components/app-text';
import { colors, fonts, radius, spacing } from '@/theme';

/** Checklist on 15 · Card detail: progress bar, items to tick, rename or delete, and "Add an item". */
export function Checklist({
  items,
  editable,
  onToggle,
  onRename,
  onDelete,
  onAdd,
  adding,
}: {
  items: ChecklistItem[];
  editable: boolean;
  onToggle: (item: ChecklistItem) => void;
  onRename: (item: ChecklistItem, text: string) => void;
  onDelete: (item: ChecklistItem) => void;
  onAdd: (text: string, done: () => void) => void;
  adding: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const done = items.filter((i) => i.done).length;
  const progress = items.length ? done / items.length : 0;

  const saveEdit = (item: ChecklistItem) => {
    const text = editText.trim();
    setEditingId(null);
    if (text && text !== item.text) onRename(item, text);
  };

  const add = () => {
    const text = draft.trim();
    if (!text || adding) return;
    onAdd(text, () => setDraft(''));
  };

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <AppText style={styles.heading} accessibilityRole="header">
          Checklist
        </AppText>
        {items.length ? (
          <AppText variant="small">
            {done} of {items.length}
          </AppText>
        ) : null}
      </View>
      {items.length ? (
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: items.length, now: done }}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
      ) : null}

      {items.map((item) => (
        <View key={item.id} style={styles.item}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.done, disabled: !editable }}
            accessibilityLabel={item.text}
            disabled={!editable}
            onPress={() => onToggle(item)}
            hitSlop={8}
            style={[styles.box, item.done && styles.boxOn]}>
            {item.done ? <Feather name="check" size={14} color={colors.surface} /> : null}
          </Pressable>
          {editingId === item.id ? (
            <TextInput
              value={editText}
              onChangeText={setEditText}
              autoFocus
              maxLength={300}
              returnKeyType="done"
              onSubmitEditing={() => saveEdit(item)}
              onBlur={() => saveEdit(item)}
              accessibilityLabel="Edit checklist item"
              style={[styles.itemText, styles.itemInput]}
            />
          ) : (
            <Pressable
              style={styles.textPress}
              disabled={!editable}
              accessibilityHint={editable ? 'Tap to rename' : undefined}
              onPress={() => {
                setEditingId(item.id);
                setEditText(item.text);
              }}>
              <Text style={[styles.itemText, item.done && styles.itemDone]}>{item.text}</Text>
            </Pressable>
          )}
          {editable && editingId !== item.id ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.text}`}
              onPress={() => onDelete(item)}
              hitSlop={8}
              style={styles.delete}>
              <Feather name="x" size={16} color={colors.placeholder} />
            </Pressable>
          ) : null}
        </View>
      ))}

      {!items.length && !editable ? <AppText variant="small">No checklist items.</AppText> : null}

      {editable ? (
        <View style={styles.addRow}>
          <Feather name="plus" size={18} color={colors.muted} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add an item"
            placeholderTextColor={colors.placeholder}
            maxLength={300}
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={add}
            editable={!adding}
            accessibilityLabel="Add a checklist item"
            style={styles.addInput}
          />
          {draft.trim() ? (
            <Pressable accessibilityRole="button" onPress={add} hitSlop={10} disabled={adding}>
              <Text style={styles.addButton}>{adding ? 'Adding…' : 'Add'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontFamily: fonts.semibold, fontSize: 15 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.divider, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  boxOn: { backgroundColor: colors.success, borderColor: colors.success },
  textPress: { flex: 1, paddingVertical: 10 },
  itemText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
  itemDone: { color: colors.muted, textDecorationLine: 'line-through' },
  itemInput: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: 6,
  },
  delete: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  addInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 10,
  },
  addButton: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
});
