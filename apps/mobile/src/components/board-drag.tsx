import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import type { CardSummary } from '@/api/types';
import { CardFace } from '@/components/card-ui';

/**
 * Dragging cards on the board (13), within a list and across lists:
 * - long-press a card (300 ms) and it lifts: a copy follows the finger over the whole board
 * - a gap shows where it would land; near the screen's left/right edge the board scrolls,
 *   near a list's top/bottom the list scrolls
 * - letting go calls `onMove(card, toListId, index)` (index among the other cards of that list)
 *
 * Columns register their card ScrollView and each card's layout, so the drop target can be
 * worked out from screen coordinates.
 */

type Target = { listId: string; index: number };
type Dragging = {
  card: CardSummary;
  fromListId: string;
  fromIndex: number;
  width: number;
  height: number;
};
type ColumnRect = { x: number; y: number; width: number; height: number };
/** What we need from a list's card ScrollView. */
type ColumnRef = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
  scrollTo: (options: { y: number; animated?: boolean }) => void;
};

type Ctx = {
  dragging: Dragging | null;
  target: Target | null;
  registerColumn: (listId: string, ref: ColumnRef | null) => void;
  onColumnScroll: (listId: string, y: number) => void;
  registerCard: (listId: string, cardId: string, y: number, height: number, width: number) => void;
  start: (
    card: CardSummary,
    listId: string,
    absX: number,
    absY: number,
    grabX: number,
    grabY: number,
  ) => void;
  move: (absX: number, absY: number) => void;
  drop: () => void;
  cancel: () => void;
};

const DragContext = createContext<Ctx | null>(null);
export const useBoardDrag = () => useContext(DragContext);

const EDGE = 48; // px from the screen edge that starts auto-scrolling
const SCROLL_STEP = 14;

export function BoardDragProvider({
  children,
  listOrder,
  scrollBoardBy,
  onMove,
}: {
  children: ReactNode;
  /** The lists on screen, in order, with their cards (as shown). */
  listOrder: { id: string; cards: CardSummary[] }[];
  /** Scrolls the horizontal board by dx (for edge auto-scroll). */
  scrollBoardBy: (dx: number) => void;
  onMove: (card: CardSummary, toListId: string, index: number) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const [dragging, setDragging] = useState<Dragging | null>(null);
  const [target, setTarget] = useState<Target | null>(null);

  const columns = useRef(new Map<string, ColumnRef>());
  const columnScroll = useRef(new Map<string, number>());
  const cardLayouts = useRef(
    new Map<string, { listId: string; y: number; height: number; width: number }>(),
  );
  const rects = useRef(new Map<string, ColumnRect>());
  const pointer = useRef({ x: 0, y: 0 });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const draggingRef = useRef<Dragging | null>(null);
  const targetRef = useRef<Target | null>(null);

  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const grab = useRef({ x: 0, y: 0 });

  const measureColumns = useCallback(() => {
    for (const [listId, ref] of columns.current) {
      ref.measureInWindow((x, y, width, height) =>
        rects.current.set(listId, { x, y, width, height }),
      );
    }
  }, []);

  /** Which list and position the finger is over (cards of the dragged card excluded). */
  const hitTest = useCallback(
    (x: number, y: number): Target | null => {
      const drag = draggingRef.current;
      if (!drag) return null;
      let best: { listId: string; rect: ColumnRect } | null = null;
      for (const [listId, rect] of rects.current) {
        if (x >= rect.x && x <= rect.x + rect.width) best = { listId, rect };
      }
      if (!best) return targetRef.current; // between columns: keep the last target
      const list = listOrder.find((l) => l.id === best.listId);
      if (!list) return null;
      const scrollY = columnScroll.current.get(best.listId) ?? 0;
      const others = list.cards.filter((c) => c.id !== drag.card.id);
      let index = 0;
      for (const c of others) {
        const layout = cardLayouts.current.get(c.id);
        if (!layout) continue;
        const mid = best.rect.y + layout.y - scrollY + layout.height / 2;
        if (y > mid) index++;
      }
      return { listId: best.listId, index };
    },
    [listOrder],
  );

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  /** While dragging near an edge: scroll the board sideways, or the list up/down. */
  const autoScroll = useCallback(() => {
    const { x, y } = pointer.current;
    if (x < EDGE) scrollBoardBy(-SCROLL_STEP);
    else if (x > screenWidth - EDGE) scrollBoardBy(SCROLL_STEP);
    const t = targetRef.current;
    const rect = t ? rects.current.get(t.listId) : undefined;
    const ref = t ? columns.current.get(t.listId) : undefined;
    if (t && rect && ref) {
      const current = columnScroll.current.get(t.listId) ?? 0;
      if (y < rect.y + EDGE)
        ref.scrollTo({ y: Math.max(0, current - SCROLL_STEP), animated: false });
      else if (y > rect.y + rect.height - EDGE)
        ref.scrollTo({ y: current + SCROLL_STEP, animated: false });
    }
    measureColumns();
    const next = hitTest(x, y);
    if (
      next &&
      (next.listId !== targetRef.current?.listId || next.index !== targetRef.current?.index)
    ) {
      targetRef.current = next;
      setTarget(next);
    }
  }, [hitTest, measureColumns, screenWidth, scrollBoardBy]);

  const value = useMemo<Ctx>(
    () => ({
      dragging,
      target,
      registerColumn: (listId, ref) => {
        if (ref) columns.current.set(listId, ref);
        else columns.current.delete(listId);
      },
      onColumnScroll: (listId, y) => columnScroll.current.set(listId, y),
      registerCard: (listId, cardId, y, height, width) =>
        cardLayouts.current.set(cardId, { listId, y, height, width }),
      start: (card, listId, absX, absY, grabX, grabY) => {
        const layout = cardLayouts.current.get(card.id);
        const fromIndex =
          listOrder.find((l) => l.id === listId)?.cards.findIndex((c) => c.id === card.id) ?? 0;
        const drag: Dragging = {
          card,
          fromListId: listId,
          fromIndex,
          width: layout?.width ?? 260,
          height: layout?.height ?? 80,
        };
        draggingRef.current = drag;
        grab.current = { x: grabX, y: grabY };
        pointer.current = { x: absX, y: absY };
        ghostX.set(absX - grabX);
        ghostY.set(absY - grabY);
        const start = { listId, index: fromIndex };
        targetRef.current = start;
        setTarget(start);
        setDragging(drag);
        measureColumns();
        stopTimer();
        timer.current = setInterval(autoScroll, 50);
      },
      move: (absX, absY) => {
        pointer.current = { x: absX, y: absY };
        ghostX.set(absX - grab.current.x);
        ghostY.set(absY - grab.current.y);
        const next = hitTest(absX, absY);
        if (
          next &&
          (next.listId !== targetRef.current?.listId || next.index !== targetRef.current?.index)
        ) {
          targetRef.current = next;
          setTarget(next);
        }
      },
      drop: () => {
        const drag = draggingRef.current;
        const t = targetRef.current;
        if (drag && t && !(t.listId === drag.fromListId && t.index === drag.fromIndex)) {
          onMove(drag.card, t.listId, t.index);
        }
      },
      cancel: () => {
        stopTimer();
        draggingRef.current = null;
        targetRef.current = null;
        setDragging(null);
        setTarget(null);
      },
    }),
    [autoScroll, dragging, ghostX, ghostY, hitTest, listOrder, measureColumns, onMove, target],
  );

  const ghostStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ghostX.value }, { translateY: ghostY.value }, { rotate: '2deg' }],
  }));

  return (
    <DragContext.Provider value={value}>
      {children}
      {dragging ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View style={[styles.ghost, { width: dragging.width }, ghostStyle]}>
            <CardFace card={dragging.card} active />
          </Animated.View>
        </View>
      ) : null}
    </DragContext.Provider>
  );
}

