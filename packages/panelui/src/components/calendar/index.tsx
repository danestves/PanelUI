/**
 * Calendar — a month of days, for picking one, several, or a range.
 *
 * ```tsx
 * const [day, setDay] = useState<Date>();
 *
 * <Calendar mode="single" selected={day} onSelect={setDay} />
 * ```
 *
 * ## The grid is always six weeks
 *
 * A month needs five rows or six depending on what day it starts on. Drawing
 * only the rows a month uses makes the calendar change height as it is paged
 * through — everything below it jumps, and the days themselves appear to shift
 * between months. So the grid is six rows always, and the spare cells hold the
 * neighbouring months' days.
 *
 * ## Why a range is drawn in three pieces
 *
 * On the web the band under a selected range is one background with the ends
 * rounded by `:first-child` and `:last-child`. There are no pseudo-classes
 * here, so each day works out for itself whether it is a start, a middle or an
 * end — and, separately, whether it is at the edge of its own row, because a
 * range that runs over a weekend has to close off on Saturday and open again
 * on Sunday rather than trailing into the gap.
 *
 * Every cell therefore draws its band as a view *behind* the number, sized and
 * rounded from those flags, rather than as a background on the cell itself.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, View, type ViewProps } from 'react-native';
import { tv } from 'tailwind-variants';
import { ChevronLeftIcon, ChevronRightIcon } from '../../icons';
import { Text } from '../../primitives/text';
import { cn } from '../../utils/cn';
import { Popover } from '../popover';
import {
  addCalendarMonths,
  addDays,
  calendarDayNumber,
  calendarLongDate,
  calendarMonthLabel,
  calendarMonthNames,
  calendarParts,
  isAfter,
  isBefore,
  isSameCalendarMonth,
  isSameDay,
  isWithin,
  resolveCalendar,
  startOfCalendarMonth,
  startOfDay,
  weekdayNames,
  type CalendarSystem,
  type DateLocale,
} from '../../utils/date';

export type CalendarMode = 'single' | 'multiple' | 'range';
export type CalendarCaptionLayout = 'label' | 'dropdown';

/** A range under construction: `to` is undefined between the two taps. */
export interface DateRange {
  from: Date;
  to?: Date;
}

/**
 * What a `mode` selects. Written as a map so the root, the parts and the
 * caller all read the same association rather than each casting their own way.
 */
export interface CalendarSelection {
  single: Date | undefined;
  multiple: Date[];
  range: DateRange | undefined;
}

/**
 * Which days cannot be picked. A list, a span, or a rule — a rule because
 * "no weekends" and "not in the past" are the two most common cases and
 * neither can be written as a list that stays right tomorrow.
 */
export type CalendarDisabled =
  | Date[]
  | { from: Date; to: Date }
  | ((date: Date) => boolean);

const dayVariants = tv({
  slots: {
    cell: 'flex-1 items-center justify-center',
    /** The range band, drawn behind the number so it can run cell to cell. */
    band: 'absolute inset-y-1',
    /** The circle on a selected day, or the ring on today. */
    disc: 'h-9 w-9 items-center justify-center rounded-full',
    label: '',
  },
  variants: {
    selected: { true: { disc: 'bg-primary', label: 'text-primary-foreground' } },
    today: { true: { disc: 'border border-primary', label: 'text-primary' } },
    outside: { true: { label: 'text-muted-foreground/40' } },
    disabled: { true: { label: 'text-muted-foreground/30' } },
    inRange: { true: { band: 'bg-accent' } },
  },
  compoundVariants: [
    // A selected day inside a range keeps the solid disc; the band passes
    // under it rather than the disc losing to it.
    { selected: true, today: true, class: { label: 'text-primary-foreground' } },
  ],
});

interface CalendarContextValue {
  month: Date;
  setMonth: (month: Date) => void;
  locale: DateLocale;
  /** Already resolved — `auto` is settled once, at the root. */
  system: 'gregory' | 'islamic';
  minDate?: Date;
  maxDate?: Date;
  captionLayout: CalendarCaptionLayout;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

function useCalendar(component: string): CalendarContextValue {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error(`${component} must be used within a <Calendar>`);
  }
  return context;
}

