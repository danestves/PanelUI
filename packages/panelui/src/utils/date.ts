/**
 * Date helpers for the calendar.
 *
 * No date library. Everything a month grid needs is arithmetic on `Date`, and
 * a dependency that ships a full timezone database to render seven columns is
 * a poor trade for a library whose whole runtime is three small packages.
 *
 * Two rules hold throughout:
 *
 * - **Days are compared at local midnight.** A `Date` carries a time, and two
 *   values on the same day are not equal unless that time is stripped. Every
 *   comparison here goes through `startOfDay`.
 * - **Month arithmetic is done with `setMonth`, not by adding days.** The
 *   platform already knows that a month is 28, 29, 30 or 31 days long.
 */

/** Names of the weekdays and months, in the caller's locale. */
export type DateLocale = string | undefined;

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function isSameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Day 0 of the *next* month, which the platform resolves to the last day of
 * this one — so a leap February needs no special case.
 */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function addMonths(date: Date, months: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), 1);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Whole days from `a` to `b`, ignoring the time of day on both. */
export function daysBetween(a: Date, b: Date): number {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS);
}

export function isBefore(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}

export function isAfter(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() > startOfDay(b).getTime();
}

/** Inclusive at both ends, which is what a selected range means to a reader. */
export function isWithin(date: Date, from: Date, to: Date): boolean {
  const time = startOfDay(date).getTime();
  const start = startOfDay(from).getTime();
  const end = startOfDay(to).getTime();
  return time >= Math.min(start, end) && time <= Math.max(start, end);
}

export function clampDate(date: Date, min?: Date, max?: Date): Date {
  if (min && isBefore(date, min)) return min;
  if (max && isAfter(date, max)) return max;
  return date;
}

/**
 * The six-week grid for a month.
 *
 * Always six rows, and always starting on the chosen first day of the week, so
 * the calendar does not change height as the months are paged through. A grid
 * that grows a row in March and loses it again in April makes everything below
 * it jump, and the days themselves appear to move between months.
 *
 * The leading and trailing cells belong to the neighbouring months; whether
 * they are drawn or left blank is the caller's decision.
 */
export function monthGrid(month: Date, weekStartsOn: number): Date[][] {
  const first = startOfMonth(month);
  // How far back to the most recent `weekStartsOn`. The `+ 7` keeps the
  // modulo positive when the week starts later than the first of the month.
  const lead = (first.getDay() - weekStartsOn + 7) % 7;
  const start = addDays(first, -lead);

  return Array.from({ length: 6 }, (_unusedWeek, week) =>
    Array.from({ length: 7 }, (_unusedDay, day) => addDays(start, week * 7 + day))
  );
}

/**
 * Formatting, guarded.
 *
 * `Intl` is on modern Hermes, but the data behind it is not guaranteed —
 * builds without the full ICU set throw or return something unusable for
 * locales they do not carry. Every formatter here falls back to English rather
 * than taking the screen down over a month name.
 */
function format(date: Date, locale: DateLocale, options: Intl.DateTimeFormatOptions): string | null {
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return null;
  }
}

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Month names in order, for the caption and its dropdown. */
export function monthNames(locale: DateLocale, style: 'long' | 'short' = 'long'): string[] {
  return MONTHS_EN.map((fallback, month) => {
    const formatted = format(new Date(2021, month, 1), locale, { month: style });
    return formatted ?? (style === 'short' ? fallback.slice(0, 3) : fallback);
  });
}

/** Column headings, rotated so the first one is `weekStartsOn`. */
export function weekdayNames(locale: DateLocale, weekStartsOn: number): string[] {
  // 2021-08-01 was a Sunday, so adding the index lands on each weekday in turn.
  return Array.from({ length: 7 }, (_unused, day) => {
    const index = (day + weekStartsOn) % 7;
    const formatted = format(new Date(2021, 7, 1 + index), locale, { weekday: 'short' });
    return formatted ?? WEEKDAYS_EN[index]!;
  });
}

/** "March 2026", for the caption. */
export function monthLabel(date: Date, locale: DateLocale): string {
  return (
    format(date, locale, { month: 'long', year: 'numeric' }) ??
    `${MONTHS_EN[date.getMonth()]} ${date.getFullYear()}`
  );
}

/** "12 March 2026" — the whole date, for a screen reader to read out. */
export function longDate(date: Date, locale: DateLocale): string {
  return (
    format(date, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) ??
    `${WEEKDAYS_EN[date.getDay()]} ${date.getDate()} ${MONTHS_EN[date.getMonth()]} ${date.getFullYear()}`
  );
}

/** "12 Mar 2026" — the compact form a trigger shows. */
export function shortDate(date: Date, locale: DateLocale): string {
  return (
    format(date, locale, { day: 'numeric', month: 'short', year: 'numeric' }) ??
    `${date.getDate()} ${MONTHS_EN[date.getMonth()]!.slice(0, 3)} ${date.getFullYear()}`
  );
}
