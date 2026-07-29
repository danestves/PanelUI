/**
 * Collapse — a body that opens and closes by animating its own height.
 *
 * Height cannot be animated from `auto`, so the content is measured first and
 * the measurement is what gets animated to. The measured copy is absolutely
 * positioned, which is the part that is easy to get wrong: a child of a view
 * whose height is mid-animation reports that animated height back, so the
 * panel settles at whatever it happened to measure on the first frame. Taken
 * out of the flow it always lays out at its natural size.
 *
 * ```tsx
 * <Collapse open={open}>
 *   <Text>Anything, of any height.</Text>
 * </Collapse>
 * ```
 *
 * The alternative — unmounting the body and letting a layout transition on the
 * parent carry the change — is what `Accordion` does, and it is right when the
 * closed state should cost nothing. This is for a body that opens and closes
 * repeatedly and often while its content is still arriving, where remounting
 * would throw away scroll position and restart every animation inside it.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { cn } from '../utils/cn';

/** Long enough to read as the panel opening, short enough not to be waited on. */
export const COLLAPSE_DURATION = 200;

export interface CollapseProps extends Omit<ViewProps, 'children'> {
  open: boolean;
  /** Classes on the measured content, not on the clipping frame. */
  className?: string;
  duration?: number;
  children?: ReactNode;
}

export function Collapse({
  open,
  className,
  duration = COLLAPSE_DURATION,
  children,
  ...props
}: CollapseProps) {
  const reducedMotion = useReducedMotion();
  const [height, setHeight] = useState(0);
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    progress.value = reducedMotion
      ? open
        ? 1
        : 0
      : withTiming(open ? 1 : 0, { duration });
  }, [open, reducedMotion, duration, progress]);

  const style = useAnimatedStyle(() => ({
    height: progress.value * height,
    opacity: progress.value,
  }));

  // Re-measured rather than measured once: a body whose content is still
  // streaming in grows, and a height captured on the first frame would crop it.
  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setHeight((current) => (Math.abs(current - next) < 1 ? current : next));
  };

  return (
    <Animated.View style={style} className="overflow-hidden">
      <View
        onLayout={onLayout}
        style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
        className={cn(className)}
        {...props}
      >
        {children}
      </View>
    </Animated.View>
  );
}
Collapse.displayName = 'Collapse';
