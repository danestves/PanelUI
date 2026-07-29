/**
 * Plan — what an agent intends to do, before it does it.
 *
 * A card rather than a run of rows, because a plan is a thing the reader is
 * being asked to approve: it needs an edge around it so that where it starts
 * and stops is not a matter of interpretation, and a footer that can hold the
 * button that approves it.
 *
 * It streams. `isStreaming` puts a shimmer on the title and the description,
 * which is the honest way to render a heading that is still arriving — the
 * alternative is a title that grows a word at a time and reads as finished at
 * every intermediate length.
 *
 * ```tsx
 * <Plan isStreaming={streaming}>
 *   <Plan.Header>
 *     <Plan.Title>Migrate the calendar</Plan.Title>
 *     <Plan.Description>Four files, no API change.</Plan.Description>
 *     <Plan.Action><Plan.Trigger /></Plan.Action>
 *   </Plan.Header>
 *   <Plan.Content>…</Plan.Content>
 *   <Plan.Footer><Button>Approve</Button></Plan.Footer>
 * </Plan>
 * ```
 *
 * ## Where the props come from
 *
 * With the AI SDK a plan is usually an `experimental_useObject` stream, where
 * `isStreaming` is the hook's `isLoading` and the fields arrive one at a time —
 * which is exactly the case the shimmer exists for, since a partial object has
 * a title before it has anything else.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { tv } from 'tailwind-variants';
import { ChevronDownIcon } from '../../icons';
import { Collapse } from '../../primitives/collapse';
import { Text, textChildren } from '../../primitives/text';
import { cn } from '../../utils/cn';
import { Shimmer } from '../shimmer';

const planVariants = tv({
  slots: {
    root: 'w-full overflow-hidden rounded-2xl border border-border bg-card',
    header: 'flex-row items-start gap-3 p-4',
    heading: 'min-w-0 flex-1 gap-1',
    title: 'text-base font-semibold text-card-foreground',
    description: 'text-sm text-muted-foreground',
    action: 'shrink-0 flex-row items-center gap-1',
    trigger: 'h-8 w-8 items-center justify-center rounded-full active:bg-accent',
    content: 'gap-2 px-4 pb-4',
    footer: 'flex-row items-center justify-end gap-2 border-t border-border p-4',
  },
});

interface PlanContextValue {
  isStreaming: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

function usePlan(component: string): PlanContextValue {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error(`${component} must be used within a <Plan>`);
  }
  return context;
}

export interface PlanProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** Whether the plan is still being written. Shimmers the title and description. */
  isStreaming?: boolean;
  /** Controlled open state of the body. */
  open?: boolean;
  /** Initial state when uncontrolled. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

function PlanRoot({
  className,
  isStreaming = false,
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  children,
  ...props
}: PlanProps) {
  const { root } = planVariants();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const context = useMemo(
    () => ({ isStreaming, open, setOpen }),
    [isStreaming, open, setOpen]
  );

  return (
    <PlanContext.Provider value={context}>
      <View {...props} className={cn(root(), className)}>
        {children}
      </View>
    </PlanContext.Provider>
  );
}
PlanRoot.displayName = 'Plan';

export interface PlanHeaderProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

/**
 * The title, the description and whatever acts on them.
 *
 * The heading is wrapped in a column of its own so the action stays pinned to
 * the trailing edge as the title wraps, rather than riding down with it.
 */
function PlanHeader({ className, children, ...props }: PlanHeaderProps) {
  const { header, heading } = planVariants();

  const headings: ReactNode[] = [];
  const actions: ReactNode[] = [];
  for (const child of Array.isArray(children) ? children : [children]) {
    if (isPlanAction(child)) actions.push(child);
    else headings.push(child);
  }

  return (
    <View {...props} className={cn(header(), className)}>
      <View className={heading()}>{headings}</View>
      {actions}
    </View>
  );
}

