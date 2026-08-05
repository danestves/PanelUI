/**
 * DateTimePicker — a day and a time of day, picked in one panel.
 *
 * ```tsx
 * const [when, setWhen] = useState<Date>();
 *
 * <DateTimePicker value={when} onValueChange={setWhen} />
 * ```
 *
 * ## Why it is one component and not two side by side
 *
 * A date field beside a time field is two decisions the reader has to make
 * separately and then hold together — and the two halves can disagree, which is
 * how a booking ends up on the right day at a time that has already passed. Here
 * the calendar and the scale are the same panel over one `Date`, so what is on
 * screen is the answer rather than two thirds of it.
 *
 * The layout follows from that: the calendar is the coarse choice and takes the
 * room, the time sits under it behind a hairline, and one Done finishes both.
 * The panel is a fixed width, which is what lets the two halves line up — a
 * month grid and a time scale that measured themselves independently would be
 * two boxes of slightly different widths stacked on each other.
 *
 * ## It does not close on the date
 *
 * `DatePicker` closes as soon as a single day is tapped, because at that point
 * there is nothing left to say. Here there is: the day is half the value, and
 * closing on it would hide the other half at the moment it became relevant. So
 * the panel stays until Done, in every presentation including the popover — the
 * one place `DatePicker` has no Done button at all.
 *
 * ## The time face
 *
 * `ruler` by default rather than the wheel. Under a month grid the panel is
 * already tall, and the wheel is five rows of it; the ruler is one readout over
 * a scale, reads at arm's length, and is the one face that fits under a calendar
 * without the whole thing needing to scroll. The other two are a prop away.
 *
 * ## Picking the time before the day
 *
 * Allowed, and it means today. There has to be *some* day for a time to be a
 * `Date` at all, and the day the reader is looking at is the only defensible
 * guess — the alternative is refusing to emit a value until both halves have
 * been touched, which is a form that silently does nothing when you use it in
 * the order it did not expect.
 */
