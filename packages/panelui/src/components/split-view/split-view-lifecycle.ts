import { useCallback, useState } from 'react';

function normalizeIndex(index: number, count: number): number {
  if (!Number.isFinite(index) || count <= 0) return 0;
  return Math.max(0, Math.min(Math.round(index), count - 1));
}

interface SplitViewIndexLifecycleOptions {
  snapIndex: number | undefined;
  defaultSnapIndex: number;
  count: number;
  onSnapIndexChange?: (index: number) => void;
}

/** Keeps requested indices intact until the measured snap-point list exists. */
export function useSplitViewIndexLifecycle({
  snapIndex,
  defaultSnapIndex,
  count,
  onSnapIndexChange,
}: SplitViewIndexLifecycleOptions) {
  const controlled = snapIndex !== undefined;
  const [internalIndex, setInternalIndex] = useState(defaultSnapIndex);
  // Every request must settle, including one that resolves to the current index
  // after a drag and a controlled request its owner rejects.
  const [requestToken, setRequestToken] = useState(0);

  const index = normalizeIndex(
    controlled ? snapIndex : internalIndex,
    count || 1
  );

  const requestIndex = useCallback(
    (next: number) => {
      if (!controlled) setInternalIndex(next);
      setRequestToken((token) => token + 1);
      onSnapIndexChange?.(next);
    },
    [controlled, onSnapIndexChange]
  );

  return { index, requestIndex, requestToken };
}