/** Whether a rule, a list or a span rules this day out. */
function isDisabled(
  date: Date,
  disabled: CalendarDisabled | undefined,
  minDate: Date | undefined,
  maxDate: Date | undefined
): boolean {
  if (minDate && isBefore(date, minDate)) return true;
  if (maxDate && isAfter(date, maxDate)) return true;
  if (!disabled) return false;
  if (typeof disabled === 'function') return disabled(date);
  if (Array.isArray(disabled)) return disabled.some((day) => isSameDay(day, date));
  return isWithin(date, disabled.from, disabled.to);
}

export interface CalendarProps<Mode extends CalendarMode = 'single'>
  extends Omit<ViewProps, 'children'> {
  className?: string;
  /** One day, several, or a span with two ends. */
  mode?: Mode;
  /** Controlled selection. Its shape follows `mode`. */
  selected?: CalendarSelection[Mode];
  /** Starting selection when uncontrolled. */
  defaultSelected?: CalendarSelection[Mode];
  onSelect?: (selected: CalendarSelection[Mode]) => void;
  /** Controlled visible month. Any day inside it will do. */
  month?: Date;
  /** Month shown first when uncontrolled. Defaults to the selection, or today. */
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  /** Months side by side. Two is what picking a range across a boundary wants. */
  numberOfMonths?: number;
  /**
   * `dropdown` turns the caption into month and year pickers, which is the
   * difference between choosing a birthday in four taps and in four hundred.
   */
  captionLayout?: CalendarCaptionLayout;
  /** Days that cannot be picked: a list, a span, or a rule. */
  disabled?: CalendarDisabled;
  /** Earliest selectable day. Also stops the caption paging back past it. */
  minDate?: Date;
  /** Latest selectable day. */
  maxDate?: Date;
  /** `0` is Sunday. */
  weekStartsOn?: number;
  /** Draw the neighbouring months' days rather than leaving the cells blank. */
  showOutsideDays?: boolean;
  /** BCP 47 tag for the month and weekday names. The device's own by default. */
  locale?: DateLocale;
  /**
   * Which calendar the months and the day numbers are counted in.
   *
   * `gregory` by default rather than `auto`: a grid whose month boundaries move
   * with the device's language is a surprise, and it is the caller — not the
   * locale — who knows whether the dates being picked are Hijri ones. `auto`
   * follows the locale for the cases where they are the same question.
   */
  calendar?: CalendarSystem;
}