import {
  useCallback,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import { CalendarIcon } from '../../icons';
import { Text } from '../../primitives/text';
import { cn } from '../../utils/cn';
import { calendarShortDate, resolveCalendar, type CalendarSystem } from '../../utils/date';
import {
  clampTime,
  formatTime,
  roundToStep,
  timeFromDate,
  timeToDate,
  type HourCycle,
  type TimeValue,
} from '../../utils/time';
import { Button } from '../button';
import { Calendar, type CalendarCaptionLayout, type CalendarDisabled } from '../calendar';
import { Dialog } from '../dialog';
import { Popover } from '../popover';
import { TimePicker, type TimePickerLayout } from '../time-picker';

/** What a closed picker shows when nothing has been chosen yet. */
const DEFAULT_PLACEHOLDER = 'Pick a date and time';

/**
 * The width both halves are laid out at.
 *
 * Fixed rather than measured, and shared, because that is the whole reason they
 * read as one panel: a month grid and a time scale each sized to their own
 * content are two boxes of slightly different widths stacked on each other, and
 * the seam is visible at any size.
 */
const PANEL_WIDTH = 308;

/** How a `Date` is written on the closed trigger. */
function describe(
  value: Date,
  system: 'gregory' | 'islamic',
  hourCycle: HourCycle,
  locale: string | undefined
): string {
  const day = calendarShortDate(value, system, locale);
  const time = formatTime(timeFromDate(value), { hourCycle, locale });
  return `${day} · ${time}`;
}

/** Where the panel is shown. `inline` renders it bare, for a Frame or a form. */
export type DateTimePickerPresentation = 'popover' | 'bottom-sheet' | 'dialog' | 'inline';

export interface DateTimePickerProps {
  /** Controlled value. One `Date` carrying both halves. */
  value?: Date;
  /** Starting value when uncontrolled. */
  defaultValue?: Date;
  /**
   * Fires on every change to either half, not on Done. Done closes the panel;
   * it does not decide anything the caller has not already been told.
   */
  onValueChange?: (value: Date) => void;
  /** Which face the time is picked on. `ruler` is the one that fits here. */
  layout?: TimePickerLayout;
  /** Anchored panel, a sheet, a dialog, or the panel with nothing around it. */
  presentation?: DateTimePickerPresentation;
  /** Controlled open state of the panel. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** `12` shows a meridiem, `24` does not. The value is 24-hour either way. */
  hourCycle?: HourCycle;
  /** Minutes between one selectable time and the next. */
  minuteStep?: number;
  /** Earliest selectable time of day, inclusive. */
  minTime?: TimeValue;
  /** Latest selectable time of day, inclusive. */
  maxTime?: TimeValue;
  /** What the trigger reads when nothing has been chosen. */
  placeholder?: string;
  /** Override how the chosen value is written on the trigger. */
  format?: (value: Date) => string;
  /** Stop the trigger opening it, and the panel from being used. */
  disabled?: boolean;
  /** Days that cannot be picked: a list, a span, or a rule. */
  disabledDates?: CalendarDisabled;
  /** Earliest selectable day. */
  minDate?: Date;
  /** Latest selectable day. */
  maxDate?: Date;
  /** `dropdown` swaps the month caption for month and year pickers. */
  captionLayout?: CalendarCaptionLayout;
  /** `0` is Sunday. */
  weekStartsOn?: number;
  /** BCP 47 tag for the month names, the time and the trigger's own text. */
  locale?: string;
  /** Which calendar the months and day numbers are counted in. */
  calendar?: CalendarSystem;
  /** Label on the button that closes the panel. */
  doneLabel?: string;
  className?: string;
  /**
   * A trigger of your own. Given one, it is cloned with an `onPress` that opens
   * the panel — so a field row or an icon button can stand in for the default
   * button without this component knowing what either looks like.
   *
   * Ignored by `presentation="inline"`, which has no trigger.
   */
  children?: ReactElement<{ onPress?: () => void }> | ReactNode;
}

function DateTimePickerRoot({
  value: valueProp,
  defaultValue,
  onValueChange,
  layout = 'ruler',
  presentation = 'popover',
  open: openProp,
  onOpenChange,
  hourCycle = 12,
  minuteStep,
  minTime,
  maxTime,
  placeholder = DEFAULT_PLACEHOLDER,
  format,
  disabled = false,
  disabledDates,
  minDate,
  maxDate,
  captionLayout = 'label',
  weekStartsOn = 0,
  locale,
  calendar = 'gregory',
  doneLabel = 'Done',
  className,
  children,
}: DateTimePickerProps) {
  // Resolved here as well as in the grid, because the trigger's text has to be
  // written in the same calendar the cells were tapped in.
  const system = useMemo(() => resolveCalendar(calendar, locale), [calendar, locale]);

  const [internalValue, setInternalValue] = useState<Date | undefined>(defaultValue);
  const [internalOpen, setInternalOpen] = useState(false);

  const isValueControlled = valueProp !== undefined;
  const isOpenControlled = openProp !== undefined;
  const value = isValueControlled ? valueProp : internalValue;
  const open = isOpenControlled ? openProp : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isOpenControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isOpenControlled, onOpenChange]
  );

  const commit = useCallback(
    (next: Date) => {
      if (!isValueControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [isValueControlled, onValueChange]
  );

  /*
   * The time half, kept separately as well as inside the value.
   *
   * The value cannot hold it on its own: before a day is picked there is no
   * `Date` to put a time in, and a time chosen first would be dropped on the
   * way to the calendar. Held here, the two halves can be filled in either
   * order and neither one loses the other.
   */
  const [draftTime, setDraftTime] = useState<TimeValue | undefined>(
    defaultValue ? timeFromDate(defaultValue) : undefined
  );
  const time = value ? timeFromDate(value) : draftTime;

  /** The time a day picked on its own is given: the top of the current hour. */
  const fallbackTime = useMemo(
    () =>
      clampTime(
        roundToStep({ hour: new Date().getHours(), minute: 0 }, minuteStep ?? 15),
        minTime,
        maxTime
      ),
    [minuteStep, minTime, maxTime]
  );

  const handleDay = useCallback(
    (day: Date | undefined) => {
      if (!day) return;
      commit(timeToDate(time ?? fallbackTime, day));
    },
    [commit, time, fallbackTime]
  );

  const handleTime = useCallback(
    (next: TimeValue) => {
      setDraftTime(next);
      // No day yet means today: a time is not a `Date` without one, and the day
      // the reader is looking at is the only defensible guess.
      commit(timeToDate(next, value ?? new Date()));
    },
    [commit, value]
  );

  const label = useMemo(() => {
    if (!value) return null;
    if (format) return format(value);
    return describe(value, system, hourCycle, locale);
  }, [format, value, system, hourCycle, locale]);

  const panel = (
    <View
      style={{ width: PANEL_WIDTH, maxWidth: '100%' }}
      className={cn('self-center', presentation === 'inline' ? className : undefined)}
    >
      {/*
        Unbordered: the panel around it already draws one, and a card inside a
        card is a seam. The calendar frames itself only when it is standing on
        a page.
      */}
      <Calendar
        bordered={false}
        mode="single"
        selected={value}
        onSelect={handleDay}
        disabled={disabledDates}
        minDate={minDate}
        maxDate={maxDate}
        startMonth={minDate}
        endMonth={maxDate}
        captionLayout={captionLayout}
        weekStartsOn={weekStartsOn}
        locale={locale}
        calendar={calendar}
      />
      {/* A hairline, not a gap. The two halves are one answer, and space alone
          between them reads as two controls that happen to be stacked. */}
      <View className="mt-1 border-t border-border pt-3">
        <TimePicker
          presentation="inline"
          layout={layout}
          value={time}
          onValueChange={handleTime}
          hourCycle={hourCycle}
          minuteStep={minuteStep}
          minTime={minTime}
          maxTime={maxTime}
          locale={locale}
          disabled={disabled}
        />
      </View>
    </View>
  );

  if (presentation === 'inline') return panel;

  const trigger = (
    children ?? (
      <Button
        variant="outline"
        disabled={disabled}
        className={cn('justify-start gap-2', className)}
      >
        <CalendarIcon size={16} />
        <Text className={label ? undefined : 'text-muted-foreground'}>
          {label ?? placeholder}
        </Text>
      </Button>
    )
  ) as ReactElement<{ onPress?: () => void }>;

  if (presentation === 'dialog') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <Dialog.Trigger>{trigger}</Dialog.Trigger>
        {/* Blurred rather than dimmed: a dialog is what you reach for when the
            appointment *is* the decision on the screen. */}
        <Dialog.Content blur className="items-center gap-0 p-4">
          {panel}
          <Dialog.Close>
            <Button className="mt-3 w-full">{doneLabel}</Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog>
    );
  }

  const isSheet = presentation === 'bottom-sheet';

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      presentation={isSheet ? 'bottom-sheet' : 'popover'}
    >
      <Popover.Trigger>{trigger}</Popover.Trigger>
      {/* The padding is on the inner view, not the panel: in sheet mode a
          className on the panel is merged into the sheet's own padding and
          would replace it. */}
      <Popover.Content width={isSheet ? 'full' : 'content-fit'}>
        <View className={isSheet ? 'w-full pb-2' : 'p-3'}>
          {panel}
          {/*
            A Done button in the popover too, which `DatePicker` does not have.
            There it is unnecessary — a single date finishes itself, and the
            panel closes on the tap. Here the date is half the value, so
            something has to say when both halves are settled, and tapping
            outside is not that: it is how a popover is *abandoned*.
          */}
          <Popover.Close>
            <Button className={cn('mt-3 w-full self-center', !isSheet && 'max-w-[308px]')}>
              {doneLabel}
            </Button>
          </Popover.Close>
        </View>
      </Popover.Content>
    </Popover>
  );
}
DateTimePickerRoot.displayName = 'DateTimePicker';

export const DateTimePicker = Object.assign(DateTimePickerRoot, {
  Trigger: Popover.Trigger,
});
