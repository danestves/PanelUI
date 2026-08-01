/**
 * TimePicker — a time of day behind a trigger, in one of three faces.
 *
 * ```tsx
 * const [time, setTime] = useState<TimeValue>();
 *
 * <TimePicker value={time} onValueChange={setTime} />
 * ```
 *
 * The value is `{ hour, minute }` on a 24-hour clock, whatever the face shows.
 * A 12-hour display is a rendering choice; storing 7pm as `{ hour: 7 }` plus a
 * meridiem flag would put the flag into every comparison downstream.
 *
 * ## Three layouts, because "pick a time" is three different tasks
 *
 * - **`wheel`** — hour, minute and meridiem as snapping columns. The precise
 *   one: any minute in the day is two or three flicks away. The default.
 * - **`clock`** — a face beside a list of times at a fixed step. For picking a
 *   *slot* rather than a time — a booking, a reminder, an appointment — where
 *   the face answers "is that morning or evening?" faster than reading digits.
 * - **`ruler`** — one large readout over a swipeable scale. The coarse one, and
 *   the only one that reads at arm's length, so it is the one for a sheet with
 *   a thumb on it.
 *
 * All three produce the same value and take the same props. Swapping between
 * them is a one-word change, which is the point of them being one component.
 *
 * ## Presentation is separate from layout
 *
 * `popover`, `dialog` and `bottom-sheet` wrap the same panel; `inline` renders
 * it bare, for composing into a Frame or a form. Popover and sheet hand off to
 * `Popover`, which already owns both — but `Popover` has no dialog form, so
 * the switch lives here rather than being pushed down into it. A picker is
 * also the wrong place to widen a general-purpose overlay: the three shapes
 * differ in how they are *dismissed*, not in what they contain.
 *
 * ## Scroll offset, not gesture maths
 *
 * The wheel, the clock's list and the ruler are all scroll views with
 * `snapToOffsets`, and the selection is `Math.round(offset / itemSize)`. That
 * buys momentum, deceleration, edge bounce and platform-correct fling physics
 * for nothing, and none of it would be worth rebuilding on a pan gesture. The
 * per-item fade and the ruler's readout follow the offset on the UI thread, so
 * scrolling never round-trips through React — only the settled value does.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { tv } from 'tailwind-variants';
import { ClockIcon } from '../../icons';
import { Text } from '../../primitives/text';
import { cn } from '../../utils/cn';
import { selectionTick } from '../../utils/haptics';
import {
  clampTime,
  displayHour,
  formatTime,
  hourFromDisplay,
  isSameTime,
  meridiemLabels,
  meridiemOf,
  padTwo,
  roundToStep,
  timeToMinutes,
  timesOfDay,
  type HourCycle,
  type TimeValue,
} from '../../utils/time';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { Popover } from '../popover';

export type { HourCycle, TimeValue };

/** Which face the panel draws. */
export type TimePickerLayout = 'wheel' | 'clock' | 'ruler';

/** How the panel gets onto the screen. */
export type TimePickerPresentation = 'popover' | 'dialog' | 'bottom-sheet' | 'inline';

/** What a closed picker reads when nothing has been chosen. */
const DEFAULT_PLACEHOLDER = 'Choose a time';

/** Row height in every scrolling column. Big enough to hit, small enough to see five. */
const ROW_HEIGHT = 44;
/** Rows visible in a column. Odd, so one of them is the centre. */
const VISIBLE_ROWS = 5;
const COLUMN_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;

/** Distance between two ruler ticks. */
const TICK_SPACING = 12;

/** Settles the clock hands after a pick. Slow enough to be followed by eye. */
const HAND_SPRING = { damping: 16, stiffness: 140, mass: 0.7 } as const;

const timePickerVariants = tv({
  slots: {
    panel: 'gap-3',
    /* The columns and the highlight are stacked, so the pill is drawn once by
       the container rather than once per column — three separately positioned
       pills cannot be kept flush with each other across a rounding boundary. */
    wheel: 'relative flex-row items-stretch justify-center',
    highlight: 'absolute inset-x-0 rounded-xl bg-muted',
    column: 'flex-1',
    row: 'items-center justify-center',
    rowLabel: 'text-lg tabular-nums text-foreground',
    rowLabelSelected: 'font-semibold text-primary',
    readout: 'text-center text-4xl font-semibold tabular-nums text-foreground',
    clock: 'flex-row items-center gap-4',
    footer: 'flex-row justify-end gap-2',
  },
});

