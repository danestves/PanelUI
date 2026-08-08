/**
 * ContextMenu — the actions that belong to a piece of content, opened on it.
 *
 * A `Menu` hangs off a control that exists to be pressed: a ⋯ button, a toolbar
 * item, something whose whole job is to open the menu. A context menu has no
 * such control. The target is the content itself — a message, a note, a photo,
 * a row — and the actions are reached by pressing and holding it.
 *
 * ```tsx
 * <ContextMenu>
 *   <ContextMenu.Trigger>
 *     <Message>Would you like an interactive todo list?</Message>
 *   </ContextMenu.Trigger>
 *   <ContextMenu.Content>
 *     <ContextMenu.Item icon={<Share2 size={16} />}>Share</ContextMenu.Item>
 *     <ContextMenu.Item icon={<Copy size={16} />}>Copy</ContextMenu.Item>
 *     <ContextMenu.Separator />
 *     <ContextMenu.Item variant="destructive" icon={<Flag size={16} />}>
 *       Report
 *     </ContextMenu.Item>
 *   </ContextMenu.Content>
 * </ContextMenu>
 * ```
 *
 * ## It is a Menu, and deliberately so
 *
 * The rows here *are* `Menu`'s rows — the same components, not a second set
 * styled to match. `ContextMenu.Item` and `Menu.Item` are one implementation,
 * so the destructive colour, the press-in scale, the indicator column and the
 * dismiss-on-select rule cannot drift apart between the two ways of reaching
 * them. The panel is `Menu`'s panel, which is `Popover`'s, so `presentation`,
 * submenus and edge-flipping all arrive already working.
 *
 * What this component owns is the two things a menu opened on content needs and
 * a menu opened from a button does not: the long press, and where the panel
 * goes.
 *
 * ## Anchored to the finger, not to the target
 *
 * A toolbar menu is placed against its trigger, because the trigger is small
 * and its position is the only sensible answer. A context menu's target is
 * often most of the screen — a whole message, a whole card — and the middle of
 * it is not where the finger was. So the anchor is the press point by default,
 * and the panel unfolds from it the way a popover unfolds from a button.
 *
 * `anchor="target"` places it against the target's bounds instead, which is the
 * better answer for something small and list-shaped, where the panel lining up
 * with the row reads as belonging to it.
 *
 * ## Why the gesture is not a Pressable
 *
 * The target usually has a press of its own — open the thread, play the video,
 * follow the link — and the two must not both fire. React Native's `Pressable`
 * decides between them after the fact, and the tap can still get through on the
 * way to a long press; the recogniser here is asked for the arbitration up
 * front instead, so a hold that opens the menu never also counts as a press.
 *
 * It is also what lets the target be anything at all. A cloned `onLongPress`
 * needs a child that takes one, which rules out exactly the plain views —
 * bubbles, cards, images — that content-native actions are usually attached to.
 */
import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Menu, type MenuContentProps, type MenuProps } from '../menu';
import { usePopoverAnchor } from '../popover';
import { selectionTick } from '../../utils/haptics';

/**
 * How long the target is held before the menu opens.
 *
 * Long enough not to fire while a finger is on its way to a scroll, short
 * enough that nobody wonders whether the hold is working. The platforms sit
 * either side of this; it is the value the rest of this library holds at.
 */
const DEFAULT_DELAY = 350;

/**
 * How far the finger may travel during the hold before it stops counting.
 *
 * Generous rather than tight, and the reason is what the target usually sits
 * in: a scroller. A threshold small enough to feel precise cancels the menu for
 * anyone whose thumb drifts while holding still, and the gesture it is being
 * told apart from — a scroll — has moved a great deal further than this by the
 * time it matters.
 */
const DEFAULT_SLOP = 12;

/**
 * The root takes exactly what `Menu`'s root takes — `open`, `onOpenChange`,
 * `defaultOpen`, `presentation` and `haptics` — because it *is* that root.
 */
export type ContextMenuProps = MenuProps;

/**
 * The root. Provides the menu's own context and the popover underneath it.
 *
 * It renders a `Menu`, which is not a shortcut — it is the point. Everything a
 * menu is, this is, and the two parts below are the only difference.
 */
