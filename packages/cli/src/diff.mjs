const CONTEXT_LINES = 3;
const MAX_MYERS_LINES = 500;

function lines(source) {
  return source.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

function editScript(before, after) {
  let prefix = 0;
  while (
    prefix < before.length &&
    prefix < after.length &&
    before[prefix] === after[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - suffix - 1] === after[after.length - suffix - 1]
  ) {
    suffix += 1;
  }

  const leading = before.slice(0, prefix).map((line) => ({ type: ' ', line }));
  const trailing = before
    .slice(before.length - suffix)
    .map((line) => ({ type: ' ', line }));
  const oldMiddle = before.slice(prefix, before.length - suffix);
  const newMiddle = after.slice(prefix, after.length - suffix);

  // New/deleted files are linear. Very large rewrites also use a valid,
  // non-minimal replacement instead of letting Myers' trace grow quadratically.
  if (
    !oldMiddle.length ||
    !newMiddle.length ||
    oldMiddle.length + newMiddle.length > MAX_MYERS_LINES
  ) {
    return [
      ...leading,
      ...oldMiddle.map((line) => ({ type: '-', line })),
      ...newMiddle.map((line) => ({ type: '+', line })),
      ...trailing,
    ];
  }

  const trace = [];
  let frontier = new Map([[1, 0]]);
  const limit = oldMiddle.length + newMiddle.length;

  for (let depth = 0; depth <= limit; depth += 1) {
    trace.push(frontier);
    const next = new Map();
    for (let diagonal = -depth; diagonal <= depth; diagonal += 2) {
      const down = frontier.get(diagonal + 1) ?? -1;
      const right = frontier.get(diagonal - 1) ?? -1;
      let x =
        diagonal === -depth || (diagonal !== depth && right < down)
          ? down
          : right + 1;
      let y = x - diagonal;
      while (
        x < oldMiddle.length &&
        y < newMiddle.length &&
        oldMiddle[x] === newMiddle[y]
      ) {
        x += 1;
        y += 1;
      }
      next.set(diagonal, x);
      if (x >= oldMiddle.length && y >= newMiddle.length) {
        return [
          ...leading,
          ...backtrack(trace, oldMiddle, newMiddle),
          ...trailing,
        ];
      }
    }
    frontier = next;
  }

  throw new Error('Could not compute diff');
}

function backtrack(trace, before, after) {
  const edits = [];
  let x = before.length;
  let y = after.length;

  for (let depth = trace.length - 1; depth >= 0; depth -= 1) {
    const frontier = trace[depth];
    const diagonal = x - y;
    const down = frontier.get(diagonal + 1) ?? -1;
    const right = frontier.get(diagonal - 1) ?? -1;
    const previousDiagonal =
      diagonal === -depth || (diagonal !== depth && right < down)
        ? diagonal + 1
        : diagonal - 1;
    const previousX = frontier.get(previousDiagonal) ?? 0;
    const previousY = previousX - previousDiagonal;

    while (x > previousX && y > previousY) {
      edits.push({ type: ' ', line: before[x - 1] });
      x -= 1;
      y -= 1;
    }
    if (depth === 0) break;
    if (x === previousX) {
      edits.push({ type: '+', line: after[y - 1] });
      y -= 1;
    } else {
      edits.push({ type: '-', line: before[x - 1] });
      x -= 1;
    }
  }

  return edits.reverse();
}

function range(start, count) {
  if (count === 0) return `${start - 1},0`;
  return count === 1 ? String(start) : `${start},${count}`;
}

function renderLine({ type, line }) {
  const terminated = line.endsWith('\n');
  const rendered = `${type}${terminated ? line.slice(0, -1) : line}`;
  return terminated ? [rendered] : [rendered, '\\ No newline at end of file'];
}

/** Return a deterministic, three-line-context unified text diff. */
export function unifiedDiff(file, current, incoming) {
  if (current === incoming) return '';

  const before = lines(current ?? '');
  const after = lines(incoming ?? '');
  const edits = editScript(before, after);
  const oldPositions = [1];
  const newPositions = [1];
  for (const edit of edits) {
    oldPositions.push(oldPositions.at(-1) + (edit.type === '+' ? 0 : 1));
    newPositions.push(newPositions.at(-1) + (edit.type === '-' ? 0 : 1));
  }

  const changed = edits.flatMap((edit, index) =>
    edit.type === ' ' ? [] : [index],
  );
  const hunks = [];
  for (const index of changed) {
    const start = Math.max(0, index - CONTEXT_LINES);
    const end = Math.min(edits.length, index + CONTEXT_LINES + 1);
    const previous = hunks.at(-1);
    if (previous && start <= previous.end)
      previous.end = Math.max(previous.end, end);
    else hunks.push({ start, end });
  }

  const output = [
    `--- ${current === null ? '/dev/null' : `a/${file}`}`,
    `+++ ${incoming === null ? '/dev/null' : `b/${file}`}`,
  ];
  for (const hunk of hunks) {
    const slice = edits.slice(hunk.start, hunk.end);
    const oldCount = slice.filter((edit) => edit.type !== '+').length;
    const newCount = slice.filter((edit) => edit.type !== '-').length;
    output.push(
      `@@ -${range(oldPositions[hunk.start], oldCount)} +${range(newPositions[hunk.start], newCount)} @@`,
    );
    for (const edit of slice) output.push(...renderLine(edit));
  }
  return output.join('\n');
}