/* -------------------------------------------------------------------------- */
/* One snapping column                                                        */
/* -------------------------------------------------------------------------- */

interface ColumnProps<T> {
  items: readonly T[];
  /** Index of the selected item. Drives the scroll position. */
  index: number;
  onIndexChange: (index: number) => void;
  label: (item: T) => string;
  disabled?: boolean;
  accessibilityLabel: string;
  className?: string;
}

/**
 * A vertical list that comes to rest on a whole row.
 *
 * `snapToOffsets` rather than `snapToInterval`: the two behave the same on a
 * short flick, but an interval lets a hard fling coast past several rows and
 * land between two of them on Android. Explicit offsets plus
 * `disableIntervalMomentum` pin every rest position to a row.
 *
 * Half a column of padding at each end is what lets the first and last items
 * reach the centre — without it, midnight can be scrolled to but never
 * selected, since the list runs out before it gets there.
 */
function Column<T>({
  items,
  index,
  onIndexChange,
  label,
  disabled,
  accessibilityLabel,
  className,
}: ColumnProps<T>) {
  const ref = useRef<Animated.ScrollView>(null);
  const offset = useSharedValue(index * ROW_HEIGHT);
  /*
   * The index the list is resting on, tracked separately from the `index`
   * prop. Scrolling writes to it, and the effect below only re-scrolls when
   * the prop disagrees — otherwise every settle would push the list back to
   * where it already is, cancelling the user's own momentum.
   */
  const resting = useRef(index);

  const snapToOffsets = useMemo(
    () => items.map((_, i) => i * ROW_HEIGHT),
    [items]
  );

  const handler = useAnimatedScrollHandler((event) => {
    offset.value = event.contentOffset.y;
  });

  useEffect(() => {
    if (index === resting.current) return;
    resting.current = index;
    ref.current?.scrollTo({ y: index * ROW_HEIGHT, animated: true });
  }, [index]);

  const settle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.y / ROW_HEIGHT);
      const clamped = Math.min(Math.max(next, 0), items.length - 1);
      if (clamped === resting.current) return;
      resting.current = clamped;
      selectionTick();
      onIndexChange(clamped);
    },
    [items.length, onIndexChange]
  );

  const selectedItem = items[index];

  return (
    <Animated.ScrollView
      ref={ref}
      className={className}
      style={{ height: COLUMN_HEIGHT }}
      contentContainerStyle={{ paddingVertical: (COLUMN_HEIGHT - ROW_HEIGHT) / 2 }}
      contentOffset={{ x: 0, y: index * ROW_HEIGHT }}
      onScroll={handler}
      scrollEventThrottle={16}
      scrollEnabled={!disabled}
      showsVerticalScrollIndicator={false}
      snapToOffsets={snapToOffsets}
      disableIntervalMomentum
      decelerationRate="fast"
      /* Both, because only one of them fires: a flick ends in momentum, and a
         slow drag released on a snap point ends without any. Missing the drag
         case leaves a column that looks settled and has reported nothing. */
      onMomentumScrollEnd={settle}
      onScrollEndDrag={settle}
      /* The rows fade rather than unmount, so a recycled row would pop in at
         full opacity mid-scroll. A day of minutes is 60 views; keeping them
         all is cheaper than the flicker. */
      removeClippedSubviews={false}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={selectedItem ? { text: label(selectedItem) } : undefined}
    >
      {items.map((item, i) => (
        <ColumnRow key={i} offset={offset} index={i} selected={i === index}>
          {label(item)}
        </ColumnRow>
      ))}
    </Animated.ScrollView>
  );
}

/**
 * One row, faded by how far it is from the centre.
 *
 * The fade is a function of the live scroll offset rather than of the selected
 * index, so it tracks the finger instead of stepping once per settle — which
 * is the difference between a wheel and a list that changes colour.
 */