function ContextMenuRoot(props: ContextMenuProps) {
  return <Menu {...props} />;
}

/** Which rectangle the panel is placed against. */
export type ContextMenuAnchor = 'point' | 'target';

export interface ContextMenuTriggerProps extends Omit<ViewProps, 'children'> {
  /**
   * Classes on the wrapper the content sits in, which lays out like any other
   * view — it does not shrink to its child, because the things held are usually
   * meant to fill their place in the layout. It is also the rect
   * `anchor="target"` measures.
   */
  className?: string;
  /**
   * The content the actions belong to. Anything at all — it is not required to
   * be pressable, and is not cloned or altered.
   */
  children: ReactNode;
  /**
   * `point` anchors the panel where the finger landed, `target` against the
   * bounds of the whole trigger.
   *
   * Point is the default because a context menu's target is usually large, and
   * the middle of a whole message is not where the press was. Reach for
   * `target` when the target is small and list-shaped and the panel should read
   * as lining up with it.
   */
  anchor?: ContextMenuAnchor;
  /** How long the hold has to last, in milliseconds. 350 by default. */
  delay?: number;
  /**
   * How far the finger may move during the hold before it stops being one, in
   * points. 12 by default.
   *
   * Loose rather than tight, because the target is usually inside a scroller: a
   * threshold small enough to feel precise cancels the menu for anyone whose
   * thumb drifts while holding still, and a scroll has travelled much further
   * than this by the time the two need telling apart. Tighten it only for a
   * target that cannot be scrolled.
   */
  slop?: number;
  /** A short press on the target, which the hold never also counts as. */
  onPress?: () => void;
  /**
   * Tick the haptic engine as the menu opens. Needs the optional
   * `expo-haptics`, and is silent without it.
   *
   * Worth setting more often than not. A hold has no edge to it the way a press
   * does — nothing moves under the finger at the moment it takes — so the tick
   * is what tells someone the hold has been long enough, before the panel has
   * had time to say so.
   */
  haptics?: boolean;
  /** Nothing opens the menu, and the short press stops firing too. */
  disabled?: boolean;
}

/**
 * Wraps the content and opens the menu when it is held.
 *
 * The wrapper is a plain view and lays out like one, stretching as a view does
 * rather than shrinking to its child. That is the opposite of what a tooltip's
 * trigger wants, and for the opposite reason: a tooltip names a control and
 * belongs over it, while the things held here — a bubble, a card, a row — are
 * usually meant to fill their place in the layout, and a wrapper that collapsed
 * around them would change it.
 *
 * It is also the rect measured under `anchor="target"`, which is why that
 * anchoring lines the panel up with the row rather than with the text in it.
 */