/**
 * A card that can be lifted and dragged (when `enabled`). A plain tap still opens it.
 * Measures itself so the board knows where every card is.
 */
export function DraggableCard({
  card,
  listId,
  enabled,
  onPress,
  waiting,
}: {
  card: CardSummary;
  listId: string;
  enabled: boolean;
  onPress?: () => void;
  waiting?: boolean;
}) {
  const drag = useBoardDrag();
  const lifted = drag?.dragging?.card.id === card.id;

  const gesture = Gesture.Pan()
    .enabled(enabled && !!drag)
    .activateAfterLongPress(300)
    .runOnJS(true)
    .onStart((e) => drag?.start(card, listId, e.absoluteX, e.absoluteY, e.x, e.y))
    .onUpdate((e) => drag?.move(e.absoluteX, e.absoluteY))
    .onEnd(() => drag?.drop())
    .onFinalize(() => drag?.cancel());

  return (
    <GestureDetector gesture={gesture}>
      <View
        onLayout={(e) => {
          const { y, height, width } = e.nativeEvent.layout;
          drag?.registerCard(listId, card.id, y, height, width);
        }}
        style={lifted && styles.lifted}
        accessibilityHint={
          enabled ? 'Long-press and drag to move it within or across lists' : undefined
        }>
        <CardFace card={card} onPress={onPress} waiting={waiting} />
      </View>
    </GestureDetector>
  );
}

/** The gap where the dragged card would land. */
export function DropGap({ height }: { height: number }) {
  return <View style={[styles.gap, { height }]} />;
}

const styles = StyleSheet.create({
  ghost: { position: 'absolute', left: 0, top: 0, opacity: 0.95 },
  lifted: { opacity: 0.3 },
  gap: {
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#9DB2F5',
    backgroundColor: 'rgba(47, 91, 234, 0.06)',
  },
});
