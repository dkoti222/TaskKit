export const POSITION_GAP = 1000;

export const nextPosition = (last: number | null | undefined) => (last ?? 0) + POSITION_GAP;