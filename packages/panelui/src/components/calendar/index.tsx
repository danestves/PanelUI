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
import {
  addMonths,
  clampDate,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithin,
  longDate,
  monthGrid,
  monthLabel,
  monthNames,
  startOfDay,
  startOfMonth,
  weekdayNames,
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
  ...props
}: CalendarProps<Mode>) {
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
    if (defaultMonth) return startOfMonth(defaultMonth);
    const first =
      value instanceof Date
        ? value
        : Array.isArray(value)
          ? value[0]
          : value && typeof value === 'object' && 'from' in value
            ? (value as DateRange).from
            : undefined;
    return startOfMonth(first ?? new Date());
    // Only the first render decides this; after that the month is its own state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [internalMonth, setInternalMonth] = useState(initialMonth);
  const month = monthProp ? startOfMonth(monthProp) : internalMonth;

  const setMonth = useCallback(
    (next: Date) => {
      const settled = startOfMonth(next);
      if (!monthProp) setInternalMonth(settled);
      onMonthChange?.(settled);
    },
    [monthProp, onMonthChange]
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
    () => ({ month, setMonth, locale, minDate, maxDate, captionLayout }),
    [month, setMonth, locale, minDate, maxDate, captionLayout]
  );

  return (
    <CalendarContext.Provider value={context}>
      <View {...props} className={cn('gap-4', className)}>
        {Array.from({ length: Math.max(1, numberOfMonths) }, (_unused, offset) => (
          <View key={offset} className="gap-2">
            <CalendarCaption offset={offset} lastOffset={numberOfMonths - 1} />
            <CalendarGrid
              month={addMonths(month, offset)}
              mode={mode}
              value={value}
              onSelect={select}
              disabled={disabled}
              minDate={minDate}
              maxDate={maxDate}
              weekStartsOn={weekStartsOn}
              showOutsideDays={showOutsideDays}
              locale={locale}
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
  const { month, setMonth, locale, minDate, maxDate, captionLayout } =
    useCalendar('Calendar.Caption');
  const shown = addMonths(month, offset);

  const canGoBack = !minDate || isBefore(startOfMonth(minDate), startOfMonth(month));
  const canGoForward = !maxDate || isAfter(startOfMonth(maxDate), startOfMonth(shown));

  return (
    <View className="h-9 flex-row items-center justify-between">
      {offset === 0 ? (
        <CalendarNav
          direction="previous"
          disabled={!canGoBack}
          onPress={() => setMonth(addMonths(month, -1))}
        />
      ) : (
        <View className="h-7 w-7" />
      )}

      {captionLayout === 'dropdown' ? (
        <CalendarDropdowns month={shown} offset={offset} />
      ) : (
        <Text weight="semibold">{monthLabel(shown, locale)}</Text>
      )}

      {offset === lastOffset ? (
        <CalendarNav
          direction="next"
          disabled={!canGoForward}
          onPress={() => setMonth(addMonths(month, 1))}
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
 * Month and year as two rows of chips rather than as native pickers.
 *
 * A picker is a platform overlay, and putting one on top of a calendar that is
 * itself already inside a popover is two floating layers deep for choosing a
 * number. Chips stay on the surface the choice is being made on.
 */
function CalendarDropdowns({ month, offset }: { month: Date; offset: number }) {
  const { setMonth, locale, minDate, maxDate } = useCalendar('Calendar.Caption');
  const [open, setOpen] = useState<'month' | 'year' | null>(null);

  const months = monthNames(locale, 'short');
  const thisYear = new Date().getFullYear();
  const firstYear = minDate?.getFullYear() ?? thisYear - 100;
  const lastYear = maxDate?.getFullYear() ?? thisYear + 10;
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_unused, i) => firstYear + i);

  const choose = (next: Date) => {
    setMonth(addMonths(next, -offset));
    setOpen(null);
  };

  return (
    <View className="flex-1 items-center">
      <View className="flex-row items-center gap-1">
        <CaptionChip
          label={months[month.getMonth()]!}
          expanded={open === 'month'}
          onPress={() => setOpen(open === 'month' ? null : 'month')}
        />
        <CaptionChip
          label={String(month.getFullYear())}
          expanded={open === 'year'}
          onPress={() => setOpen(open === 'year' ? null : 'year')}
        />
      </View>

      {open ? (
        <View className="mt-2 max-h-40 w-full flex-row flex-wrap justify-center gap-1 rounded-lg border border-border bg-popover p-2">
          {(open === 'month' ? months : years.map(String)).map((option, index) => {
            const active =
              open === 'month'
                ? index === month.getMonth()
                : years[index] === month.getFullYear();
            return (
              <Pressable
                key={option}
                onPress={() =>
                  choose(
                    open === 'month'
                      ? new Date(month.getFullYear(), index, 1)
                      : new Date(years[index]!, month.getMonth(), 1)
                  )
                }
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={cn(
                  'rounded-md px-2.5 py-1.5',
                  active ? 'bg-primary' : 'active:bg-accent'
                )}
              >
                <Text size="sm" className={active ? 'text-primary-foreground' : undefined}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function CaptionChip({
  label,
  expanded,
  onPress,
}: {
  label: string;
  expanded: boolean;
  onPress: () => void;
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
}: GridProps) {
  const weeks = useMemo(() => monthGrid(month, weekStartsOn), [month, weekStartsOn]);
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
            const outside = !isSameMonth(date, month);
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
      accessibilityLabel={longDate(date, locale)}
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
          {date.getDate()}
        </Text>
      </View>
    </Pressable>
  );
}

export const Calendar = Object.assign(CalendarRoot, {
  Grid: CalendarGrid,
  Day: CalendarDay,
});
