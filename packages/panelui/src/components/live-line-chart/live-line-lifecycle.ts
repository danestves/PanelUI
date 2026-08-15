import type { AppStateStatus } from 'react-native';

export interface LiveLineReading {
  time: number;
  value: number;
}

export const DEFAULT_LIVE_LINE_WINDOW = 30;
export const DEFAULT_LIVE_LINE_MAX_POINTS = 500;

export function normalizeLiveLineWindow(seconds: number): number {
  return Number.isFinite(seconds) && seconds > 0
    ? Math.max(seconds, 1)
    : DEFAULT_LIVE_LINE_WINDOW;
}

export function normalizeLiveLineMaxPoints(maxPoints: number): number {
  return Number.isFinite(maxPoints) && maxPoints > 0
    ? Math.max(1, Math.floor(maxPoints))
    : DEFAULT_LIVE_LINE_MAX_POINTS;
}

/**
 * Builds the one ordered, finite buffer every renderer and interaction reads.
 * For duplicate timestamps the last input wins, matching a corrected reading
 * arriving with the same identity as the one it replaces.
 */
export function normalizeLiveLinePoints<T extends LiveLineReading>(
  data: readonly T[],
  maxPoints: number,
): T[] {
  const byTime = new Map<number, T>();
  for (const point of data) {
    if (Number.isFinite(point.time) && Number.isFinite(point.value)) {
      byTime.set(point.time, point);
    }
  }
  return [...byTime.values()]
    .sort((left, right) => left.time - right.time)
    .slice(-normalizeLiveLineMaxPoints(maxPoints));
}

export function liveLineClockRuns(options: {
  paused: boolean;
  loading: boolean;
  reducedMotion: boolean;
  appState: AppStateStatus;
}): boolean {
  return (
    !options.paused &&
    !options.loading &&
    !options.reducedMotion &&
    options.appState === 'active'
  );
}

export function reconcileLiveLineActivePoint<T extends LiveLineReading>(
  active: T | null,
  points: readonly T[],
): T | null {
  if (!active) return null;
  return points.find((point) => point.time === active.time) ?? null;
}
