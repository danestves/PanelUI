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

/**
 * Gregorian formatting, pinned.
 *
 * Asking for a month name in Arabic without saying which calendar gets a Hijri
 * one back, because that is what the locale resolves to — which is right for
 * the language and wrong for a grid whose cells are counting Gregorian days.
 * The digits are pinned too, so the caption and the numbers under it are in
 * one set.
 */
function formatGregory(
  date: Date,
  locale: DateLocale,
  options: Intl.DateTimeFormatOptions
): string | null {
  return format(date, locale, { ...options, calendar: 'gregory', numberingSystem: 'latn' });
}

/* -------------------------------------------------------------------------- */
/* Calendar systems                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Which calendar the months and day numbers are counted in.
 *
 * `auto` takes whatever the locale resolves to, which on an Arabic device is
 * usually islamic. It is not the default: a grid whose month boundaries move
 * with the device's language is a surprise, and the caller who wants that can
 * ask for it.
 */
export type CalendarSystem = 'gregory' | 'islamic' | 'auto';

/** Year, month and day as the chosen calendar counts them. 1-based month. */
export interface CalendarParts {
  year: number;
  month: number;
  day: number;
}

/** What `auto` resolves to for a locale, falling back to the Gregorian. */
export function resolveCalendar(system: CalendarSystem, locale: DateLocale): 'gregory' | 'islamic' {
  if (system !== 'auto') return system;
  try {
    const resolved = new Intl.DateTimeFormat(locale).resolvedOptions().calendar ?? '';
    return resolved.startsWith('islamic') ? 'islamic' : 'gregory';
  } catch {
    return 'gregory';
  }
}

/**
 * A date's year, month and day in the given calendar.
 *
 * `formatToParts` rather than a parsed string, because the order and the
 * separators are the locale's business and we only want the numbers. The
 * numbering system is pinned to Latin so the parts come back parseable
 * whatever language is on the device, and so the cells and the caption above
 * them end up in one set of digits.
 */
export function calendarParts(
  date: Date,
  system: 'gregory' | 'islamic',
  locale: DateLocale
): CalendarParts {
  if (system === 'gregory') {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  }
  try {
    const parts = new Intl.DateTimeFormat(`${locale ?? 'en'}-u-ca-islamic-nu-latn`, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date);
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const year = read('year');
    const month = read('month');
    const day = read('day');
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      throw new Error('unusable');
    }
    return { year, month, day };
  } catch {
    // No islamic data in this build. Gregorian is wrong, but it is coherent —
    // the grid, the caption and the cells will at least agree with each other.
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  }
}

export function isSameCalendarMonth(
  a: Date,
  b: Date,
  system: 'gregory' | 'islamic',
  locale: DateLocale
): boolean {
  if (system === 'gregory') return isSameMonth(a, b);
  const one = calendarParts(a, system, locale);
  const two = calendarParts(b, system, locale);
  return one.year === two.year && one.month === two.month;
}

/**
 * The first day of the calendar month `date` falls in.
 *
 * Walked back a day at a time rather than computed. A Hijri month is 29 or 30
 * days depending on the year, and the platform's own calendar data already
 * knows which — stepping until the day number reads 1 asks it, instead of
 * shipping a table that will disagree with the device.
 */
export function startOfCalendarMonth(
  date: Date,
  system: 'gregory' | 'islamic',
  locale: DateLocale
): Date {
  if (system === 'gregory') return startOfMonth(date);
  let cursor = startOfDay(date);
  for (let step = 0; step < 31; step += 1) {
    if (calendarParts(cursor, system, locale).day === 1) return cursor;
    cursor = addDays(cursor, -1);
  }
  return cursor;
}

/** Days in the calendar month `date` falls in. */
export function daysInCalendarMonth(
  date: Date,
  system: 'gregory' | 'islamic',
  locale: DateLocale
): number {
  if (system === 'gregory') return endOfMonth(date).getDate();
  const start = startOfCalendarMonth(date, system, locale);
  for (let length = 28; length <= 31; length += 1) {
    if (calendarParts(addDays(start, length), system, locale).day === 1) return length;
  }
  return 30;
}

/** Page by whole calendar months, forwards or back. */
export function addCalendarMonths(
  date: Date,
  months: number,
  system: 'gregory' | 'islamic',
  locale: DateLocale
): Date {
  if (system === 'gregory') return addMonths(date, months);
  let cursor = startOfCalendarMonth(date, system, locale);
  for (let step = 0; step < Math.abs(months); step += 1) {
    cursor =
      months > 0
        ? // One past the end of this month is the first of the next.
          addDays(cursor, daysInCalendarMonth(cursor, system, locale))
        : // One before the start of this month is somewhere in the previous
          // one, which then gets walked back to its own first day.
          startOfCalendarMonth(addDays(cursor, -1), system, locale);
  }
  return cursor;
}

