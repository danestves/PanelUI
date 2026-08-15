/**
 * Planner — a month of days, each carrying what falls on it.
 *
 * ```tsx
 * const [month, setMonth] = useState(new Date());
 *
 * <Planner
 *   month={month}
 *   onMonthChange={setMonth}
 *   entries={renewals}
 *   categories={[
 *     { id: 'monthly', label: 'Monthly' },
 *     { id: 'yearly', label: 'Yearly', colorIndex: 4 },
 *   ]}
 * >
 *   <Planner.Header>
 *     <Planner.Title />
 *     <Planner.Today />
 *     <Planner.Nav />
 *   </Planner.Header>
 *   <Planner.Grid />
 *   <Planner.Legend />
 *   <Planner.Details>
 *     {(date, entries) => <Text>{entries.length} on {date.toDateString()}</Text>}
 *   </Planner.Details>
 * </Planner>
 * ```
 *
 * ## How it differs from Calendar
 *
 * `Calendar` picks a date and answers with one. This shows what is already on
 * the days and answers with the day you asked about — the selection exists to
 * open something, not to be submitted.
 *
 * ## Why it draws its own Frame
 *
 * A month at a glance is a widget: a boundary, a strip along the top carrying
 * the month and the way through it, and a footer that holds still while the
 * middle changes. That is `Frame`, so the root renders one instead of leaving
 * every caller to assemble the same shell. Pass `frame={false}` to drop it,
 * for a planner in a sheet or a card that already draws its own edge.
 *
 * ## Why the grid is always six weeks
 *
 * A month can span five weeks or six. Drawn at its natural height the panel
 * jumps as you page through the year and the days appear to move under your
 * thumb, so the grid is always six rows and the last one is sometimes all
 * next month. `Calendar` fixes its height for the same reason.
 *
 * ## Why a day says more than its date
 *
 * The marker on a day is a coloured dot, and colour is a signal that does not
 * reach everyone looking at it. So the legend prints its label beside every
 * swatch, and a day is spoken as its date, how many entries it carries and
 * which categories they belong to. Neither is decoration: between them they
 * are the whole content of the grid for somebody who cannot see it.
 */
import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  AppState,
  Pressable,
  View,
  type ViewProps,
} from 'react-native';
import { tv } from 'tailwind-variants';
import { useCSSVariable } from 'uniwind';
import { ChevronLeftIcon, ChevronRightIcon } from '../../icons';
import { Text, type TextProps } from '../../primitives/text';
import { cn } from '../../utils/cn';
import {
  addCalendarMonths,
  calendarDayNumber,
  calendarLongDate,
  calendarMonthLabel,
  isSameCalendarMonth,
  isSameDay,
  localeWeekStart,
  monthGrid,
  normalizeWeekStart,
  resolveCalendar,
  startOfCalendarMonth,
  startOfDay,
  weekdayNames,
  type CalendarSystem,
  type DateLocale,
} from '../../utils/date';
import { Dialog } from '../dialog';
import { Frame } from '../frame';
import {
  bucketByDay,
  dayAccessibilityLabel,
  entriesOn,
  summariseMonth,
  visibleEntries,
  type PlannerCountedCategory,
} from './planner-entries';

/** How many of a day's entries a cell draws before it stops and counts. */
const DEFAULT_ENTRY_LIMIT = 2;

/** The palette a category takes its dot from when it does not name a colour. */
const PALETTE_SIZE = 5;

const plannerVariants = tv({
  slots: {
    grid: 'gap-1 px-3 pb-3 pt-1',
    week: 'flex-row',
    heading: 'flex-1 text-center',
    legend: 'flex-row flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3',
    swatch: 'h-2 w-2 rounded-full',
  },
});

