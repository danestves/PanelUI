/**
 * Direction — reading direction for everything below it.
 *
 * ```tsx
 * <Direction dir="rtl">
 *   <App />
 * </Direction>
 * ```
 *
 * The layout flip is Yoga's, not ours: the wrapper carries the `direction`
 * style, and every row, `start`/`end` inset and horizontal padding underneath
 * it mirrors natively. That is the whole reason this is a component and not a
 * bare context — `direction` is a *style*, so a subtree is the unit it applies
 * to.
 *
 * It is also the reason to prefer it over flipping the process with
 * `I18nManager.forceRTL`, which needs an app restart to take effect, cannot be
 * scoped to part of a screen, and cannot be previewed side by side. Here the
 * value is a prop: change it and the next frame is mirrored.
 *
 * ## What Yoga does not flip
 *
 * Anything measured in raw pixels rather than laid out — a drag translation, an
 * indicator offset, the direction a sweep travels. Those have to consult the
 * value and negate it themselves, which is what `useDirection()` is for:
 *
 * ```tsx
 * const dir = useDirection();
 * const delta = (dir === 'rtl' ? -event.translationX : event.translationX) / width;
 * ```
 *
 * With no provider mounted, and for a `<Direction>` given no `dir`, the value
 * comes from the device — so an app that did force RTL the old way still reads
 * back the truth.
 */
import { useContext, useMemo, type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import {
  DirectionContext,
  deviceDirection,
  useDirection,
  useDirectionSign,
  type DirectionValue,
} from '../../hooks/use-direction';
import { textChildren } from '../../primitives/text';

export { useDirection, useDirectionSign };
export type { DirectionValue };

export interface DirectionProps extends ViewProps {
  className?: string;
  children?: ReactNode;
  /**
   * Reading direction for this subtree. Defaults to the nearest enclosing
   * `Direction`, or to the device when there is none — so a nested provider
   * with no `dir` inherits rather than resetting to left-to-right.
   */
  dir?: DirectionValue;
}

/**
 * Provider. Renders one `View` — it has to, since the flip is a style.
 *
 * The view takes no layout of its own: it is as big as what is inside it, and
 * `className` says otherwise. Wrapping a whole app therefore wants `flex-1`
 * explicitly. It used to carry that by default, and every use inside a screen
 * had to undo it with `flex-none` — a default that is wrong for one of its two
 * uses is worse than no default, because the wrong one fails silently by
 * swallowing the rest of the screen.
 */
export function Direction({ className, children, dir, style, ...props }: DirectionProps) {
  const inherited = useContext(DirectionContext);
  const value = dir ?? inherited ?? deviceDirection();

  // The style object is memoised because it is the thing that invalidates
  // layout for the entire subtree — a fresh one each render would re-run Yoga
  // on every parent render, for a value that almost never changes.
  const directionStyle = useMemo(() => ({ direction: value }) as const, [value]);

  return (
    <DirectionContext.Provider value={value}>
      <View className={className} style={[directionStyle, style]} {...props}>
        {textChildren(children)}
      </View>
    </DirectionContext.Provider>
  );
}

Direction.displayName = 'Direction';

