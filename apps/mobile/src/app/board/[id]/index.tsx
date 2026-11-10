import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/api/errors';
import type { BoardList, CardSummary, Label } from '@/api/types';
import { AppText } from '@/components/app-text';
import { BoardAccessRemoved, useBoardAccessLost } from '@/components/board-access';
import { AddListTile, COLUMN_GAP, FirstListCard, ListColumn } from '@/components/board-columns';
import { Button } from '@/components/button';
import { LabelChip, Toast } from '@/components/card-ui';
import { IconButton } from '@/components/misc';
import { Sheet } from '@/components/sheet';
import { useBoardContent, useLabels } from '@/hooks/use-board-content';
import { findCachedBoard, useBoard } from '@/hooks/use-boards';
import { useCreateLists } from '@/hooks/use-lists';
import { useMe } from '@/hooks/use-me';
import { useMoveCard, useMoveList } from '@/hooks/use-move';
import { useWorkspace } from '@/hooks/use-workspaces';
import { dueState, tint } from '@/lib/format';
import { colors, fonts, spacing } from '@/theme';

type Filter =
  { kind: 'all' } | { kind: 'mine' } | { kind: 'due' } | { kind: 'label'; label: Label };

// 13 · Board. Lists side by side, cards stacked by position. Long-press a card to drag it up
// or down its list; long-press a list header to drag the list. Every move updates the cache
// first, then calls the API, and rolls back with a message if the API refuses.
export default function BoardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { width: screenWidth } = useWindowDimensions();
  const me = useMe();
  const board = useBoard(id);
  const content = useBoardContent(id);
  // Remember where the board lives, for the Access removed screen after a 404.
  const [cached] = useState(() => findCachedBoard(queryClient, id));
  const workspaceId = board.data?.workspaceId ?? cached?.workspaceId ?? '';
  const workspace = useWorkspace(workspaceId);
  const lost = useBoardAccessLost(content.error ?? board.error, workspaceId);

  const moveCard = useMoveCard(id);
  const moveList = useMoveList(id);
  const createLists = useCreateLists(id);

  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const [labelSheet, setLabelSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [bodyHeight, setBodyHeight] = useState(0);
  const hideToast = useCallback(() => setToast(null), []);

  const info = content.data?.board ?? board.data;
  const color = info?.color ?? colors.primary;
  const cachedLists = content.data?.lists;
  // Keep a dropped list order until the cache changes (see ListColumn for why).
  const [listOverride, setListOverride] = useState<{
    source: BoardList[];
    data: BoardList[];
  } | null>(null);
  const lists =
    listOverride && listOverride.source === cachedLists ? listOverride.data : cachedLists;
  const columnWidth = Math.min(Math.round(screenWidth * 0.8), 320);

  // Same lists (and order) as the cache when no filter is on, so dragging maps 1:1 to the API.
  const filterCards = (() => {
    const myId = me.data?.id;
    switch (filter.kind) {
      case 'mine':
        return (cards: CardSummary[]) =>
          cards.filter((c) => c.assignees.some((p) => p.id === myId));
      case 'due':
        return (cards: CardSummary[]) =>
          cards.filter((c) => c.dueAt && dueState(c.dueAt) !== 'later');
      case 'label':
        return (cards: CardSummary[]) =>
          cards.filter((c) => c.labels.some((l) => l.id === filter.label.id));
      default:
        return null;
    }
  })();

  const goBack = () =>
    router.canGoBack()
      ? router.back()
      : workspaceId
        ? router.replace({ pathname: '/workspace/[id]', params: { id: workspaceId } })
        : router.replace('/');

  if (lost) {
    return <BoardAccessRemoved boardName={info?.name ?? cached?.name} workspaceId={workspaceId} />;
  }

  const showError = (error: unknown) => setToast(getErrorMessage(error));

  const onMoveCard = (list: BoardList, card: CardSummary, index: number) =>
    moveCard.mutate(
      { cardId: card.id, listId: list.id, index, version: card.version },
      { onError: showError },
    );

  const addLists = (names: string[], done?: () => void) =>
    createLists.mutate(names, { onSuccess: () => done?.() });

  const listsError = createLists.isError ? getErrorMessage(createLists.error) : null;
  const columnMax = Math.max(bodyHeight - spacing.md * 2, 200);

  let body;
  if (content.isPending) {
    body = <ActivityIndicator color={colors.primary} style={styles.loading} />;
  } else if (content.isError && !lists) {
    body = (
      <View style={styles.errorCard}>
        <Feather name="wifi-off" size={22} color={colors.muted} />
        <AppText variant="secondary" style={styles.center}>
          {getErrorMessage(content.error)}
        </AppText>
        <Button
          title="Try again"
          variant="secondary"
          onPress={() => content.refetch()}
          loading={content.isFetching}
        />
      </View>
    );
  } else if (!lists?.length) {
    body = (
      <ScrollView keyboardShouldPersistTaps="handled">
        <FirstListCard
          color={color}
          onAdd={(names) => addLists(names)}
          pending={createLists.isPending}
          error={listsError}
        />
      </ScrollView>
    );
  } else {
    body = (
      <DraggableFlatList
        horizontal
        data={lists}
        keyExtractor={(list) => list.id}
        activationDistance={12}
        containerStyle={styles.flex}
        contentContainerStyle={styles.lists}
        showsHorizontalScrollIndicator={false}
        snapToInterval={columnWidth + COLUMN_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, drag, isActive }) => (
          <ListColumn
            list={item}
            cards={filterCards ? filterCards(item.cards) : item.cards}
            filtered={!!filterCards}
            width={columnWidth}
            maxHeight={columnMax}
            editable
            dragCards={!filterCards}
            onDragList={drag}
            listActive={isActive}
            onMoveCard={(card, index) => onMoveCard(item, card, index)}
          />
        )}
        onDragEnd={({ data, from, to }) => {
          if (from === to || !cachedLists) return;
          setListOverride({ source: cachedLists, data });
          moveList.mutate({ listId: data[to].id, index: to }, { onError: showError });
        }}
        ListFooterComponent={
          <AddListTile
            width={columnWidth}
            onAdd={(name, done) => addLists([name], done)}
            pending={createLists.isPending}
            error={listsError}
          />
        }
      />
    );
  }

  const chips: { key: Filter['kind']; label: string; onPress: () => void }[] = [
    { key: 'all', label: 'All cards', onPress: () => setFilter({ kind: 'all' }) },
    { key: 'mine', label: 'My cards', onPress: () => setFilter({ kind: 'mine' }) },
    { key: 'due', label: 'Due soon', onPress: () => setFilter({ kind: 'due' }) },
    {
      key: 'label',
      label: filter.kind === 'label' ? filter.label.name : 'Labels',
      onPress: () => setLabelSheet(true),
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: tint(color, 0.9) }]}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={{ backgroundColor: color }}>
        <View style={styles.header}>
          <IconButton icon="chevron-left" label="Go back" onPress={goBack} color={colors.surface} />
          <View style={styles.titleBox}>
            <View style={styles.titleRow}>
              <AppText style={styles.title} numberOfLines={1} accessibilityRole="header">
                {info?.name ?? cached?.name ?? ''}
              </AppText>
              {info?.visibility === 'PRIVATE' ? (
                <Feather
                  name="lock"
                  size={14}
                  color={colors.surface}
                  accessibilityLabel="Private board"
                />
              ) : null}
            </View>
            {workspace.data ? (
              <AppText style={styles.subtitle} numberOfLines={1}>
                {workspace.data.name}
              </AppText>
            ) : null}
          </View>
          {info ? (
            <IconButton
              icon="more-horizontal"
              label="Board settings"
              onPress={() => router.push({ pathname: '/board/[id]/settings', params: { id } })}
              color={colors.surface}
            />
          ) : null}
        </View>
        {lists?.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            accessibilityRole="tablist">
            {chips.map((chip) => {
              const selected = filter.kind === chip.key;
              return (
                <Pressable
                  key={chip.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={chip.onPress}
                  style={[styles.chip, selected && styles.chipSelected]}>
                  <Text style={[styles.chipText, selected && { color }]}>{chip.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </SafeAreaView>

      <View style={styles.flex} onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}>
        {body}
      </View>

      <Toast message={toast} onHide={hideToast} />

      <LabelFilterSheet
        visible={labelSheet}
        boardId={id}
        selectedId={filter.kind === 'label' ? filter.label.id : undefined}
        onClose={() => setLabelSheet(false)}
        onPick={(label) => {
          setFilter(label ? { kind: 'label', label } : { kind: 'all' });
          setLabelSheet(false);
        }}
      />
    </View>
  );
}

/** Pick one label to show only its cards. */
function LabelFilterSheet({
  visible,
  boardId,
  selectedId,
  onClose,
  onPick,
}: {
  visible: boolean;
  boardId: string;
  selectedId?: string;
  onClose: () => void;
  onPick: (label: Label | null) => void;
}) {
  const labels = useLabels(boardId);
  return (
    <Sheet visible={visible} onClose={onClose} title="Filter by label">
      <View style={styles.sheetBody}>
        {labels.isPending ? (
          <ActivityIndicator color={colors.primary} />
        ) : labels.isError ? (
          <View style={styles.sheetGap}>
            <AppText variant="secondary" style={{ color: colors.danger }}>
              {getErrorMessage(labels.error)}
            </AppText>
            <Button title="Try again" variant="secondary" onPress={() => labels.refetch()} />
          </View>
        ) : labels.data.length === 0 ? (
          <AppText variant="secondary">This board has no labels yet.</AppText>
        ) : (
          <View style={styles.labelWrap}>
            {labels.data.map((label) => (
              <LabelChip
                key={label.id}
                label={label}
                size="large"
                selected={label.id === selectedId}
                onPress={() => onPick(label.id === selectedId ? null : label)}
              />
            ))}
          </View>
        )}
        {selectedId ? (
          <Button title="Show all cards" variant="secondary" onPress={() => onPick(null)} />
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    minHeight: 56,
  },
  titleBox: { flex: 1, marginLeft: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 23,
    color: colors.surface,
    flexShrink: 1,
  },
  subtitle: { fontSize: 12, lineHeight: 16, color: colors.surface, opacity: 0.85 },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    paddingHorizontal: 12,
    height: 30,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.surface, borderColor: colors.surface },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.surface },
  lists: { padding: spacing.md, alignItems: 'flex-start' },
  loading: { marginTop: spacing.xxl },
  errorCard: {
    margin: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  center: { textAlign: 'center' },
  sheetBody: { padding: spacing.lg, gap: spacing.lg },
  sheetGap: { gap: spacing.md },
  labelWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