function ColumnRow({
  offset,
  index,
  selected,
  children,
}: {
  offset: SharedValue<number>;
  index: number;
  selected: boolean;
  children: string;
}) {
  const slots = timePickerVariants();

  const style = useAnimatedStyle(() => {
    const distance = Math.abs(offset.value / ROW_HEIGHT - index);
    return {
      opacity: interpolate(distance, [0, 1, 2], [1, 0.55, 0.2], 'clamp'),
      transform: [{ scale: interpolate(distance, [0, 1], [1, 0.88], 'clamp') }],
    };
  });

  return (
    <Animated.View
      style={[style, { height: ROW_HEIGHT }]}
      className={slots.row()}
    >
      <Text className={cn(slots.rowLabel(), selected && slots.rowLabelSelected())}>
        {children}
      </Text>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/* wheel                                                                      */
/* -------------------------------------------------------------------------- */

interface FaceProps {
  value: TimeValue;
  onValueChange: (value: TimeValue) => void;
  hourCycle: HourCycle;
  minuteStep: number;
  locale?: string;
  disabled?: boolean;
}

function WheelFace({
  value,
  onValueChange,
  hourCycle,
  minuteStep,
  locale,
  disabled,
}: FaceProps) {
  const slots = timePickerVariants();
  const [am, pm] = useMemo(() => meridiemLabels(locale), [locale]);

  const hours = useMemo(
    () =>
      hourCycle === 24
        ? Array.from({ length: 24 }, (_, i) => i)
        : Array.from({ length: 12 }, (_, i) => i + 1),
    [hourCycle]
  );
  const minutes = useMemo(
    () => Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep),
    [minuteStep]
  );
  const meridiems = useMemo(() => [am, pm], [am, pm]);

  const shownHour = displayHour(value.hour, hourCycle);
  const hourIndex = Math.max(0, hours.indexOf(shownHour));
  /*
   * Nearest rather than exact. A minute that is not on the step — from a
   * default value, or from `minuteStep` changing under a chosen time — has no
   * row of its own, and `indexOf` returning -1 would park the column at
   * midnight rather than at the closest minute it can actually offer.
   */
  const minuteIndex = Math.min(
    minutes.length - 1,
    Math.round(value.minute / minuteStep)
  );
  const meridiemIndex = meridiemOf(value.hour) === 'am' ? 0 : 1;

  const setHour = useCallback(
    (index: number) => {
      const displayed = hours[index] ?? 0;
      onValueChange({
        ...value,
        hour: hourFromDisplay(displayed, meridiemOf(value.hour), hourCycle),
      });
    },
    [hours, hourCycle, onValueChange, value]
  );

  const setMinute = useCallback(
    (index: number) => onValueChange({ ...value, minute: minutes[index] ?? 0 }),
    [minutes, onValueChange, value]
  );

  const setMeridiem = useCallback(
    (index: number) => {
      const next = index === 0 ? 'am' : 'pm';
      if (next === meridiemOf(value.hour)) return;
      onValueChange({
        ...value,
        hour: next === 'pm' ? value.hour + 12 : value.hour - 12,
      });
    },
    [onValueChange, value]
  );

  return (
    <View className={slots.wheel()} style={{ height: COLUMN_HEIGHT }}>
      {/* Behind the columns, and the only thing marking the selection — so it
          stays exactly one row tall however many columns there happen to be. */}
      <View
        pointerEvents="none"
        className={slots.highlight()}
        style={{ top: (COLUMN_HEIGHT - ROW_HEIGHT) / 2, height: ROW_HEIGHT }}
      />
      <Column
        items={hours}
        index={hourIndex}
        onIndexChange={setHour}
        label={(hour) => (hourCycle === 24 ? padTwo(hour) : String(hour))}
        disabled={disabled}
        accessibilityLabel="Hour"
        className={slots.column()}
      />
      <Column
        items={minutes}
        index={minuteIndex}
        onIndexChange={setMinute}
        label={padTwo}
        disabled={disabled}
        accessibilityLabel="Minute"
        className={slots.column()}
      />
      {hourCycle === 12 ? (
        <Column
          items={meridiems}
          index={meridiemIndex}
          onIndexChange={setMeridiem}
          label={(entry) => entry}
          disabled={disabled}
          accessibilityLabel="AM or PM"
          className={slots.column()}
        />
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* clock                                                                      */
/* -------------------------------------------------------------------------- */

const FACE_SIZE = 132;
const FACE_CENTRE = FACE_SIZE / 2;

const AnimatedLine = Animated.createAnimatedComponent(Line);

/**
 * An analog face whose hands follow the selection.
 *
 * The hands are animated rather than snapped because the face's whole job is
 * to say *when in the day* the highlighted row is, and a hand that jumps gives
 * that away one row at a time. Sweeping, you read the shape of the movement
 * and stop looking at the digits.
 */
function ClockFace({ value }: { value: TimeValue }) {
  // `useCSSVariable` is typed for every kind of token, so a colour has to be
  // narrowed before SVG will take it.
  const rawTick = useCSSVariable('--color-muted-foreground');
  const rawHand = useCSSVariable('--color-foreground');
  const rawDial = useCSSVariable('--color-muted');
  const tick = typeof rawTick === 'string' ? rawTick : undefined;
  const hand = typeof rawHand === 'string' ? rawHand : undefined;
  const dial = typeof rawDial === 'string' ? rawDial : undefined;

  /*
   * Total minutes, not the hour and minute separately. At five to twelve the
   * hour hand is nearly at twelve, and driving it from `hour` alone leaves it
   * pointing at eleven until the minute hand completes the turn.
   */
  const minutes = timeToMinutes(value);
  const progress = useSharedValue(minutes);

  useEffect(() => {
    progress.value = withSpring(minutes, HAND_SPRING);
  }, [minutes, progress]);

  /*
   * `animatedProps` rather than a transform: an SVG line has no transform
   * origin of its own, so rotating it turns it about the origin of the whole
   * canvas rather than about the pin at the centre of the dial. Moving the end
   * point is the same maths without the frame-of-reference problem.
   *
   * The hands run on the *whole* turn, so the wrap at twelve and at the hour
   * sweeps back rather than jumping — which is what a real hand does.
   */
  const hourHand = useAnimatedProps(() => handEnd((progress.value % 720) / 720, 34));
  const minuteHand = useAnimatedProps(() => handEnd((progress.value % 60) / 60, 48));

  return (
    <Svg width={FACE_SIZE} height={FACE_SIZE}>
      <Circle cx={FACE_CENTRE} cy={FACE_CENTRE} r={FACE_CENTRE - 2} fill={dial} />
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
        const outer = FACE_CENTRE - 10;
        const inner = outer - (i % 3 === 0 ? 9 : 6);
        return (
          <Line
            key={i}
            x1={FACE_CENTRE + Math.cos(angle) * inner}
            y1={FACE_CENTRE + Math.sin(angle) * inner}
            x2={FACE_CENTRE + Math.cos(angle) * outer}
            y2={FACE_CENTRE + Math.sin(angle) * outer}
            stroke={tick}
            strokeWidth={i % 3 === 0 ? 2 : 1}
            strokeLinecap="round"
          />
        );
      })}
      <AnimatedLine
        animatedProps={hourHand}
        stroke={hand}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <AnimatedLine
        animatedProps={minuteHand}
        stroke={hand}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={FACE_CENTRE} cy={FACE_CENTRE} r={3} fill={hand} />
    </Svg>
  );
}

/**
 * Where a hand of `length` ends, given how far round the dial it has turned.
 *
 * A worklet, so both hands can be computed on the UI thread. Twelve o'clock is
 * straight up and SVG's zero angle is to the right, hence the quarter turn.
 */
function handEnd(turn: number, length: number) {
  'worklet';
  const angle = turn * 2 * Math.PI - Math.PI / 2;
  return {
    x1: FACE_CENTRE,
    y1: FACE_CENTRE,
    x2: FACE_CENTRE + Math.cos(angle) * length,
    y2: FACE_CENTRE + Math.sin(angle) * length,
  };
}

function ClockFaceLayout({
  value,
  onValueChange,
  hourCycle,
  minuteStep,
  locale,
  disabled,
}: FaceProps) {
  const slots = timePickerVariants();
  const times = useMemo(() => timesOfDay(minuteStep), [minuteStep]);
  const index = Math.min(
    times.length - 1,
    Math.round(timeToMinutes(value) / minuteStep)
  );

  const setIndex = useCallback(
    (next: number) => {
      const time = times[next];
      if (time) onValueChange(time);
    },
    [onValueChange, times]
  );

  return (
    <View className={slots.clock()}>
      <ClockFace value={value} />
      <Column
        items={times}
        index={index}
        onIndexChange={setIndex}
        label={(time) => formatTime(time, { hourCycle, locale })}
        disabled={disabled}
        accessibilityLabel="Time"
        className={slots.column()}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* ruler                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * One big readout over a scale you swipe.
 *
 * The scale is a horizontal scroll view with a tick per step and half its
 * width of padding at each end, so the first and last times can reach the
 * centre line — the same trick the columns use, on the other axis.
 *
 * The readout is a plain `Text` driven by React rather than an animated one
 * driven by the offset. It only has to be right when the scale comes to rest,
 * and re-rendering one string per settled step is cheaper than keeping a
 * formatted time on the UI thread, where `Intl` cannot go.
 */
function RulerFace({
  value,
  onValueChange,
  hourCycle,
  minuteStep,
  locale,
  disabled,
}: FaceProps) {
  const slots = timePickerVariants();
  const ref = useRef<ScrollView>(null);
  const times = useMemo(() => timesOfDay(minuteStep), [minuteStep]);
  const index = Math.min(
    times.length - 1,
    Math.round(timeToMinutes(value) / minuteStep)
  );
  const resting = useRef(index);
  /*
   * Measured, not assumed: the scroller is narrower than the panel by whatever
   * padding the presentation put around it, which this component cannot see.
   *
   * Half the scroller, *less half a tick*. A tick is drawn in the middle of a
   * cell `TICK_SPACING` wide, so padding by half the width alone puts the
   * cell's leading edge under the indicator and the tick itself half a cell to
   * the right of it — close enough to look like a rounding error and wrong at
   * every rest position.
   */
  const [width, setWidth] = useState(0);
  const pad = Math.max(0, width / 2 - TICK_SPACING / 2);

  const snapToOffsets = useMemo(
    () => times.map((_, i) => i * TICK_SPACING),
    [times]
  );

  useEffect(() => {
    if (index === resting.current) return;
    resting.current = index;
    ref.current?.scrollTo({ x: index * TICK_SPACING, animated: true });
  }, [index]);

  const settle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / TICK_SPACING);
      const clamped = Math.min(Math.max(next, 0), times.length - 1);
      if (clamped === resting.current) return;
      resting.current = clamped;
      selectionTick();
      const time = times[clamped];
      if (time) onValueChange(time);
    },
    [onValueChange, times]
  );

  const stepsPerHour = Math.max(1, Math.round(60 / minuteStep));

  /*
   * `contentOffset` only takes effect on mount, and on mount the padding is
   * still zero because the width has not been measured — so the resting
   * position has to be set again once it has. Unanimated: this is the first
   * frame the scale is correctly laid out in, not a movement.
   */
  const onLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      const next = event.nativeEvent.layout.width;
      if (next === width) return;
      setWidth(next);
      ref.current?.scrollTo({ x: resting.current * TICK_SPACING, animated: false });
    },
    [width]
  );

  return (
    <View className="gap-4">
      <Text className={slots.readout()}>
        {formatTime(value, { hourCycle, locale })}
      </Text>

      <View className="relative h-14 justify-center" onLayout={onLayout}>
        <ScrollView
          ref={ref}
          horizontal
          contentContainerStyle={{ paddingHorizontal: pad }}
          contentOffset={{ x: index * TICK_SPACING, y: 0 }}
          scrollEnabled={!disabled}
          showsHorizontalScrollIndicator={false}
          snapToOffsets={snapToOffsets}
          disableIntervalMomentum
          decelerationRate="fast"
          onMomentumScrollEnd={settle}
          onScrollEndDrag={settle}
          accessibilityRole="adjustable"
          accessibilityLabel="Time"
          accessibilityValue={{ text: formatTime(value, { hourCycle, locale }) }}
        >
          {/*
            No numbers under the ticks. The readout above already says the
            time, and a scale this dense has room for a label every few hours
            at most — which is a legend, not a scale, and reads as clutter
            beside a number set at 36px.
          */}
          {times.map((_, i) => (
            <View
              key={i}
              style={{ width: TICK_SPACING }}
              className="items-center justify-center"
            >
              <View
                className={cn(
                  'w-0.5 rounded-full',
                  // Taller and darker on the hour, so the scale reads as hours
                  // rather than as an undifferentiated comb.
                  i % stepsPerHour === 0 ? 'h-7 bg-muted-foreground' : 'h-4 bg-border'
                )}
              />
            </View>
          ))}
        </ScrollView>

        {/* Over the scale rather than in it: the indicator marks the centre of
            the control, which is a fixed point, while every tick moves. */}
        <View
          pointerEvents="none"
          className="absolute inset-y-1 left-1/2 w-0.5 -translate-x-px rounded-full bg-primary"
        />
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* The panel                                                                  */
/* -------------------------------------------------------------------------- */

/** The width the panel asks for. Wide enough for three columns of digits. */
const PANEL_WIDTH = 300;

interface PanelProps extends FaceProps {
  layout: TimePickerLayout;
  className?: string;
  /**
   * Take the container's width instead of the panel's own.
   *
   * A popover has no width until its content claims one, so there the fixed
   * width is doing real work. A sheet is already the width of the screen, and
   * a 300pt box centred in it reads as a card that has been dropped into a
   * sheet rather than as the sheet's own contents.
   */
  fullWidth?: boolean;
  /** Rendered under the face — the sheet's Done button. */
  footer?: ReactNode;
}

function Panel({ layout, className, fullWidth, footer, ...face }: PanelProps) {
  const slots = timePickerVariants();

  return (
    <View
      className={cn(slots.panel(), className)}
      style={fullWidth ? undefined : { width: PANEL_WIDTH }}
    >
      {layout === 'wheel' ? <WheelFace {...face} /> : null}
      {layout === 'clock' ? <ClockFaceLayout {...face} /> : null}
      {layout === 'ruler' ? <RulerFace {...face} /> : null}
      {footer}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* TimePicker                                                                 */
/* -------------------------------------------------------------------------- */

export interface TimePickerProps {
  /** Controlled selection, as `{ hour, minute }` on a 24-hour clock. */
  value?: TimeValue;
  /** Starting selection when uncontrolled. Defaults to the top of the hour. */
  defaultValue?: TimeValue;
  onValueChange?: (value: TimeValue) => void;
  /** Which face the panel draws. */
  layout?: TimePickerLayout;
  /** How the panel gets onto the screen. `inline` renders it with no trigger. */
  presentation?: TimePickerPresentation;
  /** Controlled open state of the panel. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** `24` drops the meridiem column and writes hours 00–23. */
  hourCycle?: HourCycle;
  /**
   * Minutes between selectable times. `wheel` defaults to 1; `clock` and
   * `ruler` default to 30 and 15, since both scroll the whole day at once.
   */
  minuteStep?: number;
  /** Earliest selectable time, inclusive. */
  minTime?: TimeValue;
  /** Latest selectable time, inclusive. */
  maxTime?: TimeValue;
  /** What the trigger reads when nothing has been chosen. */
  placeholder?: string;
  /** Override how the chosen time is written on the trigger. */
  format?: (value: TimeValue) => string;
  /** BCP 47 tag for the time's text and the meridiem labels. */
  locale?: string;
  /** Stop the trigger opening it, and the faces from being scrolled. */
  disabled?: boolean;
  className?: string;
  /**
   * A trigger of your own. Given one, it is cloned with an `onPress` that
   * opens the panel — so a field row or an icon button can stand in for the
   * default button without this component knowing what either looks like.
   *
   * Ignored by `presentation="inline"`, which has no trigger.
   */
  children?: ReactElement<{ onPress?: () => void }> | ReactNode;
}

/** The step each layout picks when the caller does not. */
const DEFAULT_STEP: Record<TimePickerLayout, number> = {
  wheel: 1,
  clock: 30,
  ruler: 15,
};

function TimePickerRoot({
  value: valueProp,
  defaultValue,
  onValueChange,
  layout = 'wheel',
  presentation = 'popover',
  open: openProp,
  onOpenChange,
  hourCycle = 12,
  minuteStep,
  minTime,
  maxTime,
  placeholder = DEFAULT_PLACEHOLDER,
  format,
  locale,
  disabled = false,
  className,
  children,
}: TimePickerProps) {
  const step = minuteStep ?? DEFAULT_STEP[layout];

  const [internalValue, setInternalValue] = useState<TimeValue | undefined>(defaultValue);
  const [internalOpen, setInternalOpen] = useState(false);

  const isValueControlled = valueProp !== undefined;
  const isOpenControlled = openProp !== undefined;
  const selected = isValueControlled ? valueProp : internalValue;
  const open = isOpenControlled ? openProp : internalOpen;

  /*
   * What the faces scroll to before anything has been picked. The nearest
   * allowed time to the top of the current hour, so an unset picker opens
   * somewhere plausible rather than at midnight — and inside the span, since
   * scrolling to a time the caller has forbidden is a worse first frame.
   */
  const fallback = useMemo(() => {
    const now = new Date();
    return clampTime(roundToStep({ hour: now.getHours(), minute: 0 }, step), minTime, maxTime);
  }, [step, minTime, maxTime]);

  const draft = selected ?? fallback;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isOpenControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isOpenControlled, onOpenChange]
  );

  /*
   * Clamped and stepped on the way out, not on the way in. A face reports the
   * row it landed on, and it does not know about `minTime` or a step it is not
   * itself using — putting both here means every layout is bounded by the same
   * rule and none of them has to carry it.
   */
  const commit = useCallback(
    (next: TimeValue) => {
      const bounded = clampTime(roundToStep(next, step), minTime, maxTime);
      if (isSameTime(bounded, selected)) return;
      if (!isValueControlled) setInternalValue(bounded);
      onValueChange?.(bounded);
    },
    [isValueControlled, maxTime, minTime, onValueChange, selected, step]
  );

  const label = useMemo(() => {
    if (!selected) return null;
    if (format) return format(selected);
    return formatTime(selected, { hourCycle, locale });
  }, [format, hourCycle, locale, selected]);

  const face: FaceProps = {
    value: draft,
    onValueChange: commit,
    hourCycle,
    minuteStep: step,
    locale,
    disabled,
  };

  if (presentation === 'inline') {
    return <Panel layout={layout} className={className} {...face} />;
  }

  const trigger = (
    children ?? (
      <Button variant="outline" disabled={disabled} className={cn('justify-start gap-2', className)}>
        <ClockIcon size={16} />
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
        {/*
          `items-center` on the content rather than a width on the panel: the
          dialog sizes to its child, and a panel of a fixed width inside a
          stretch-aligned parent would be pinned to one edge.

          Blurred rather than dimmed. A dialog is the presentation you reach
          for when the time *is* the decision on the screen, and frosting what
          is behind it says that in a way a dim does not. Falls back to the dim
          when expo-blur is not installed, so it is safe either way.
        */}
        <Dialog.Content blur className="items-center gap-0 p-4">
          <Panel
            layout={layout}
            {...face}
            footer={
              // Full width, like the sheet's. It is the only tap target in the
              // dialog, and a small button in a corner of one asks to be
              // aimed at.
              <Dialog.Close>
                <Button className="mt-1 w-full">Done</Button>
              </Dialog.Close>
            }
          />
        </Dialog.Content>
      </Dialog>
    );
  }

  const isSheet = presentation === 'bottom-sheet';

  /*
   * The sheet gets a Done button and the popover does not. A popover is
   * dismissed by tapping anywhere outside it, which is most of the screen; a
   * sheet's outside is the strip above it, and a picker whose scale is under
   * your thumb needs somewhere deliberate to finish.
   *
   * Full width and set apart from the face rather than tucked under it. It is
   * the only tap target in the sheet, and at the bottom of the screen it is
   * also the one under the thumb already holding the phone.
   */
  const footer = isSheet ? (
    <Popover.Close>
      <Button className="mt-2 w-full">Done</Button>
    </Popover.Close>
  ) : null;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      presentation={isSheet ? 'bottom-sheet' : 'popover'}
    >
      <Popover.Trigger>{trigger}</Popover.Trigger>
      {/*
        `full` in a sheet, `content-fit` anchored. A sheet is already the width
        of the screen, and a panel sized to its content sits centred in it as a
        card that happens to be inside a sheet rather than as the sheet's own
        contents — which is the difference between the two and the reason the
        sheet is worth having.

        The padding is on the panel, not on the content: in sheet mode a
        className on the panel is merged into the sheet's own padding and would
        replace it.
      */}
      <Popover.Content width={isSheet ? 'full' : 'content-fit'}>
        <Panel
          layout={layout}
          fullWidth={isSheet}
          className={isSheet ? 'w-full gap-4 px-1 pb-2' : 'self-center p-3'}
          footer={footer}
          {...face}
        />
      </Popover.Content>
    </Popover>
  );
}
TimePickerRoot.displayName = 'TimePicker';

export const TimePicker = Object.assign(TimePickerRoot, {
  Trigger: Popover.Trigger,
});