const dayVariants = tv({
  slots: {
    /*
     * A fixed height, and a square-ish tile rather than a circle.
     *
     * Fixed because the cell has to be the same size whether the day carries
     * anything or not — sized to its contents, a row with one icon in it is
     * taller than the five around it and the grid stops being a grid.
     *
     * Square-ish because a day here holds a number, a marker and sometimes an
     * icon, and a circle wastes the corners it needs for them.
     */
    cell: 'mx-0.5 h-14 flex-1 rounded-xl px-1.5 pt-1.5',
    number: 'text-xs leading-none',
    marker: 'absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full',
    body: 'flex-1 flex-row items-center justify-center gap-0.5 pb-1',
  },
  variants: {
    /** Inside the month being shown, as opposed to the days either side. */
    inMonth: {
      true: { cell: 'bg-muted/40', number: 'text-foreground' },
      false: { cell: 'bg-muted/15', number: 'text-muted-foreground/40' },
    },
    /*
     * Today is the number, not the tile. A ring on today and a ring on the
     * open day are two rings that mean different things and look the same.
     */
    today: { true: { number: 'text-primary font-semibold' } },
    selected: { true: { cell: 'border border-primary/60 bg-primary/10' } },
    disabled: { true: { cell: 'opacity-40' } },
  },
  defaultVariants: { inMonth: true },
});

/* ------------------------------------------------------------------ *
 * Data
 * ------------------------------------------------------------------ */

/** One thing that falls on a day. */
export interface PlannerEntry {
  /** Stable across renders; it keys the cell's contents. */
  id: string;
  /** When it falls. The time of day is kept but not read by the grid. */
  date: Date;
  /** Named in the dialog and, through its category, in the day's spoken label. */
  label: string;
  /** Matches a `PlannerCategory` id. Without one the entry is still counted. */
  category?: string;
  /** Drawn in the cell — a brand mark, an avatar, a glyph. */
  icon?: ReactNode;
}

/** A group of entries: the key to a colour, and a line in the legend. */
export interface PlannerCategory {
  id: string;
  /** Printed beside the swatch, and spoken as part of a day that carries it. */
  label: string;
  /**
   * Which `--color-chart-*` token the dot takes, 1 to 5. Categories without
   * one are numbered in the order they are declared.
   */
  colorIndex?: number;
  /** An explicit colour, for a brand that is not the theme's to choose. */
  color?: string;
}

interface PlannerContextValue {
  month: Date;
  setMonth: (month: Date) => void;
  today: Date;
  selected: Date | null;
  select: (date: Date | null) => void;
  days: Map<number, PlannerEntry[]>;
  categories: PlannerCategory[];
  categoryLabels: Map<string, string>;
  colorOf: (category: string | undefined) => string | undefined;
  summary: { total: number; categories: PlannerCountedCategory[] };
  entryLimit: number;
  weekStartsOn: number;
  grid: Date[][];
  locale: DateLocale;
  system: 'gregory' | 'islamic';
  isInMonth: (date: Date) => boolean;
  renderDay?: PlannerDayRenderer;
  onDayPress?: (date: Date, entries: PlannerEntry[]) => void;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

function usePlanner(component: string): PlannerContextValue {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error(`${component} must be used within a <Planner>`);
  }
  return context;
}

