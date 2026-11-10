export const POSITION_GAP = 1000;

export const nextPosition = (last: number | null | undefined) => (last ?? 0) + POSITION_GAP;
export const MIN_GAP = 0.001;

/**
 * Position for an item dropped at `index` among `siblings`
 * (sorted by position, NOT including the item being moved).
 * Returns null when the neighbours are too close: renumber the list.
 */
export function positionAt(siblings: { position: number }[], index: number): number | null {
  const before = siblings[index - 1]?.position;
  const after = siblings[index]?.position;

  if (before === undefined && after === undefined) return POSITION_GAP; // empty list
  if (before === undefined) return after! > MIN_GAP * 2 ? after! / 2 : null; // top
  if (after === undefined) return before + POSITION_GAP; // end
  return after - before > MIN_GAP * 2 ? (before + after) / 2 : null; // between
}