import Feather from '@expo/vector-icons/Feather';
import { useQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listLabels } from '@/api/boards';
import { getErrorMessage } from '@/api/errors';
import type { Highlighted, Label, SearchResult } from '@/api/types';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { DueChip, LabelChip } from '@/components/card-ui';
import { Sheet } from '@/components/sheet';
import { boardKeys, useBoards } from '@/hooks/use-boards';
import { useMe } from '@/hooks/use-me';
import { useDebounced, useSearch } from '@/hooks/use-search';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { useRecentSearches } from '@/store/recent-searches';
import { colors, fonts, radius, spacing } from '@/theme';

type SheetKind = 'workspace' | 'board' | 'label' | null;

// 21 · Search: full-text search over the cards you can see in one workspace, with My cards,
// Due this week, Label and Board filters. Results are grouped by board; tap one to open it.
export default function SearchScreen() {
  const me = useMe();
  const workspaces = useWorkspaces();
  const [workspaceId, setWorkspaceId] = useState<string | undefined>();
  const wsId = workspaceId ?? workspaces.data?.[0]?.id;
  const workspace = workspaces.data?.find((w) => w.id === wsId);

  const [text, setText] = useState('');
  const [mine, setMine] = useState(false);
  const [week, setWeek] = useState(false);
  const [board, setBoard] = useState<{ id: string; name: string } | null>(null);
  const [label, setLabel] = useState<Label | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);

  const recent = useRecentSearches();
  const q = useDebounced(text.trim(), 300);
  const params = {
    q: q || undefined,
    assigneeId: mine ? me.data?.id : undefined,
    due: week ? ('week' as const) : undefined,
    boardId: board?.id,
    labelId: label?.id,
  };
  const results = useSearch(wsId, params);
  const active = Object.values(params).some(Boolean);

  // Remember a search once it has found something.
  const found = results.data?.pages[0]?.items.length ?? 0;
  const addRecent = recent.add;
  useEffect(() => {
    if (q.length >= 2 && found > 0) addRecent(q);
  }, [q, found, addRecent]);

  const sections = useMemo(() => {
    const groups = new Map<string, { board: SearchResult['board']; data: SearchResult[] }>();
    for (const r of results.data?.pages.flatMap((p) => p.items) ?? []) {
      const g = groups.get(r.board.id) ?? { board: r.board, data: [] };
      g.data.push(r);
      groups.set(r.board.id, g);
    }
    return [...groups.values()];
  }, [results.data]);
  const total = sections.reduce((n, s) => n + s.data.length, 0);

  const switchWorkspace = (id: string) => {
    setWorkspaceId(id);
    setBoard(null);
    setLabel(null);
    setSheet(null);
  };

  let body;
  if (!workspaces.data?.length && !workspaces.isPending) {
    body = <Message icon="search" text="Join or create a workspace to search its cards." />;
  } else if (!active) {
    body = (
      <ScrollView contentContainerStyle={styles.idle} keyboardShouldPersistTaps="handled">
        {recent.items.length ? (
          <>
            <View style={styles.recentHeader}>
              <AppText style={styles.sectionTitle}>Recent searches</AppText>
              <Pressable accessibilityRole="button" onPress={recent.clear} hitSlop={10}>
                <Text style={styles.link}>Clear</Text>
              </Pressable>
            </View>
            <View style={styles.recentRow}>
              {recent.items.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityLabel={`Search for ${item}`}
                  onPress={() => setText(item)}
                  onLongPress={() => recent.remove(item)}
                  style={({ pressed }) => [styles.recentChip, pressed && styles.pressed]}>
                  <Text style={styles.recentText}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <Message
            icon="search"
            text={`Search card titles and descriptions${workspace ? ` in ${workspace.name}` : ''}.`}
          />
        )}
      </ScrollView>
    );
  } else if (results.isPending) {
    body = <ActivityIndicator color={colors.primary} style={styles.loading} />;
  } else if (results.isError && !results.data) {
    body = (
      <View style={styles.message}>
        <Message icon="wifi-off" text={getErrorMessage(results.error)} />
        <Button title="Try again" variant="secondary" onPress={() => results.refetch()} />
      </View>
    );
  } else {
    body = (
      <SectionList
        sections={sections}
        keyExtractor={(r) => r.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          total ? (
            <AppText variant="small" style={styles.count}>
              {total}
              {results.hasNextPage ? '+' : ''} {total === 1 ? 'card' : 'cards'}
            </AppText>
          ) : undefined
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.boardHeader} accessibilityRole="header">
            <View style={[styles.dot, { backgroundColor: section.board.color }]} />
            <AppText style={styles.boardName} numberOfLines={1}>
              {section.board.name}
            </AppText>
          </View>
        )}
        renderItem={({ item }) => (
          <ResultCard
            r={item}
            onPress={() =>
              router.push({
                pathname: '/board/[id]/card/[cardId]',
                params: { id: item.board.id, cardId: item.id },
              })
            }
          />
        )}
        ListEmptyComponent={
          <Message
            icon="search"
            text={q ? `No cards match “${q}”.` : 'No cards match these filters.'}
          />
        }
        onEndReached={() => {
          if (results.hasNextPage && !results.isFetchingNextPage) void results.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          results.isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} style={styles.more} />
          ) : undefined
        }
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <View style={styles.inputBox}>
          <Feather name="search" size={18} color={colors.muted} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Search cards"
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search cards"
            style={styles.input}
          />
          {results.isFetching && active ? (
            <ActivityIndicator size="small" color={colors.muted} />
          ) : null}
          {text ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setText('')}
              hitSlop={10}>
              <Feather name="x" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {(workspaces.data?.length ?? 0) > 1 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Searching in ${workspace?.name}. Change workspace`}
            onPress={() => setSheet('workspace')}
            style={styles.workspaceRow}>
            <Text style={styles.workspaceText} numberOfLines={1}>
              In <Text style={styles.workspaceName}>{workspace?.name}</Text>
            </Text>
            <Feather name="chevron-down" size={16} color={colors.muted} />
          </Pressable>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          <Chip label="My cards" on={mine} onPress={() => setMine(!mine)} />
          <Chip label="Due this week" on={week} onPress={() => setWeek(!week)} />
          <Chip
            label={label?.name ?? 'Label'}
            on={!!label}
            dropdown
            onPress={() => setSheet('label')}
          />
          <Chip
            label={board?.name ?? 'Board'}
            on={!!board}
            dropdown
            onPress={() => setSheet('board')}
          />
        </ScrollView>
      </View>

      <View style={styles.body}>{body}</View>

      <Sheet visible={sheet === 'workspace'} onClose={() => setSheet(null)} title="Search in">
        <View style={styles.sheet}>
          {workspaces.data?.map((w) => (
            <Option
              key={w.id}
              label={w.name}
              on={w.id === wsId}
              onPress={() => switchWorkspace(w.id)}
            />
          ))}
        </View>
      </Sheet>

      {wsId ? (
        <BoardSheet
          visible={sheet === 'board'}
          workspaceId={wsId}
          selected={board?.id}
          onClose={() => setSheet(null)}
          onPick={(b) => {
            setBoard(b);
            setLabel(null);
            setSheet(null);
          }}
        />
      ) : null}
      {wsId ? (
        <LabelSheet
          visible={sheet === 'label'}
          workspaceId={wsId}
          boardId={board?.id}
          selected={label?.id}
          onClose={() => setSheet(null)}
          onPick={(l) => {
            setLabel(l);
            setSheet(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Highlight({ parts, style }: { parts: Highlighted; style: object }) {
  return (
    <Text style={style}>
      {parts.map((p, i) => (
        <Text key={i} style={p.match ? styles.hit : undefined}>
          {p.text}
        </Text>
      ))}
    </Text>
  );
}

function ResultCard({ r, onPress }: { r: SearchResult; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${r.title}. ${r.board.name}, ${r.list.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.result, pressed && styles.pressed]}>
      <Highlight parts={r.titleParts} style={styles.resultTitle} />
      {r.snippetParts ? <Highlight parts={r.snippetParts} style={styles.snippet} /> : null}
      <View style={styles.resultMeta}>
        <Text style={styles.metaText} numberOfLines={1}>
          {r.list.name}
        </Text>
        {r.dueAt ? <DueChip dueAt={r.dueAt} /> : null}
      </View>
    </Pressable>
  );
}

function Chip({
  label,
  on,
  dropdown,
  onPress,
}: {
  label: string;
  on: boolean;
  dropdown?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
        {label}
      </Text>
      {dropdown ? (
        <Feather name="chevron-down" size={14} color={on ? colors.surface : colors.ink} />
      ) : null}
    </Pressable>
  );
}

function Option({
  label,
  on,
  onPress,
  children,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && styles.pressed]}>
      {children}
      <Text style={[styles.optionText, on && { fontFamily: fonts.semibold }]} numberOfLines={1}>
        {label}
      </Text>
      {on ? <Feather name="check" size={18} color={colors.primary} /> : null}
    </Pressable>
  );
}

function BoardSheet({
  visible,
  workspaceId,
  selected,
  onClose,
  onPick,
}: {
  visible: boolean;
  workspaceId: string;
  selected?: string;
  onClose: () => void;
  onPick: (board: { id: string; name: string } | null) => void;
}) {
  const boards = useBoards(workspaceId);
  return (
    <Sheet visible={visible} onClose={onClose} title="Board">
      <ScrollView contentContainerStyle={styles.sheet}>
        <Option label="All boards" on={!selected} onPress={() => onPick(null)} />
        {boards.isPending ? <ActivityIndicator color={colors.primary} /> : null}
        {boards.data?.map((b) => (
          <Option
            key={b.id}
            label={b.name}
            on={b.id === selected}
            onPress={() => onPick({ id: b.id, name: b.name })}>
            <View style={[styles.dot, { backgroundColor: b.color }]} />
          </Option>
        ))}
      </ScrollView>
    </Sheet>
  );
}

/** Labels of the chosen board, or of every board you can see. */
function LabelSheet({
  visible,
  workspaceId,
  boardId,
  selected,
  onClose,
  onPick,
}: {
  visible: boolean;
  workspaceId: string;
  boardId?: string;
  selected?: string;
  onClose: () => void;
  onPick: (label: Label | null) => void;
}) {
  const boards = useBoards(workspaceId);
  const ids = boardId ? [boardId] : (boards.data?.map((b) => b.id) ?? []);
  const labelQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: boardKeys.labels(id),
      queryFn: () => listLabels(id),
      enabled: visible,
    })),
  });
  const labels = labelQueries.flatMap((q) => q.data ?? []);
  const loading = labelQueries.some((q) => q.isPending) && visible;
  return (
    <Sheet visible={visible} onClose={onClose} title="Label">
      <ScrollView contentContainerStyle={styles.sheet}>
        <Option label="Any label" on={!selected} onPress={() => onPick(null)} />
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {!loading && !labels.length ? (
          <AppText variant="secondary">
            No labels on {boardId ? 'this board' : 'your boards'} yet.
          </AppText>
        ) : null}
        <View style={styles.labelWrap}>
          {labels.map((l) => (
            <Pressable
              key={l.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: l.id === selected }}
              onPress={() => onPick(l)}
              style={[styles.labelOption, l.id === selected && styles.labelOptionOn]}>
              <LabelChip label={l} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Sheet>
  );
}

function Message({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  text: string;
}) {
  return (
    <View style={styles.message}>
      <Feather name={icon} size={22} color={colors.muted} />
      <AppText variant="secondary" style={styles.center}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  top: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: 10,
  },
  workspaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    alignSelf: 'flex-start',
  },
  workspaceText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  workspaceName: { fontFamily: fonts.semibold, color: colors.ink },
  chips: { gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    maxWidth: 180,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  chipTextOn: { color: colors.surface },
  body: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm, flexGrow: 1 },
  count: { marginBottom: spacing.xs },
  boardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: 2,
  },
  dot: { width: 10, height: 10, borderRadius: 3 },
  boardName: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, flexShrink: 1 },
  result: {
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    gap: 6,
  },
  pressed: { opacity: 0.7 },
  resultTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  snippet: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  hit: { backgroundColor: '#FFF1B8', color: colors.ink },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, flexShrink: 1 },
  idle: { padding: spacing.lg, gap: spacing.sm },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary },
  recentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  recentChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  recentText: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink },
  loading: { marginTop: spacing.xxl },
  more: { marginVertical: spacing.lg },
  message: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  center: { textAlign: 'center' },
  sheet: { padding: spacing.lg, gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  labelWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  labelOption: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 44,
    justifyContent: 'center',
  },
  labelOptionOn: { borderColor: colors.primary },
});
