import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/api/errors';
import type { CardPerson } from '@/api/types';
import { AppText } from '@/components/app-text';
import { BoardAccessRemoved, useBoardAccessLost } from '@/components/board-access';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { useArchived, useRestore } from '@/hooks/use-activity';
import { findCachedBoard, useBoard } from '@/hooks/use-boards';
import { useMe } from '@/hooks/use-me';
import { firstName, shortDate } from '@/lib/format';
import { canEditCards } from '@/lib/roles';
import { colors, fonts, radius, spacing } from '@/theme';

type Tab = 'cards' | 'lists';

// 18 · Archived items: a board's archived cards and lists, with Restore (Owner, Admin, Member).
export default function BoardArchivedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('cards');
  const me = useMe();
  const board = useBoard(id);
  const [cached] = useState(() => findCachedBoard(queryClient, id));
  const archived = useArchived(id);
  const restore = useRestore(id);
  const lost = useBoardAccessLost(archived.error ?? board.error, board.data?.workspaceId);
  const canRestore = canEditCards(board.data?.role);

  const goBack = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/board/[id]/settings', params: { id } });

  if (lost) {
    return (
      <BoardAccessRemoved
        boardName={board.data?.name ?? cached?.name}
        workspaceId={board.data?.workspaceId ?? cached?.workspaceId}
      />
    );
  }

  const by = (person: CardPerson | null) =>
    person ? (person.id === me.data?.id ? 'you' : firstName(person.name)) : null;
  const archivedLine = (person: CardPerson | null, at: string) =>
    by(person) ? `archived by ${by(person)}, ${shortDate(at)}` : `archived ${shortDate(at)}`;

  const cards = archived.data?.cards ?? [];
  const lists = archived.data?.lists ?? [];

  const restoreButton = (kind: 'card' | 'list', itemId: string, name: string, disabled = false) => {
    if (!canRestore) return null;
    const busy = restore.isPending && restore.variables?.id === itemId;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Restore ${name}`}
        disabled={restore.isPending || disabled}
        onPress={() => restore.mutate({ kind, id: itemId })}
        style={({ pressed }) => [
          styles.restore,
          disabled && styles.restoreDisabled,
          pressed && styles.pressed,
        ]}>
        {busy ? (
          <ActivityIndicator size="small" color={colors.ink} />
        ) : (
          <Text style={styles.restoreText}>Restore</Text>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <NavHeader
        title="Archived items"
        subtitle={board.data?.name ?? cached?.name}
        onBack={goBack}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={archived.isRefetching}
            onRefresh={() => void archived.refetch()}
            tintColor={colors.primary}
          />
        }>
        {archived.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : archived.isError ? (
          <View style={styles.card}>
            <FormMessage message={getErrorMessage(archived.error)} />
            <Button title="Try again" variant="secondary" onPress={() => archived.refetch()} />
          </View>
        ) : (
          <>
            <View style={styles.tabs} accessibilityRole="tablist">
              {(['cards', 'lists'] as const).map((t) => {
                const on = tab === t;
                return (
                  <Pressable
                    key={t}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    onPress={() => setTab(t)}
                    style={[styles.tab, on && styles.tabOn]}>
                    <Text style={[styles.tabText, !on && styles.tabTextOff]}>
                      {t === 'cards' ? `Cards · ${cards.length}` : `Lists · ${lists.length}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.card, styles.list]}>
              {tab === 'cards' ? (
                cards.length === 0 ? (
                  <AppText variant="small" style={styles.empty}>
                    No archived cards.
                  </AppText>
                ) : (
                  cards.map((card, index) => (
                    <View key={card.id} style={[styles.row, index > 0 && styles.divider]}>
                      <View style={styles.flex}>
                        <AppText style={styles.name} numberOfLines={1}>
                          {card.title}
                        </AppText>
                        <AppText variant="small" numberOfLines={2}>
                          {card.list.archived
                            ? `In the archived list ${card.list.name}. Restore the list first.`
                            : `From ${card.list.name} · ${archivedLine(card.archivedBy, card.archivedAt)}`}
                        </AppText>
                      </View>
                      {restoreButton('card', card.id, card.title, card.list.archived)}
                    </View>
                  ))
                )
              ) : lists.length === 0 ? (
                <AppText variant="small" style={styles.empty}>
                  No archived lists.
                </AppText>
              ) : (
                lists.map((list, index) => (
                  <View key={list.id} style={[styles.row, index > 0 && styles.divider]}>
                    <View style={styles.flex}>
                      <AppText style={styles.name} numberOfLines={1}>
                        {list.name}
                      </AppText>
                      <AppText variant="small" numberOfLines={1}>
                        {list.cardCount === 1 ? '1 card' : `${list.cardCount} cards`} ·{' '}
                        {archivedLine(list.archivedBy, list.archivedAt)}
                      </AppText>
                    </View>
                    {restoreButton('list', list.id, list.name)}
                  </View>
                ))
              )}
            </View>
            <FormMessage message={restore.isError ? getErrorMessage(restore.error) : null} />

            <View style={[styles.card, styles.note]}>
              <Feather name="archive" size={16} color={colors.muted} style={styles.noteIcon} />
              <AppText variant="small" style={styles.flex}>
                Archived items stay hidden from the board until restored. Members and above can
                restore.
              </AppText>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  loading: { marginTop: spacing.xxl },
  flex: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.control,
    backgroundColor: '#E9EBEF',
  },
  tab: { flex: 1, minHeight: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.surface },
  tabText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  tabTextOff: { fontFamily: fonts.medium, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  list: { paddingVertical: 0, paddingHorizontal: spacing.md, gap: 0 },
  empty: { paddingVertical: spacing.lg, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  name: { fontFamily: fonts.medium, fontSize: 15 },
  restore: {
    minWidth: 76,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreDisabled: { opacity: 0.4 },
  pressed: { backgroundColor: colors.background },
  restoreText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  note: { flexDirection: 'row', gap: spacing.md },
  noteIcon: { marginTop: 1 },
});