function isPlanAction(child: ReactNode): boolean {
  return (
    typeof child === 'object' &&
    child !== null &&
    'type' in child &&
    (child as { type?: unknown }).type === PlanAction
  );
}

export interface PlanTitleProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

/** The plan's name. Shimmers while it is still being written. */
function PlanTitle({ className, children, ...props }: PlanTitleProps) {
  const { isStreaming } = usePlan('Plan.Title');
  const { title } = planVariants();

  if (isStreaming && typeof children === 'string') {
    return <Shimmer textClassName={cn(title(), className)}>{children}</Shimmer>;
  }

  return (
    <Text accessibilityRole="header" className={cn(title(), className)} {...props}>
      {children}
    </Text>
  );
}

export interface PlanDescriptionProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

function PlanDescription({ className, children, ...props }: PlanDescriptionProps) {
  const { isStreaming } = usePlan('Plan.Description');
  const { description } = planVariants();

  if (isStreaming && typeof children === 'string') {
    return <Shimmer textClassName={cn(description(), className)}>{children}</Shimmer>;
  }

  return (
    <Text className={cn(description(), className)} {...props}>
      {children}
    </Text>
  );
}

export interface PlanActionProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

/** Pinned to the header's trailing edge — the toggle, a badge, a menu. */
function PlanAction({ className, children, ...props }: PlanActionProps) {
  const { action } = planVariants();
  return (
    <View {...props} className={cn(action(), className)}>
      {children}
    </View>
  );
}

export interface PlanTriggerProps extends Omit<PressableProps, 'children' | 'style'> {
  className?: string;
  children?: ReactNode;
}

/** Folds the body away. Its chevron turns to point at the state it will reach. */
function PlanTrigger({ className, children, onPress, ...props }: PlanTriggerProps) {
  const { open, setOpen } = usePlan('Plan.Trigger');
  const { trigger } = planVariants();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    progress.value = reducedMotion
      ? open
        ? 1
        : 0
      : withTiming(open ? 1 : 0, { duration: 180 });
  }, [open, reducedMotion, progress]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={open ? 'Collapse plan' : 'Expand plan'}
      accessibilityState={{ expanded: open }}
      hitSlop={6}
      onPress={(event) => {
        onPress?.(event);
        setOpen(!open);
      }}
      className={cn(trigger(), className)}
      {...props}
    >
      {children ?? (
        <Animated.View style={chevronStyle}>
          <ChevronDownIcon size={16} />
        </Animated.View>
      )}
    </Pressable>
  );
}

export interface PlanContentProps extends Omit<ViewProps, 'children'> {
  className?: string;
  children?: ReactNode;
}

/** The steps. Collapses rather than unmounting, so it can still be growing. */
function PlanContent({ className, children, ...props }: PlanContentProps) {
  const { open } = usePlan('Plan.Content');
  const { content, description } = planVariants();

  return (
    <Collapse open={open} className={cn(content(), className)} {...props}>
      {textChildren(children, (text) => (
        <Text className={description()}>{text}</Text>
      ))}
    </Collapse>
  );
}

export interface PlanFooterProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

/** Where the button that approves the plan goes. */
function PlanFooter({ className, children, ...props }: PlanFooterProps) {
  const { footer } = planVariants();
  return (
    <View {...props} className={cn(footer(), className)}>
      {children}
    </View>
  );
}

PlanHeader.displayName = 'Plan.Header';
PlanTitle.displayName = 'Plan.Title';
PlanDescription.displayName = 'Plan.Description';
PlanAction.displayName = 'Plan.Action';
PlanTrigger.displayName = 'Plan.Trigger';
PlanContent.displayName = 'Plan.Content';
PlanFooter.displayName = 'Plan.Footer';

export const Plan = Object.assign(PlanRoot, {
  Header: PlanHeader,
  Title: PlanTitle,
  Description: PlanDescription,
  Action: PlanAction,
  Trigger: PlanTrigger,
  Content: PlanContent,
  Footer: PlanFooter,
});