function CalendarRoot<Mode extends CalendarMode = 'single'>({
  className,
  mode = 'single' as Mode,
  selected,
  defaultSelected,
  onSelect,
  month: monthProp,
  defaultMonth,
  onMonthChange,
  numberOfMonths = 1,
  captionLayout = 'label',
  disabled,
  minDate,
  maxDate,
  weekStartsOn = 0,
  showOutsideDays = true,
  locale,
  calendar = 'gregory',
  ...props
}: CalendarProps<Mode>) {
  // Settled once here rather than at each call site, so every part of the
  // grid is certainly reading the same calendar.
  const system = useMemo(() => resolveCalendar(calendar, locale), [calendar, locale]);
  const [internalSelected, setInternalSelected] = useState<CalendarSelection[Mode] | undefined>(
    defaultSelected
  );
  const isControlled = selected !== undefined;
  const value = (isControlled ? selected : internalSelected) as CalendarSelection[Mode];

  /**
   * The month to open on: whatever is selected, so a picker reopened on a date
   * chosen last year does not land on today and make it look unselected.
   */
  const initialMonth = useMemo(() => {
    if (defaultMonth) return startOfCalendarMonth(defaultMonth, system, locale);
    const first =
      value instanceof Date
        ? value
        : Array.isArray(value)
          ? value[0]
          : value && typeof value === 'object' && 'from' in value
            ? (value as DateRange).from
            : undefined;
    return startOfCalendarMonth(first ?? new Date(), system, locale);
    // Only the first render decides this; after that the month is its own state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [internalMonth, setInternalMonth] = useState(initialMonth);
  const month = monthProp ? startOfCalendarMonth(monthProp, system, locale) : internalMonth;

  const setMonth = useCallback(
    (next: Date) => {
      const settled = startOfCalendarMonth(next, system, locale);
      if (!monthProp) setInternalMonth(settled);
      onMonthChange?.(settled);
    },
    [monthProp, onMonthChange, system, locale]
  );

  const commit = useCallback(
    (next: CalendarSelection[Mode]) => {
      if (!isControlled) setInternalSelected(next);
      onSelect?.(next);
    },
    [isControlled, onSelect]
  );

  const select = useCallback(
    (date: Date) => {
      const day = startOfDay(date);

      if (mode === 'multiple') {
        const current = (value as Date[] | undefined) ?? [];
        const without = current.filter((picked) => !isSameDay(picked, day));
        const next = without.length === current.length ? [...current, day] : without;
        commit(next as CalendarSelection[Mode]);
        return;
      }

      if (mode === 'range') {
        const current = value as DateRange | undefined;
        /*
         * Three states, not two: no range, half a range, a whole range. A tap
         * with half a range open closes it — unless it landed before the open
         * end, in which case it becomes the new start. Anything else would ask
         * someone who picked the wrong month first to undo before retrying.
         */
        if (!current || current.to || isBefore(day, current.from)) {
          commit({ from: day } as CalendarSelection[Mode]);
        } else {
          commit({ from: current.from, to: day } as CalendarSelection[Mode]);
        }
        return;
      }

      // Single. Tapping the selected day again clears it.
      const current = value as Date | undefined;
      commit((isSameDay(current, day) ? undefined : day) as CalendarSelection[Mode]);
    },
    [mode, value, commit]
  );

  const context = useMemo(
    () => ({ month, setMonth, locale, system, minDate, maxDate, captionLayout }),
    [month, setMonth, locale, system, minDate, maxDate, captionLayout]
  );

  return (
    <CalendarContext.Provider value={context}>
      <View {...props} className={cn('gap-4', className)}>
        {Array.from({ length: Math.max(1, numberOfMonths) }, (_unused, offset) => (
          <View key={offset} className="gap-2">
            <CalendarCaption offset={offset} lastOffset={numberOfMonths - 1} />
            <CalendarGrid
              month={addCalendarMonths(month, offset, system, locale)}
              mode={mode}
              value={value}
              onSelect={select}
              disabled={disabled}
              minDate={minDate}
              maxDate={maxDate}
              weekStartsOn={weekStartsOn}
              showOutsideDays={showOutsideDays}
              locale={locale}
              system={system}
            />
          </View>
        ))}
      </View>
    </CalendarContext.Provider>
  );
}
CalendarRoot.displayName = 'Calendar';

/* -------------------------------------------------------------------------- */
/* Caption                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The month name and the arrows, or the month and year pickers.
 *
 * With several months shown the arrows are split across the row — back on the
 * first, forward on the last — because both sets on both captions would page
 * the whole run and give two ways to do one thing.
 */
function CalendarCaption({ offset, lastOffset }: { offset: number; lastOffset: number }) {
  const { month, setMonth, locale, system, minDate, maxDate, captionLayout } =
    useCalendar('Calendar.Caption');
  const shown = addCalendarMonths(month, offset, system, locale);

  const canGoBack =
    !minDate || isBefore(startOfCalendarMonth(minDate, system, locale), month);
  const canGoForward =
    !maxDate || isAfter(startOfCalendarMonth(maxDate, system, locale), shown);

  return (
    <View className="h-9 flex-row items-center justify-between">
      {offset === 0 ? (
        <CalendarNav
          direction="previous"
          disabled={!canGoBack}
          onPress={() => setMonth(addCalendarMonths(month, -1, system, locale))}
        />
      ) : (
        <View className="h-7 w-7" />
      )}

      {captionLayout === 'dropdown' ? (
        <CalendarDropdowns month={shown} offset={offset} />
      ) : (
        <Text weight="semibold">{calendarMonthLabel(shown, system, locale)}</Text>
      )}

      {offset === lastOffset ? (
        <CalendarNav
          direction="next"
          disabled={!canGoForward}
          onPress={() => setMonth(addCalendarMonths(month, 1, system, locale))}
        />
      ) : (
        <View className="h-7 w-7" />
      )}
    </View>
  );
}

function CalendarNav({
  direction,
  disabled,
  onPress,
}: {
  direction: 'previous' | 'next';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={direction === 'next' ? 'Next month' : 'Previous month'}
      accessibilityState={{ disabled }}
      className={cn(
        'h-7 w-7 items-center justify-center rounded-md border border-border',
        disabled ? 'opacity-40' : 'active:bg-accent'
      )}
    >
      {direction === 'next' ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
    </Pressable>
  );
}

/**
 * Month and year as chips that open a panel of options.
 *
 * The panel floats rather than opening in place, and the caption is the reason:
 * it is a fixed-height row, so a list opened inside it has nowhere to go and
 * spills over the grid below. A popover is laid out against the chip and
 * clamped to the screen, which is the behaviour this needs and already has.
 *
 * Native pickers are still the wrong tool — a platform overlay on top of a
 * calendar that is itself already in a popover is two floating layers deep for
 * choosing a number, and it cannot show a Hijri year at all.
 */
function CalendarDropdowns({ month, offset }: { month: Date; offset: number }) {
  const { setMonth, locale, system, minDate, maxDate } = useCalendar('Calendar.Caption');

  /*
   * Everything here counts in the calendar on screen, not in the platform's.
   * The names come from a real year of that calendar rather than from twelve
   * Gregorian firsts, and the year list is that calendar's years — a Hijri
   * caption offering Gregorian years is choosing from the wrong set.
   */
  const months = useMemo(
    () => calendarMonthNames(month, system, locale, 'short'),
    [month, system, locale]
  );
  const current = calendarParts(month, system, locale);
  const bounds = {
    from: minDate ? calendarParts(minDate, system, locale).year : current.year - 100,
    to: maxDate ? calendarParts(maxDate, system, locale).year : current.year + 10,
  };
  /*
   * Newest first, because the list is long — a century by default, and longer
   * against a `minDate` — and a list that opens at its far end is showing the
   * one year nobody came to pick. Counting down puts the years in reach at the
   * top, which for the case this exists for, a birthday against a `maxDate` of
   * today, is exactly where the wanted one is.
   */
  const years = Array.from(
    { length: Math.max(1, bounds.to - bounds.from + 1) },
    (_unused, index) => bounds.to - index
  );

  /*
   * Navigated by months rather than by building a date, because there is no
   * `new Date(hijriYear, hijriMonth)`. A Hijri year is always twelve months,
   * so a year jump is twelve of them.
   */
  const choose = (months_: number) => {
    setMonth(addCalendarMonths(month, months_ - offset, system, locale));
  };

  return (
    <View className="flex-1 flex-row items-center justify-center gap-1">
      <CaptionDropdown
        label={months[current.month - 1] ?? String(current.month)}
        options={months}
        active={current.month - 1}
        onSelect={(index) => choose(index - (current.month - 1))}
      />
      <CaptionDropdown
        label={String(current.year)}
        options={years.map(String)}
        active={years.indexOf(current.year)}
        onSelect={(index) => choose((years[index]! - current.year) * 12)}
        // Twelve months fit in the panel; a century of years does not.
        scrollable
      />
    </View>
  );
}

/** The panel's width, and so how many chips a row of it holds. */
const DROPDOWN_WIDTH = 264;

/** One chip and the options it opens. */
function CaptionDropdown({
  label,
  options,
  active,
  onSelect,
  scrollable = false,
}: {
  label: string;
  options: string[];
  /** Index of the option currently in the caption, or -1 for none. */
  active: number;
  onSelect: (index: number) => void;
  scrollable?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger>
        <CaptionChip label={label} expanded={open} />
      </Popover.Trigger>
      {/*
        The panel is capped and scrolled by the popover itself, against the room
        actually on screen rather than a fixed number — the cap has to be the
        one that knows where the chip ended up.
      */}
      <Popover.Content
        align="center"
        width={DROPDOWN_WIDTH}
        scrollable={scrollable}
        className="p-2"
      >
        <View className="flex-row flex-wrap justify-center gap-1">
          {options.map((option, index) => {
            const selected = index === active;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  onSelect(index);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={cn(
                  'rounded-md px-2.5 py-1.5',
                  selected ? 'bg-primary' : 'active:bg-accent'
                )}
              >
                <Text size="sm" className={selected ? 'text-primary-foreground' : undefined}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Popover.Content>
    </Popover>
  );
}

function CaptionChip({
  label,
  expanded,
  onPress,
}: {
  label: string;
  expanded: boolean;
  /** Supplied by `Popover.Trigger`, which clones this to open the panel. */
  onPress?: (...args: unknown[]) => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      className="flex-row items-center gap-1 rounded-md px-2 py-1 active:bg-accent"
    >
      <Text weight="semibold">{label}</Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Grid                                                                       */
/* -------------------------------------------------------------------------- */

interface GridProps {
  month: Date;
  mode: CalendarMode;
  value: unknown;
  onSelect: (date: Date) => void;
  disabled?: CalendarDisabled;
  minDate?: Date;
  maxDate?: Date;
  weekStartsOn: number;
  showOutsideDays: boolean;
  locale: DateLocale;
  system: 'gregory' | 'islamic';
}

function CalendarGrid({
  month,
  mode,
  value,
  onSelect,
  disabled,
  minDate,
  maxDate,
  weekStartsOn,
  showOutsideDays,
  locale,
  system,
}: GridProps) {
  /*
   * Six rows of consecutive days, anchored on the first of *this* calendar's
   * month. Weekdays are shared between the two calendars — only the month
   * boundaries and the day numbers differ — so the walk itself is the same
   * either way and only where it starts moves.
   */
  const weeks = useMemo(() => {
    const first = startOfCalendarMonth(month, system, locale);
    const lead = (first.getDay() - weekStartsOn + 7) % 7;
    const start = addDays(first, -lead);
    return Array.from({ length: 6 }, (_unusedWeek, week) =>
      Array.from({ length: 7 }, (_unusedDay, day) => addDays(start, week * 7 + day))
    );
  }, [month, weekStartsOn, system, locale]);
  const headings = useMemo(() => weekdayNames(locale, weekStartsOn), [locale, weekStartsOn]);
  const today = startOfDay(new Date());

  const range = mode === 'range' ? (value as DateRange | undefined) : undefined;
  const multiple = mode === 'multiple' ? ((value as Date[] | undefined) ?? []) : [];
  const single = mode === 'single' ? (value as Date | undefined) : undefined;

  return (
    // React Native has no `grid` role, so the month announces itself as a list
    // of days and each day carries its own full date as its label.
    <View accessibilityRole="list" className="gap-1">
      <View className="flex-row">
        {headings.map((heading) => (
          <Text key={heading} size="xs" muted className="flex-1 text-center">
            {heading}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} className="flex-row">
          {week.map((date, dayIndex) => {
            const outside = !isSameCalendarMonth(date, month, system, locale);
            if (outside && !showOutsideDays) {
              // A spacer, not nothing: the row has to stay seven wide or the
              // columns stop lining up with their headings.
              return <View key={dayIndex} className="h-10 flex-1" />;
            }

            const selected =
              mode === 'range'
                ? isSameDay(date, range?.from) || isSameDay(date, range?.to)
                : mode === 'multiple'
                  ? multiple.some((picked) => isSameDay(picked, date))
                  : isSameDay(date, single);

            // Between the ends, but not an end itself — the band, not the disc.
            const inRange =
              !!range?.to && isWithin(date, range.from, range.to) && !selected;

            return (
              <CalendarDay
                key={dayIndex}
                date={date}
                outside={outside}
                selected={selected}
                inRange={inRange}
                today={isSameDay(date, today)}
                disabled={isDisabled(date, disabled, minDate, maxDate)}
                // The band closes off at the edges of a row rather than
                // trailing into the gap between weeks.
                openStart={inRange && dayIndex > 0}
                openEnd={inRange && dayIndex < 6}
                locale={locale}
                system={system}
                onPress={() => onSelect(date)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

interface DayProps {
  date: Date;
  outside: boolean;
  selected: boolean;
  inRange: boolean;
  today: boolean;
  disabled: boolean;
  openStart: boolean;
  openEnd: boolean;
  locale: DateLocale;
  system: 'gregory' | 'islamic';
  onPress: () => void;
}

function CalendarDay({
  date,
  outside,
  selected,
  inRange,
  today,
  disabled,
  openStart,
  openEnd,
  locale,
  system,
  onPress,
}: DayProps) {
  const styles = dayVariants({
    selected,
    today: today && !selected,
    outside,
    disabled,
    inRange,
  });

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={calendarLongDate(date, system, locale)}
      accessibilityState={{ selected, disabled }}
      className={cn(styles.cell(), 'h-10')}
    >
      {inRange ? (
        <View
          className={cn(styles.band())}
          style={{
            left: openStart ? 0 : '10%',
            right: openEnd ? 0 : '10%',
            borderTopLeftRadius: openStart ? 0 : 999,
            borderBottomLeftRadius: openStart ? 0 : 999,
            borderTopRightRadius: openEnd ? 0 : 999,
            borderBottomRightRadius: openEnd ? 0 : 999,
          }}
        />
      ) : null}
      <View className={cn(styles.disc())}>
        <Text size="sm" className={cn(styles.label())}>
          {calendarDayNumber(date, system, locale)}
        </Text>
      </View>
    </Pressable>
  );
}

export const Calendar = Object.assign(CalendarRoot, {
  Grid: CalendarGrid,
  Day: CalendarDay,
});