/** Today, recomputed when the app comes back rather than only at mount. */
function useToday(): Date {
  const [today, setToday] = useState(() => startOfDay(new Date()));

  useEffect(() => {
    const refresh = () => {
      const now = startOfDay(new Date());
      // A new object every resume would invalidate every memo below it for a
      // date that has not changed.
      setToday((current) => (current.getTime() === now.getTime() ? current : now));
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, []);

  return today;
}

/**
 * The five series colours, read once.
 *
 * A fixed number of reads rather than one per category: a hook cannot run in a
 * loop whose length is a prop.
 */
function usePalette(): (string | undefined)[] {
  const one = useCSSVariable('--color-chart-1');
  const two = useCSSVariable('--color-chart-2');
  const three = useCSSVariable('--color-chart-3');
  const four = useCSSVariable('--color-chart-4');
  const five = useCSSVariable('--color-chart-5');
  return useMemo(
    () => [one, two, three, four, five].map((v) => (typeof v === 'string' ? v : undefined)),
    [one, two, three, four, five]
  );
}

/* ------------------------------------------------------------------ *
 * Root
 * ------------------------------------------------------------------ */

export interface PlannerProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** The month on show. Leave it out for an uncontrolled planner. */
  month?: Date;
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  /** Everything the planner knows about, in any order and any month. */
  entries?: PlannerEntry[];
  /** The colour key. Declaration order is legend order and palette order. */
  categories?: PlannerCategory[];
  /** The open day. `null` is none. Leave it out for an uncontrolled planner. */
  selected?: Date | null;
  defaultSelected?: Date | null;
  onSelectedChange?: (date: Date | null) => void;
  /** Runs before the selection moves, whether or not `Details` is present. */
  onDayPress?: (date: Date, entries: PlannerEntry[]) => void;
  /** How many entries a cell draws before it counts the rest. Default `2`. */
  entryLimit?: number;
  /** First day of the week, 0 is Sunday. Defaults to the locale's. */
  weekStartsOn?: number | 'auto';
  locale?: DateLocale;
  calendar?: CalendarSystem;
  /** Draw the surrounding `Frame`. Off for a planner in a sheet or a card. */
  frame?: boolean;
  children?: ReactNode;
}

const PlannerRoot = forwardRef<View, PlannerProps>(
  (
    {
      className,
      month: monthProp,
      defaultMonth,
      onMonthChange,
      entries = [],
      categories = [],
      selected: selectedProp,
      defaultSelected = null,
      onSelectedChange,
      onDayPress,
      entryLimit = DEFAULT_ENTRY_LIMIT,
      weekStartsOn = 'auto',
      locale,
      calendar = 'gregory',
      frame = true,
      children,
      ...props
    },
    ref
  ) => {
    const system = resolveCalendar(calendar, locale);
    const palette = usePalette();
    const today = useToday();

    const [internalMonth, setInternalMonth] = useState(() =>
      startOfCalendarMonth(defaultMonth ?? new Date(), system, locale)
    );
    const month = monthProp
      ? startOfCalendarMonth(monthProp, system, locale)
      : internalMonth;

    const setMonth = useCallback(
      (next: Date) => {
        const settled = startOfCalendarMonth(next, system, locale);
        if (!monthProp) setInternalMonth(settled);
        onMonthChange?.(settled);
      },
      [monthProp, onMonthChange, system, locale]
    );

    const [internalSelected, setInternalSelected] = useState<Date | null>(defaultSelected);
    const selected = selectedProp !== undefined ? selectedProp : internalSelected;
    const select = useCallback(
      (date: Date | null) => {
        if (selectedProp === undefined) setInternalSelected(date);
        onSelectedChange?.(date);
      },
      [selectedProp, onSelectedChange]
    );

    const days = useMemo(() => bucketByDay(entries), [entries]);
    const normalizedWeekStart =
      weekStartsOn === 'auto'
        ? localeWeekStart(locale)
        : normalizeWeekStart(weekStartsOn);
    const grid = useMemo(
      () => monthGrid(month, normalizedWeekStart, system, locale),
      [month, normalizedWeekStart, system, locale]
    );

    const isInMonth = useCallback(
      (date: Date) => isSameCalendarMonth(date, month, system, locale),
      [month, system, locale]
    );

    const categoryLabels = useMemo(
      () => new Map(categories.map((category) => [category.id, category.label])),
      [categories]
    );

    const categoryColors = useMemo(
      () => {
        const colors = new Map<string, string | undefined>();
        categories.forEach((category, index) => {
          // `findIndex` used to make the first duplicate id authoritative.
          if (colors.has(category.id)) return;
          const slot = (category.colorIndex ?? index + 1) - 1;
          colors.set(
            category.id,
            category.color ??
              palette[((slot % PALETTE_SIZE) + PALETTE_SIZE) % PALETTE_SIZE]
          );
        });
        return colors;
      },
      [categories, palette]
    );
    const colorOf = useCallback(
      (id: string | undefined) => id ? categoryColors.get(id) : undefined,
      [categoryColors]
    );

    const summary = useMemo(
      () => summariseMonth(days, grid, categories, isInMonth),
      [days, grid, categories, isInMonth]
    );

    /*
     * The month is announced rather than left to the cells. Paging moves 42
     * labels at once and a screen reader reads none of them, so without this
     * the only thing that changes is silent.
     */
    const monthLabel = calendarMonthLabel(month, system, locale);
    useEffect(() => {
      AccessibilityInfo.announceForAccessibility(monthLabel);
    }, [monthLabel]);

    const context = useMemo<PlannerContextValue>(
      () => ({
        month,
        setMonth,
        today,
        selected,
        select,
        days,
        categories,
        categoryLabels,
        colorOf,
        summary,
        entryLimit,
        weekStartsOn: normalizedWeekStart,
        grid,
        locale,
        system,
        isInMonth,
        onDayPress,
      }),
      [
        month, setMonth, today, selected, select, days, categories, categoryLabels,
        colorOf, summary, entryLimit, normalizedWeekStart, grid, locale, system,
        isInMonth, onDayPress,
      ]
    );

    /*
     * The header belongs in the Frame's strip and everything else in its
     * panel, so the root sorts its children rather than asking the caller to
     * nest them in two places to get one widget.
     */
    const parts = Children.toArray(children);
    const header = parts.find(
      (child) => isValidElement(child) && child.type === PlannerHeader
    );
    const body = parts.filter((child) => child !== header);

    return (
      <PlannerContext.Provider value={context}>
        {frame ? (
          // Full width by default: the grid is seven equal columns, and a
          // container that sizes to its content collapses them to the width of
          // a two-digit number.
          <Frame ref={ref} className={cn('w-full', className)} {...props}>
            {header}
            <Frame.Panel dividers={false}>{body}</Frame.Panel>
          </Frame>
        ) : (
          <View ref={ref} className={cn('w-full', className)} {...props}>
            {header}
            {body}
          </View>
        )}
      </PlannerContext.Provider>
    );
  }
);
PlannerRoot.displayName = 'Planner';

/* ------------------------------------------------------------------ *
 * Header strip
 * ------------------------------------------------------------------ */

export interface PlannerHeaderProps {
  children?: ReactNode;
}

/**
 * The strip along the top of the frame. Put `Title`, `Today` and `Nav` in it.
 *
 * The strip has two ends rather than an even spread. What the month *is* —
 * its name, and the way back to today — reads from the leading edge; what
 * *moves* it sits at the trailing edge, under the thumb that reaches for it.
 * Spaced evenly across a full-width strip they read as three unrelated
 * controls instead of a label and a pair of buttons.
 */
function PlannerHeader({ children }: PlannerHeaderProps) {
  const parts = Children.toArray(children);
  const trails = (child: ReactNode) =>
    isValidElement(child) && (child.type === PlannerNav || child.type === PlannerAction);

  const trailing = parts.filter(trails);
  const lead = parts.filter((child) => !trails(child));

  return (
    <Frame.Header>
      <View className="min-w-0 flex-1 flex-row items-center gap-2">{lead}</View>
      {trailing.length > 0 ? (
        <View className="shrink-0 flex-row items-center gap-1.5">{trailing}</View>
      ) : null}
    </Frame.Header>
  );
}
PlannerHeader.displayName = 'Planner.Header';

export interface PlannerTitleProps extends Omit<TextProps, 'children'> {
  /** Replaces the month name, for a title that says something else. */
  children?: ReactNode;
}

/** The month on show, in the calendar system and locale the grid uses. */
function PlannerTitle({ children, className, ...props }: PlannerTitleProps) {
  const { month, system, locale } = usePlanner('Planner.Title');
  return (
    <Text weight="medium" className={cn('text-base', className)} {...props}>
      {children ?? calendarMonthLabel(month, system, locale)}
    </Text>
  );
}
PlannerTitle.displayName = 'Planner.Title';

export interface PlannerTodayProps {
  /** Replaces the word on the pill. */
  children?: ReactNode;
}

/** Jumps back to the month today is in, and selects nothing. */
function PlannerToday({ children = 'Today' }: PlannerTodayProps) {
  const { today, setMonth, month, system, locale } = usePlanner('Planner.Today');
  const alreadyHere = isSameCalendarMonth(today, month, system, locale);

  return (
    <Pressable
      onPress={() => setMonth(today)}
      disabled={alreadyHere}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Go to this month"
      accessibilityState={{ disabled: alreadyHere }}
      className={cn(
        'rounded-full border border-border px-3 py-1',
        alreadyHere ? 'opacity-40' : 'active:bg-accent'
      )}
    >
      <Text size="xs" muted>
        {children}
      </Text>
    </Pressable>
  );
}
PlannerToday.displayName = 'Planner.Today';

export interface PlannerNavProps {
  className?: string;
}

/** Back and forward a month. */
function PlannerNav({ className }: PlannerNavProps) {
  const { month, setMonth, system, locale } = usePlanner('Planner.Nav');

  return (
    <View className={cn('flex-row items-center gap-1', className)}>
      <PlannerArrow
        direction="previous"
        onPress={() => setMonth(addCalendarMonths(month, -1, system, locale))}
      />
      <PlannerArrow
        direction="next"
        onPress={() => setMonth(addCalendarMonths(month, 1, system, locale))}
      />
    </View>
  );
}
PlannerNav.displayName = 'Planner.Nav';

function PlannerArrow({
  direction,
  onPress,
}: {
  direction: 'previous' | 'next';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={direction === 'next' ? 'Next month' : 'Previous month'}
      className="h-8 w-8 items-center justify-center rounded-lg active:bg-accent"
    >
      {direction === 'next' ? <ChevronRightIcon size={18} /> : <ChevronLeftIcon size={18} />}
    </Pressable>
  );
}

export interface PlannerActionProps {
  children?: ReactNode;
}

/** The trailing end of the header strip, for a button of the caller's. */
function PlannerAction({ children }: PlannerActionProps) {
  return <Frame.Action>{children}</Frame.Action>;
}
PlannerAction.displayName = 'Planner.Action';

/* ------------------------------------------------------------------ *
 * Grid
 * ------------------------------------------------------------------ */

/** What a custom cell is handed. Everything the default cell draws from. */
export interface PlannerDayState {
  date: Date;
  entries: PlannerEntry[];
  isToday: boolean;
  isSelected: boolean;
  isInMonth: boolean;
}

export type PlannerDayRenderer = (state: PlannerDayState) => ReactNode;

export interface PlannerGridProps {
  className?: string;
  /** Draws a cell yourself. It is handed the day and what falls on it. */
  renderDay?: PlannerDayRenderer;
}

/**
 * The weekday row and the six weeks below it.
 *
 * React Native has no per-cell grid vocabulary — no `gridcell`, no `row` — so
 * a screen reader never hears "row three, column five" and cannot fall back on
 * position for context. Every day therefore carries its own full date, and the
 * weekday headings are hidden rather than read out 42 times over.
 */
function PlannerGrid({ className, renderDay }: PlannerGridProps) {
  const { grid: weeks, weekStartsOn, locale } = usePlanner('Planner.Grid');
  const { grid, week: weekRow, heading } = plannerVariants();
  const headings = useMemo(
    () => weekdayNames(locale, weekStartsOn),
    [locale, weekStartsOn]
  );

  return (
    <View className={grid({ className })}>
      <View
        className={weekRow()}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {headings.map((label) => (
          <Text key={label} size="xs" muted className={heading()}>
            {label.toUpperCase()}
          </Text>
        ))}
      </View>

      {weeks.map((week, index) => (
        <View key={index} className={weekRow()}>
          {week.map((date) => (
            <PlannerDay key={date.getTime()} date={date} renderDay={renderDay} />
          ))}
        </View>
      ))}
    </View>
  );
}
PlannerGrid.displayName = 'Planner.Grid';

export interface PlannerDayProps {
  date: Date;
  renderDay?: PlannerDayRenderer;
}

/** One cell. Pressing it selects the day and opens whatever is bound to it. */
function PlannerDay({ date, renderDay }: PlannerDayProps) {
  const {
    days, today, selected, select, colorOf, categoryLabels,
    entryLimit, locale, system, isInMonth, onDayPress,
  } = usePlanner('Planner.Day');

  const entries = entriesOn(days, date);
  const inMonth = isInMonth(date);
  const isToday = isSameDay(date, today);
  const isSelected = selected ? isSameDay(date, selected) : false;
  const { shown, overflow } = visibleEntries(entries, entryLimit);
  const drawable = shown.filter((entry) => entry.icon);
  const styles = dayVariants({ inMonth, today: isToday, selected: isSelected });

  const label = dayAccessibilityLabel(
    calendarLongDate(date, system, locale),
    entries,
    categoryLabels
  );

  const press = () => {
    onDayPress?.(date, entries);
    select(date);
  };

  if (renderDay) {
    return (
      <View className="flex-1">
        {renderDay({ date, entries, isToday, isSelected, isInMonth: inMonth })}
      </View>
    );
  }

  return (
    <Pressable
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={entries.length > 0 ? 'Opens what is on this day' : undefined}
      accessibilityState={{ selected: isSelected }}
      className={styles.cell()}
    >
      <Text className={styles.number()}>{calendarDayNumber(date, system, locale)}</Text>

      {entries.length > 0 ? (
        <View className={styles.marker()} style={{ backgroundColor: markerColor(entries, colorOf) }} />
      ) : null}

      {/*
        Only entries that brought an icon are drawn, and the overflow count
        goes with them. A day whose entries have no icons is already saying
        "something is here" with its marker; adding a bare "+3" under an empty
        row says it twice, in a way that looks like a stray number.
      */}
      {drawable.length > 0 ? (
        <View className={styles.body()}>
          {drawable.map((entry) => (
            <View key={entry.id}>{entry.icon}</View>
          ))}
          {overflow > 0 ? (
            <Text size="xs" muted className="leading-none">
              +{overflow}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
PlannerDay.displayName = 'Planner.Day';

/**
 * The dot's colour: the first entry that names a category the planner knows.
 *
 * One dot rather than one per entry. A cell this size fits a row of dots or a
 * day number, and the count is already spoken — so the dot answers "is there
 * anything here, and roughly what kind", which is all it has room to answer.
 */
function markerColor(
  entries: readonly PlannerEntry[],
  colorOf: (category: string | undefined) => string | undefined
): string | undefined {
  for (const entry of entries) {
    const color = colorOf(entry.category);
    if (color) return color;
  }
  return undefined;
}

/* ------------------------------------------------------------------ *
 * Legend and summary
 * ------------------------------------------------------------------ */

export interface PlannerLegendProps {
  className?: string;
  /** Print each category's count for the month beside its label. */
  counts?: boolean;
  /** Sits at the trailing end — a total, a currency, whatever the month adds to. */
  children?: ReactNode;
}

/**
 * The key to the dots.
 *
 * It prints the label beside every swatch, because a column of coloured dots
 * with nothing to read them against is a quiz.
 */
function PlannerLegend({ className, counts = false, children }: PlannerLegendProps) {
  const { summary, colorOf } = usePlanner('Planner.Legend');
  const { legend, swatch } = plannerVariants();

  return (
    <View className={cn(legend(), 'justify-between border-t border-border', className)}>
      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2">
        {summary.categories.map((category) => (
          <View key={category.id} className="flex-row items-center gap-1.5">
            <View
              className={swatch()}
              style={{ backgroundColor: colorOf(category.id) }}
            />
            <Text size="xs" muted>
              {counts ? `${category.label} ${category.count}` : category.label}
            </Text>
          </View>
        ))}
      </View>
      {children}
    </View>
  );
}
PlannerLegend.displayName = 'Planner.Legend';

export interface PlannerSummaryProps extends Omit<TextProps, 'children'> {
  /** Replaces the count, for a total that is money rather than entries. */
  children?: ReactNode;
}

/** What the month adds up to. Counts this month only, never the days either side. */
function PlannerSummary({ children, ...props }: PlannerSummaryProps) {
  const { summary } = usePlanner('Planner.Summary');
  return (
    <Text size="xs" muted {...props}>
      {children ?? `${summary.total} ${summary.total === 1 ? 'entry' : 'entries'}`}
    </Text>
  );
}
PlannerSummary.displayName = 'Planner.Summary';

export interface PlannerFooterProps {
  className?: string;
  children?: ReactNode;
}

/** The strip along the bottom, for tools that act on the month. */
function PlannerFooter({ className, children }: PlannerFooterProps) {
  return (
    <View className={cn('flex-row items-center justify-between gap-3 px-4 py-3', className)}>
      {children}
    </View>
  );
}
PlannerFooter.displayName = 'Planner.Footer';

/* ------------------------------------------------------------------ *
 * Details
 * ------------------------------------------------------------------ */

export interface PlannerDetailsProps {
  className?: string;
  /** Title above the children. Defaults to the day's full date. */
  title?: ReactNode;
  /**
   * The line under the title. Defaults to how many entries the day carries,
   * so the dialog answers "how much of this is there" before it is read.
   * Pass `null` to drop it.
   */
  description?: ReactNode;
  /** Given the open day and what falls on it. */
  children: (date: Date, entries: PlannerEntry[]) => ReactNode;
}

/**
 * A dialog bound to the open day.
 *
 * The planner owns the grid and the binding; what the dialog says is the
 * application's, because the contents of a day are its data and not the
 * component's. Leave it out and `onDayPress` is still called — a planner that
 * pushes a screen instead of opening a dialog wants that and nothing else.
 */
function PlannerDetails({ className, title, description, children }: PlannerDetailsProps) {
  const { selected, select, days, system, locale } = usePlanner('Planner.Details');
  const entries = selected ? entriesOn(days, selected) : [];

  const count =
    entries.length === 1 ? '1 entry' : `${entries.length} entries`;

  return (
    <Dialog open={selected !== null} onOpenChange={(open) => !open && select(null)}>
      <Dialog.Content className={cn('gap-3', className)}>
        <View className="gap-0.5">
          <Dialog.Title>
            {title ?? (selected ? calendarLongDate(selected, system, locale) : '')}
          </Dialog.Title>
          {description === null ? null : (
            <Dialog.Description>
              {description ?? (entries.length === 0 ? 'Nothing planned' : count)}
            </Dialog.Description>
          )}
        </View>
        {selected ? children(selected, entries) : null}
      </Dialog.Content>
    </Dialog>
  );
}
PlannerDetails.displayName = 'Planner.Details';

export const Planner = Object.assign(PlannerRoot, {
  Header: PlannerHeader,
  Title: PlannerTitle,
  Today: PlannerToday,
  Nav: PlannerNav,
  Action: PlannerAction,
  Grid: PlannerGrid,
  Day: PlannerDay,
  Legend: PlannerLegend,
  Summary: PlannerSummary,
  Footer: PlannerFooter,
  Details: PlannerDetails,
});

export type { PlannerCountedCategory };
