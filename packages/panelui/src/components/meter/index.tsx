import { forwardRef, useEffect } from 'react';
import { View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { tv, type VariantProps } from 'tailwind-variants';
import { Text } from '../../primitives/text';
import {
  clamp,
  colorFor,
  fractionOf,
  formatValue,
  litSegments,
  type MeterColor,
  type MeterThreshold,
} from './meter-scale';

const SPRING = { damping: 20, stiffness: 180, mass: 0.6 } as const;
/** Milliseconds for a segment to light or go out. */
const SEGMENT_DURATION = 180;
/** How faint an unlit segment sits. Present, but plainly not counted. */
const SEGMENT_UNLIT = 0.22;

const meterVariants = tv({
  slots: {
    root: 'w-full gap-2',
    header: 'flex-row items-center justify-between gap-2',
    track: 'w-full overflow-hidden rounded-full',
    indicator: 'h-full rounded-full',
    segments: 'w-full flex-row',
    segment: 'flex-1 rounded-full',
  },
  variants: {
    color: {
      primary: { track: 'bg-primary/16', indicator: 'bg-primary', segment: 'bg-primary' },
      success: { track: 'bg-success/16', indicator: 'bg-success', segment: 'bg-success' },
      warning: { track: 'bg-warning/16', indicator: 'bg-warning', segment: 'bg-warning' },
      destructive: {
        track: 'bg-destructive/16',
        indicator: 'bg-destructive',
        segment: 'bg-destructive',
      },
      info: { track: 'bg-info/16', indicator: 'bg-info', segment: 'bg-info' },
      muted: {
        track: 'bg-muted',
        indicator: 'bg-muted-foreground',
        segment: 'bg-muted-foreground',
      },
    },
    size: {
      sm: { track: 'h-1.5', segments: 'h-1.5 gap-1', segment: 'h-1.5' },
      md: { track: 'h-2', segments: 'h-2 gap-1.5', segment: 'h-2' },
      lg: { track: 'h-3', segments: 'h-3 gap-1.5', segment: 'h-3' },
    },
  },
  defaultVariants: {
    color: 'primary',
    size: 'md',
  },
});

type MeterVariantProps = VariantProps<typeof meterVariants>;

export interface MeterProps
  extends Omit<ViewProps, 'children'>,
    MeterVariantProps {
  className?: string;
  /** The measurement, somewhere between `minValue` and `maxValue`. */
  value: number;
  /**
   * The bottom of the scale — the value at which the bar reads as empty.
   * Defaults to `0`.
   */
  minValue?: number;
  /**
   * The top of the scale — the value at which the bar reads as full. Defaults
   * to `100`, so a bare percentage needs neither bound set.
   */
  maxValue?: number;
  /**
   * What is being measured. Also the accessibility label, and a meter without
   * one announces a number with nothing attached to it — "seventy-five
   * percent" of what is not an answer. Pass `accessibilityLabel` instead only
   * where the caption is drawn some other way.
   */
  label?: string;
  /** Draw the value above the track, opposite the label. */
  showValueLabel?: boolean;
  /**
   * Text for the value label. Overrides the formatted value — use it for a
   * word where a number reads worse: `Strong`, `Almost full`.
   *
   * It is spoken whether or not it is drawn, so it can give a screen reader
   * better words than the caption without changing the caption. Pair it with
   * `showValueLabel` to draw it too.
   */
  valueLabel?: string;
  /**
   * How to write the value, through `Intl.NumberFormat`. A `percent` style
   * formats how far up the scale the value sits; every other style formats
   * the value itself, so `{ style: 'unit', unit: 'gigabyte' }` against a
   * `maxValue` of `256` reads `64 GB` rather than a percentage of it. Falls
   * back to a rounded percent when omitted.
   */
  formatOptions?: Intl.NumberFormatOptions;
  /**
   * Points on the scale where the colour changes, each `{ from, color }`. The
   * highest one the reading has reached wins, so the order you list them in
   * does not matter; below all of them the `color` prop applies.
   *
   * This is the difference between a meter and a bar: the colour is a
   * judgement about the reading. Which direction is bad is yours to say —
   * thresholds climbing to `destructive` suit a disk filling up, thresholds
   * falling to it suit a battery running down.
   */
  thresholds?: MeterThreshold[];
  /**
   * Draw the scale as this many discrete blocks instead of one continuous
   * bar. Blocks are all or nothing, which is the point of them: four blocks
   * say "three out of four" where a bar says "about seventy percent", and a
   * password is not seventy percent strong.
   *
   * Any value above the floor lights at least one block, so a reading that
   * is not empty never looks it.
   */
  segments?: number;
  /** Extra classes for the fill, or for a lit segment. */
  indicatorClassName?: string;
  /** Extra classes for the label + value row. */
  headerClassName?: string;
}

interface SegmentProps {
  index: number;
  /** How many blocks are lit, as a shared value so lighting stays off the JS thread. */
  lit: SharedValue<number>;
  className: string;
  reducedMotion: boolean;
}

/**
 * One block of a segmented meter. It reads the lit count rather than a boolean
 * so the whole row animates from one shared value, without a render per block.
 */
function Segment({ index, lit, className, reducedMotion }: SegmentProps) {
  const style = useAnimatedStyle(() => {
    const on = lit.value > index ? 1 : SEGMENT_UNLIT;
    return {
      opacity: reducedMotion
        ? on
        : withTiming(on, { duration: SEGMENT_DURATION }),
    };
  });

  return <Animated.View style={style} className={className} />;
}

/**
 * A measurement on a fixed scale: disk used, battery left, a score, a password's
 * strength. The fill is driven on the UI thread, so a value change costs one
 * render and nothing per frame.
 *
 * A meter is not a progress bar. Progress is a task moving towards an end that
 * finishing is the point of; a meter is a reading that happens to sit where it
 * sits, and may go back down. Reach for
 * [Progress](/docs/components/progress) when something is completing.
 *
 * `thresholds` paint the bar by where the reading falls, and `segments` draws
 * the scale as discrete blocks for readings that are counted rather than
 * measured.
 *
 * The value is read against `minValue` / `maxValue`, which default to 0 and
 * 100 — so a percentage needs neither. Set them and the meter speaks in
 * whatever is being measured: bytes, degrees, points. Nothing has to be
 * converted to a percent on the way in, and the screen reader is told the real
 * scale rather than a derived one.
 *
 * React Native has no meter role, so this announces as a progress bar with its
 * value, range and unit attached. That is the closest the platform offers, and
 * it is why `label` matters: the role will not distinguish a reading from a
 * task, and the name is what does.
 */
export const Meter = forwardRef<View, MeterProps>(
  (
    {
      className,
      indicatorClassName,
      headerClassName,
      value,
      minValue = 0,
      maxValue = 100,
      label,
      showValueLabel = false,
      valueLabel,
      formatOptions,
      thresholds,
      segments,
      color,
      size,
      accessibilityLabel,
      ...props
    },
    ref
  ) => {
    const held = clamp(value, minValue, maxValue);
    const fraction = fractionOf(value, minValue, maxValue);
    const resolvedColor = colorFor(held, color ?? 'primary', thresholds);
    const slots = meterVariants({ color: resolvedColor, size });
    const reducedMotion = useReducedMotion();

    const trackWidth = useSharedValue(0);
    const progress = useSharedValue(fraction);
    // Any reading above the floor lights a block, so "a little" never looks
    // like "none". Rounding down would leave the first quarter of a
    // four-block meter dark, which is the reading it is least able to afford.
    const litCount = segments ? litSegments(fraction, segments) : 0;
    const lit = useSharedValue(litCount);

    // Reduce motion lands on the value instead of springing to it — the
    // number is the information, and the overshoot is decoration.
    useEffect(() => {
      progress.value = reducedMotion ? fraction : withSpring(fraction, SPRING);
    }, [fraction, progress, reducedMotion]);

    useEffect(() => {
      lit.value = litCount;
    }, [lit, litCount]);

    const onLayout = (event: LayoutChangeEvent) => {
      trackWidth.value = event.nativeEvent.layout.width;
    };

    const fillStyle = useAnimatedStyle(() => ({
      width: trackWidth.value * progress.value,
    }));

    const spoken = formatValue(held, fraction, valueLabel, formatOptions);
    const showValue = showValueLabel;
    const hasHeader = label != null || showValue;

    const accessibility = {
      accessibilityRole: 'progressbar' as const,
      accessibilityLabel: accessibilityLabel ?? label,
      accessibilityValue: {
        min: minValue,
        max: maxValue,
        now: held,
        // Without this the scale is read as a bare number. `text` is what
        // carries the unit — the percent sign, the gigabytes, the word.
        text: spoken,
      },
    };

    const bar =
      segments && segments > 0 ? (
        <View
          ref={ref}
          {...accessibility}
          className={slots.segments({ className })}
          {...props}
        >
          {Array.from({ length: segments }, (_, index) => (
            <Segment
              key={index}
              index={index}
              lit={lit}
              reducedMotion={reducedMotion}
              className={slots.segment({ className: indicatorClassName })}
            />
          ))}
        </View>
      ) : (
        <View
          ref={ref}
          {...accessibility}
          className={slots.track({ className })}
          onLayout={onLayout}
          {...props}
        >
          <Animated.View
            style={fillStyle}
            className={slots.indicator({ className: indicatorClassName })}
          />
        </View>
      );

    if (!hasHeader) return bar;

    return (
      <View className={slots.root()}>
        <View className={slots.header({ className: headerClassName })}>
          {label != null ? (
            <Text size="sm" weight="medium" numberOfLines={1}>
              {label}
            </Text>
          ) : (
            <View />
          )}
          {showValue ? (
            <Text size="sm" muted numberOfLines={1}>
              {spoken}
            </Text>
          ) : null}
        </View>
        {bar}
      </View>
    );
  }
);

Meter.displayName = 'Meter';

export type { MeterColor, MeterThreshold };