function ContextMenuTrigger({
  className,
  children,
  anchor = 'point',
  delay = DEFAULT_DELAY,
  slop = DEFAULT_SLOP,
  onPress,
  haptics = false,
  disabled = false,
  ...props
}: ContextMenuTriggerProps) {
  const { setOpen, anchorTo } = usePopoverAnchor('ContextMenu.Trigger');
  const ref = useRef<View>(null);

  /*
   * Both branches end up doing the same thing — set an anchor, then open — and
   * differ only in which rectangle they set. A point is a zero-sized rect,
   * which the popover places a panel against exactly as it does a trigger's
   * bounds; there is no separate code path for it downstream.
   */
  const openAt = useCallback(
    (x: number, y: number) => {
      // Ticked here rather than in the gesture callback so it fires once the
      // hold has been accepted, which is the moment there is something to
      // confirm — and on the same side of the bridge as the opening.
      if (haptics) selectionTick();

      if (anchor === 'point') {
        anchorTo({ x, y, width: 0, height: 0 });
        setOpen(true);
        return;
      }

      // Measured on opening rather than on layout: the target may have
      // scrolled since, and a stale rect anchors the panel to where it was.
      ref.current?.measureInWindow((mx, my, width, height) => {
        anchorTo({ x: mx, y: my, width, height });
        setOpen(true);
      });
    },
    [anchor, anchorTo, setOpen, haptics]
  );

  const gesture = useMemo(() => {
    /*
     * The hold and the tap are given to the recogniser as alternatives, so it
     * decides between them rather than both firing. That is the whole reason
     * this is a gesture and not a `Pressable`: the target below usually has a
     * press of its own, and a hold that opened the menu must not also count as
     * one.
     *
     * `absoluteX`/`absoluteY` are window coordinates, which is the space the
     * popover places panels in — so the press point needs no conversion.
     */
    const hold = Gesture.LongPress()
      .minDuration(delay)
      .maxDistance(slop)
      .enabled(!disabled)
      .onStart((event) => {
        runOnJS(openAt)(event.absoluteX, event.absoluteY);
      });

    const tap = Gesture.Tap()
      .enabled(!disabled && !!onPress)
      .onEnd((_event, success) => {
        if (success && onPress) runOnJS(onPress)();
      });

    return Gesture.Exclusive(hold, tap);
  }, [delay, slop, disabled, onPress, openAt]);

  return (
    <GestureDetector gesture={gesture}>
      {/*
        `collapsable={false}` keeps the wrapper as a real view on Android, where
        a view that only groups children is otherwise flattened away — and a
        flattened view cannot be measured, which `anchor="target"` needs.
      */}
      <View ref={ref} collapsable={false} className={className} {...props}>
        {children}
      </View>
    </GestureDetector>
  );
}

/**
 * Everything `Menu.Content` takes. The four listed here are the ones whose
 * defaults differ, and they are listed so the difference is visible.
 */
export interface ContextMenuContentProps extends MenuContentProps {
  /** Which side of the anchor the panel opens on. Down, from the press. */
  placement?: MenuContentProps['placement'];
  /** Where it sits along the other axis. From the press, not centred on it. */
  align?: MenuContentProps['align'];
  /** Gap between the anchor and the panel. Nearly closed, so it reads as
   * coming out of the press rather than floating near it. */
  offset?: number;
  /**
   * Floor for the panel's width. A context menu has no trigger to take its
   * width from, and a column of one-word verbs is too narrow to aim at.
   */
  minWidth?: number;
  /** Dim the screen behind the panel. On here, unlike a plain popover. */
  scrim?: boolean;
}

/**
 * The panel, with the defaults a context menu wants rather than a popover's.
 *
 * It unfolds down and to the right of the anchor rather than being centred on
 * it — centring is right for a panel under a button, and wrong for one at a
 * fingertip, where it would put half the panel back under the hand that opened
 * it. The gap to the anchor is nearly closed for the same reason: the panel
 * should read as coming out of the press, not as floating near it.
 *
 * The screen dims behind it, which a popover does not do. A context menu is
 * modal in practice — the content underneath is what the actions are *about*,
 * so nothing else on the screen is available while it is up, and the dim is
 * what says so.
 */
function ContextMenuContent({
  placement = 'bottom',
  align = 'start',
  offset = 6,
  minWidth = 200,
  scrim = true,
  ...props
}: ContextMenuContentProps) {
  return (
    <Menu.Content
      placement={placement}
      align={align}
      offset={offset}
      minWidth={minWidth}
      scrim={scrim}
      {...props}
    />
  );
}

/*
 * The rows are Menu's, passed straight through. Aliasing them rather than
 * wrapping them is deliberate: there is no second implementation to keep in
 * step, and `ContextMenu.Item` and `Menu.Item` cannot come to look different
 * from one another because they are the same component.
 */
export const ContextMenu = Object.assign(ContextMenuRoot, {
  Trigger: ContextMenuTrigger,
  Content: ContextMenuContent,
  Background: Menu.Background,
  Label: Menu.Label,
  Item: Menu.Item,
  CheckboxItem: Menu.CheckboxItem,
  RadioGroup: Menu.RadioGroup,
  RadioItem: Menu.RadioItem,
  Separator: Menu.Separator,
  Sub: Menu.Sub,
  SubTrigger: Menu.SubTrigger,
  SubContent: Menu.SubContent,
});