/** The day-of-month a cell shows. */
export function calendarDayNumber(
  date: Date,
  system: 'gregory' | 'islamic',
  locale: DateLocale
): number {
  return system === 'gregory' ? date.getDate() : calendarParts(date, system, locale).day;
}

/** "Ramadan 1447" or "March 2026", in whichever calendar is in force. */
export function calendarMonthLabel(
  date: Date,
  system: 'gregory' | 'islamic',
  locale: DateLocale
): string {
  if (system === 'gregory') return monthLabel(date, locale);
  return (
    format(date, `${locale ?? 'en'}-u-ca-islamic-nu-latn`, { month: 'long', year: 'numeric' }) ??
    monthLabel(date, locale)
  );
}

/**
 * The names of a calendar's months, in order, for the dropdown.
 *
 * Sampled from a real year in that calendar rather than from twelve Gregorian
 * firsts — the old code did the latter and got twelve arbitrary Hijri names in
 * whatever order the Gregorian 1sts happened to fall, then indexed them by
 * Gregorian month, which meant nothing at all.
 */
export function calendarMonthNames(
  reference: Date,
  system: 'gregory' | 'islamic',
  locale: DateLocale,
  style: 'long' | 'short' = 'short'
): string[] {
  if (system === 'gregory') return monthNames(locale, style);
  const names: string[] = [];
  let cursor = startOfCalendarMonth(reference, system, locale);
  // Back to month 1 of this year, then forward through all twelve.
  cursor = addCalendarMonths(cursor, -(calendarParts(cursor, system, locale).month - 1), system, locale);
  for (let month = 0; month < 12; month += 1) {
    names.push(
      format(cursor, `${locale ?? 'en'}-u-ca-islamic-nu-latn`, { month: style }) ?? String(month + 1)
    );
    cursor = addCalendarMonths(cursor, 1, system, locale);
  }
  return names;
}

/** The whole date read out, in whichever calendar is in force. */
export function calendarLongDate(
  date: Date,
  system: 'gregory' | 'islamic',
  locale: DateLocale
): string {
  if (system === 'gregory') return longDate(date, locale);
  return (
    format(date, `${locale ?? 'en'}-u-ca-islamic-nu-latn`, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }) ?? longDate(date, locale)
  );
}

/** The compact form a trigger shows, in whichever calendar is in force. */
export function calendarShortDate(
  date: Date,
  system: 'gregory' | 'islamic',
  locale: DateLocale
): string {
  if (system === 'gregory') return shortDate(date, locale);
  return (
    format(date, `${locale ?? 'en'}-u-ca-islamic-nu-latn`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }) ?? shortDate(date, locale)
  );
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
    const formatted = formatGregory(new Date(2021, month, 1), locale, { month: style });
    return formatted ?? (style === 'short' ? fallback.slice(0, 3) : fallback);
  });
}

/** Column headings, rotated so the first one is `weekStartsOn`. */
export function weekdayNames(locale: DateLocale, weekStartsOn: number): string[] {
  // 2021-08-01 was a Sunday, so adding the index lands on each weekday in turn.
  return Array.from({ length: 7 }, (_unused, day) => {
    const index = (day + weekStartsOn) % 7;
    const formatted = formatGregory(new Date(2021, 7, 1 + index), locale, { weekday: 'short' });
    return formatted ?? WEEKDAYS_EN[index]!;
  });
}

/** "March 2026", for the caption. */
export function monthLabel(date: Date, locale: DateLocale): string {
  return (
    formatGregory(date, locale, { month: 'long', year: 'numeric' }) ??
    `${MONTHS_EN[date.getMonth()]} ${date.getFullYear()}`
  );
}

/** "12 March 2026" — the whole date, for a screen reader to read out. */
export function longDate(date: Date, locale: DateLocale): string {
  return (
    formatGregory(date, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) ??
    `${WEEKDAYS_EN[date.getDay()]} ${date.getDate()} ${MONTHS_EN[date.getMonth()]} ${date.getFullYear()}`
  );
}

/** "12 Mar 2026" — the compact form a trigger shows. */
export function shortDate(date: Date, locale: DateLocale): string {
  return (
    formatGregory(date, locale, { day: 'numeric', month: 'short', year: 'numeric' }) ??
    `${date.getDate()} ${MONTHS_EN[date.getMonth()]!.slice(0, 3)} ${date.getFullYear()}`
  );
}
