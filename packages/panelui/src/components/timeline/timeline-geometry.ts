export const TIMELINE_WIDE_COLUMN = 268;
export const TIMELINE_NARROW_COLUMN = 76;

export function timelineColumnWidth(requested: number | undefined, filled: boolean): number {
  if (requested !== undefined && Number.isFinite(requested) && requested > 0) {
    return requested;
  }
  return filled ? TIMELINE_WIDE_COLUMN : TIMELINE_NARROW_COLUMN;
}
