/**
 * DatePicker — a calendar behind a button.
 *
 * ```tsx
 * const [day, setDay] = useState<Date>();
 *
 * <DatePicker selected={day} onSelect={setDay} placeholder="Pick a date" />
 * ```
 *
 * It is the `Calendar` in a `Popover` with a trigger that reads back what was
 * chosen, and it is a separate component from the calendar for the same reason
 * `Select` is separate from a list: the hard parts are the ones around the
 * grid — what a closed field says, when the panel closes, and what a range
 * shows while only half of it has been picked.
 *
 * ## It closes when the selection is finished, not when it changes
 *
 * A single date is done in one tap, so the panel closes on it. A range needs
 * two, so it stays open until the second — closing on the first would put
 * someone back where they started with half a range on screen. Multiple never
 * closes on its own; only the caller knows when a set is complete.
 *
 * ## An anchored panel, not a sheet
 *
 * A month grid is a fixed size that fits beside its trigger on any phone, and
 * a sheet is the right container for a list of unknown length rather than for
 * a shape that is always the same. Pass `presentation="bottom-sheet"` where the
 * screen is busy — a form with the keyboard up is the usual case.
 */
import { useCallback, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { View } from 'react-native';
import { CalendarIcon } from '../../icons';
import { Text } from '../../primitives/text';
import { cn } from '../../utils/cn';
import { shortDate } from '../../utils/date';
import { Button } from '../button';
import {
  Calendar,
  type CalendarCaptionLayout,
  type CalendarDisabled,
  type CalendarMode,
  type CalendarSelection,
  type DateRange,
} from '../calendar';
import { Popover, type PopoverPresentation } from '../popover';

export type DatePickerMode = CalendarMode;

/** What a closed picker shows when nothing has been chosen yet. */
const DEFAULT_PLACEHOLDER = 'Pick a date';

/**
 * The chosen value as one line of text.
 *
 * A half-picked range reads as its start followed by a dash rather than as
 * just the start: the dash is what says the picker is waiting for the other
 * end, and without it a half range looks like a finished single date.
 */
function describe<Mode extends DatePickerMode>(
  mode: Mode,
  value: CalendarSelection[Mode] | undefined,
  locale: string | undefined
): string | null {
  if (!value) return null;

  if (mode === 'range') {
    const range = value as DateRange;
    if (!range.from) return null;
    return range.to
      ? `${shortDate(range.from, locale)} – ${shortDate(range.to, locale)}`
      : `${shortDate(range.from, locale)} –`;
  }

  if (mode === 'multiple') {
    const days = value as Date[];
    if (!days.length) return null;
    if (days.length === 1) return shortDate(days[0]!, locale);
    return `${days.length} dates`;
  }

  return shortDate(value as Date, locale);
}

export interface DatePickerProps<Mode extends DatePickerMode = 'single'> {
  /** One day, several, or a span with two ends. */
  mode?: Mode;
  /** Controlled selection. Its shape follows `mode`. */
  selected?: CalendarSelection[Mode];
  /** Starting selection when uncontrolled. */
  defaultSelected?: CalendarSelection[Mode];
  onSelect?: (selected: CalendarSelection[Mode]) => void;
  /** Controlled open state of the panel. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** What the trigger reads when nothing has been chosen. */
  placeholder?: string;
  /** Override how the chosen value is written on the trigger. */
  format?: (selected: CalendarSelection[Mode]) => string;
  /** Anchored panel, or a sheet from the bottom of the screen. */
  presentation?: PopoverPresentation;
  /** Stop the trigger opening it. */
  disabled?: boolean;
  /** Days that cannot be picked: a list, a span, or a rule. */
  disabledDates?: CalendarDisabled;
  /** Earliest selectable day. */
  minDate?: Date;
  /** Latest selectable day. */
  maxDate?: Date;
  /** Months side by side inside the panel. */
  numberOfMonths?: number;
  /** `dropdown` swaps the month caption for month and year pickers. */
  captionLayout?: CalendarCaptionLayout;
  /** `0` is Sunday. */
  weekStartsOn?: number;
  /** BCP 47 tag for the month and weekday names, and for the trigger's text. */
  locale?: string;
  className?: string;
  /**
   * A trigger of your own. Given one, it is cloned with an `onPress` that opens
   * the panel — so a field row or an icon button can stand in for the default
   * button without this component knowing what either looks like.
   */
  children?: ReactElement<{ onPress?: () => void }> | ReactNode;
}

function DatePickerRoot<Mode extends DatePickerMode = 'single'>({
  mode = 'single' as Mode,
  selected,
  defaultSelected,
  onSelect,
  open: openProp,
  onOpenChange,
  placeholder = DEFAULT_PLACEHOLDER,
  format,
  presentation = 'popover',
  disabled = false,
  disabledDates,
  minDate,
  maxDate,
  numberOfMonths = 1,
  captionLayout = 'label',
  weekStartsOn = 0,
  locale,
  className,
  children,
}: DatePickerProps<Mode>) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [internalSelected, setInternalSelected] = useState<CalendarSelection[Mode] | undefined>(
    defaultSelected
  );

  const isOpenControlled = openProp !== undefined;
  const open = isOpenControlled ? openProp : internalOpen;

  const isControlled = selected !== undefined;
  const value = (isControlled ? selected : internalSelected) as CalendarSelection[Mode];

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isOpenControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isOpenControlled, onOpenChange]
  );

  const handleSelect = useCallback(
    (next: CalendarSelection[Mode]) => {
      if (!isControlled) setInternalSelected(next);
      onSelect?.(next);

      // Done in one tap, so it closes on one. A range waits for its second end,
      // and a set of dates is only the caller's to call finished.
      if (mode === 'single' && next) setOpen(false);
      if (mode === 'range' && (next as DateRange | undefined)?.to) setOpen(false);
    },
    [isControlled, onSelect, mode, setOpen]
  );

  const label = useMemo(() => {
    if (format && value) return format(value);
    return describe(mode, value, locale);
  }, [format, value, mode, locale]);

  const trigger = children ?? (
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
  );

  return (
    <Popover open={open} onOpenChange={setOpen} presentation={presentation}>
      <Popover.Trigger>{trigger as ReactElement<{ onPress?: () => void }>}</Popover.Trigger>
      <Popover.Content className="p-3" width="content-fit">
        <View className="w-[300px]">
          <Calendar
            mode={mode}
            selected={value}
            onSelect={handleSelect}
            disabled={disabledDates}
            minDate={minDate}
            maxDate={maxDate}
            numberOfMonths={numberOfMonths}
            captionLayout={captionLayout}
            weekStartsOn={weekStartsOn}
            locale={locale}
          />
        </View>
      </Popover.Content>
    </Popover>
  );
}
DatePickerRoot.displayName = 'DatePicker';

export const DatePicker = Object.assign(DatePickerRoot, {
  Trigger: Popover.Trigger,
});
