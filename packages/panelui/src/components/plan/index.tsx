/**
 * Plan — what an agent intends to do, before it does it.
 *
 * A card rather than a run of rows, because a plan is a thing the reader is
 * being asked to approve: it needs an edge around it so that where it starts
 * and stops is not a matter of interpretation, and a footer that can hold the
 * button that approves it.
 *
 * The body is a rail of steps rather than prose, because a plan is an ordered
 * list of things that will happen and the reader's question is always *which
 * one is running*. A paragraph describing the same four steps cannot be glanced
 * at to answer that; a column of markers can. The rail fills behind the steps
 * that are done, so progress is legible from its left edge alone, and
 * `Plan.Steps` counts itself so `Plan.Progress` can say `2 of 4` up in the
 * header without the total being stated twice.
 *
 * It streams. `isStreaming` puts a shimmer on the title, the description and
 * the one step that is running, which is the honest way to render text that is
 * still arriving — the alternative is a title that grows a word at a time and
 * reads as finished at every intermediate length.
 *
 * ```tsx
 * <Plan isStreaming={streaming}>
 *   <Plan.Header>
 *     <Plan.Icon><FileIcon size={16} /></Plan.Icon>
 *     <Plan.Title>Migrate the calendar</Plan.Title>
 *     <Plan.Description>Four files, no API change.</Plan.Description>
 *     <Plan.Action>
 *       <Plan.Progress />
 *       <Plan.Trigger />
 *     </Plan.Action>
 *   </Plan.Header>
 *   <Plan.Content>
 *     <Plan.Steps>
 *       <Plan.Step status="done" meta="utils/date.ts">Read the date utils</Plan.Step>
 *       <Plan.Step status="active">Replace the month grid</Plan.Step>
 *       <Plan.Step>Update the docs page</Plan.Step>
 *     </Plan.Steps>
 *   </Plan.Content>
 *   <Plan.Footer>
 *     <Button variant="outline">Revise</Button>
 *     <Button>Approve</Button>
 *   </Plan.Footer>
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
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
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
import { useCSSVariable } from 'uniwind';
import { CheckIcon, ChevronDownIcon } from '../../icons';
import { Collapse } from '../../primitives/collapse';
import { Text, textChildren, type TextProps } from '../../primitives/text';
import { cn } from '../../utils/cn';
import { Shimmer } from '../shimmer';

const planVariants = tv({
  slots: {
    root: 'w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm',
    header: 'flex-row items-start gap-3 p-4',
    icon: 'h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted',
    heading: 'min-w-0 flex-1 gap-1',
    title: 'text-base font-semibold text-card-foreground',
    description: 'text-sm text-muted-foreground',
    action: 'shrink-0 flex-row items-center gap-1',
    progress: 'text-xs font-medium text-muted-foreground',
    trigger: 'h-8 w-8 items-center justify-center rounded-full active:bg-accent',
    content: 'gap-2 px-4 pb-4',
    steps: 'w-full',
    step: 'w-full flex-row gap-3',
    stepRail: 'w-4 items-center pt-px',
    stepMarker: 'h-4 w-4 items-center justify-center rounded-full',
    stepConnector: 'w-px flex-1 rounded-full',
    stepBody: 'min-w-0 flex-1 gap-0.5 pb-3',
    stepTitle: 'text-sm',
    stepDescription: 'text-xs text-muted-foreground',
    stepMeta:
      'self-start rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground',
    footer: 'flex-row items-center gap-2 border-t border-border p-4',
  },
});

export type PlanStepStatus = 'pending' | 'active' | 'done' | 'skipped';

/**
 * What each state does to a step's marker, its title and the rail below it.
 *
 * A lookup rather than a `tv()` variant because it belongs to `Plan.Step`, not
 * to `Plan` — a variant here would be read off the root and documented as
 * something you could pass to the card.
 *
 * The connector is filled behind a step that is finished, which is what turns
 * the left-hand column into a progress bar stood on its end: how far the plan
 * has got is readable from the rail alone, without counting markers.
 */
const stepStatus: Record<
  PlanStepStatus,
  { marker: string; title: string; connector: string }
> = {
  pending: {
    marker: 'border border-border',
    title: 'text-muted-foreground',
    connector: 'bg-border',
  },
  active: {
    marker: 'border-2 border-primary',
    title: 'font-medium text-foreground',
    connector: 'bg-border',
  },
  done: {
    marker: 'bg-primary',
    title: 'text-foreground',
    connector: 'bg-primary',
  },
  skipped: {
    marker: 'border border-dashed border-border',
    title: 'text-muted-foreground line-through',
    connector: 'bg-border',
  },
};

/** How far down the rail the plan has got. Reported by `Plan.Steps`. */
export interface PlanStepCounts {
  done: number;
  total: number;
}

interface PlanContextValue {
  isStreaming: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  counts: PlanStepCounts | null;
  reportCounts: (counts: PlanStepCounts) => void;
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

  // `Plan.Steps` counts its own children and reports up, so `Plan.Progress` can
  // sit in the header — above the rail, and with no way to reach it — without
  // the caller having to say how many steps there are twice.
  const [counts, setCounts] = useState<PlanStepCounts | null>(null);
  const reportCounts = useCallback((next: PlanStepCounts) => {
    setCounts((current) =>
      current && current.done === next.done && current.total === next.total ? current : next
    );
  }, []);

  const context = useMemo(
    () => ({ isStreaming, open, setOpen, counts, reportCounts }),
    [isStreaming, open, setOpen, counts, reportCounts]
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
 * the trailing edge as the title wraps, rather than riding down with it. An
 * icon is pulled out to the leading edge for the same reason, in the other
 * direction — a badge that rode down with a wrapping title would stop reading
 * as a badge for the plan.
 */
function PlanHeader({ className, children, ...props }: PlanHeaderProps) {
  const { header, heading } = planVariants();

  const icons: ReactNode[] = [];
  const headings: ReactNode[] = [];
  const actions: ReactNode[] = [];
  for (const child of Array.isArray(children) ? children : [children]) {
    if (isType(child, PlanAction)) actions.push(child);
    else if (isType(child, PlanIcon)) icons.push(child);
    else headings.push(child);
  }

  return (
    <View {...props} className={cn(header(), className)}>
      {icons}
      <View className={heading()}>{headings}</View>
      {actions}
    </View>
  );
}

function isType(child: ReactNode, type: unknown): boolean {
  return (
    typeof child === 'object' &&
    child !== null &&
    'type' in child &&
    (child as { type?: unknown }).type === type
  );
}

export interface PlanIconProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

/** A badge on the header's leading edge — what kind of plan this is. */
function PlanIcon({ className, children, ...props }: PlanIconProps) {
  const { icon } = planVariants();
  return (
    <View {...props} className={cn(icon(), className)}>
      {children}
    </View>
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

/**
 * Where a step sits in the rail. Provided by `Plan.Steps` rather than passed
 * down, so steps produced by a `.map()` through a component of your own still
 * know they are last — a prop set on that wrapper would never reach the step.
 */
const PlanStepContext = createContext<{ last: boolean }>({ last: false });

export interface PlanStepsProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

/**
 * The rail. A plan is an ordered list of things that will happen, and this is
 * the list — a paragraph describing the same four steps cannot be glanced at to
 * see which one is running.
 *
 * It counts its own steps and reports the count up, which is what lets
 * `Plan.Progress` sit in the header without the caller stating the total twice.
 */
function PlanSteps({ className, children, ...props }: PlanStepsProps) {
  const { reportCounts } = usePlan('Plan.Steps');
  const { steps } = planVariants();

  const items = useMemo(
    () => Children.toArray(children).filter((child) => isValidElement(child)),
    [children]
  );

  const counts = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const item of items) {
      if (!isType(item, PlanStep)) continue;
      total += 1;
      // A skipped step is settled too — a plan that reports 2 of 4 while two
      // more were deliberately passed over is reporting the wrong thing.
      const status = (item as ReactElement<PlanStepProps>).props.status;
      if (status === 'done' || status === 'skipped') done += 1;
    }
    return { done, total };
  }, [items]);

  useEffect(() => {
    reportCounts(counts);
  }, [counts, reportCounts]);

  return (
    <View {...props} role="list" className={cn(steps(), className)}>
      {items.map((item, index) => (
        <PlanStepContext.Provider
          // The step's own key stays on the element; this wrapper needs its own.
          key={index}
          value={{ last: index === items.length - 1 }}
        >
          {item}
        </PlanStepContext.Provider>
      ))}
    </View>
  );
}

export interface PlanStepProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** How far this step has got. Decides the marker, the title and the rail below it. */
  status?: PlanStepStatus;
  /** A line under the title — what the step will touch, or what it found. */
  description?: ReactNode;
  /** A file path, a count, a duration. Rendered as a small mono chip. */
  meta?: ReactNode;
  /** Drop the connector below this step. `Plan.Steps` sets it for you. */
  last?: boolean;
  children?: ReactNode;
}

/**
 * One step. The marker says which of the four states it is in and the rail
 * below it is filled once it is done, so the plan's progress is legible from
 * the shape of the left-hand column alone.
 */
function PlanStep({
  className,
  status = 'pending',
  description,
  meta,
  last,
  children,
  ...props
}: PlanStepProps) {
  const { isStreaming } = usePlan('Plan.Step');
  const position = useContext(PlanStepContext);
  const isLast = last ?? position.last;
  const {
    step,
    stepRail,
    stepMarker,
    stepConnector,
    stepBody,
    stepTitle,
    stepDescription,
    stepMeta,
  } = planVariants();
  const tone = stepStatus[status];
  const onPrimary = useCSSVariable('--color-primary-foreground');

  const title = stepTitle({ className: tone.title });
  // Only the step that is running is still arriving. Shimmering a finished one
  // would say it is still being written, and shimmering the whole rail would
  // say nothing at all.
  const streamingTitle = isStreaming && status === 'active' && typeof children === 'string';

  return (
    <View {...props} role="listitem" className={cn(step(), className)}>
      <View className={stepRail()}>
        <View className={stepMarker({ className: tone.marker })}>
          {status === 'done' ? (
            <CheckIcon
              size={10}
              color={typeof onPrimary === 'string' ? onPrimary : '#ffffff'}
            />
          ) : status === 'active' ? (
            <View className="h-1.5 w-1.5 rounded-full bg-primary" />
          ) : null}
        </View>
        {isLast ? null : <View className={stepConnector({ className: tone.connector })} />}
      </View>

      <View className={cn(stepBody(), isLast && 'pb-0')}>
        {streamingTitle ? (
          <Shimmer textClassName={title}>{children as string}</Shimmer>
        ) : (
          textChildren(children, (text) => <Text className={title}>{text}</Text>)
        )}
        {textChildren(description, (text) => (
          <Text className={stepDescription()}>{text}</Text>
        ))}
        {meta === undefined ? null : (
          <View className={stepMeta()}>
            {textChildren(meta, (text) => (
              <Text className="font-mono text-[11px] text-muted-foreground">{text}</Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export interface PlanProgressProps extends TextProps {
  className?: string;
  /** Steps settled so far. Defaults to what `Plan.Steps` counted. */
  value?: number;
  /** Steps in total. Defaults to what `Plan.Steps` counted. */
  total?: number;
}

/**
 * How far down the rail the plan has got, as `2 of 4`. Renders nothing until
 * there is a rail to count — a plan with no steps has no progress to report,
 * and `0 of 0` is worse than silence.
 */
function PlanProgress({ className, value, total, ...props }: PlanProgressProps) {
  const { counts } = usePlan('Plan.Progress');
  const { progress } = planVariants();

  const done = value ?? counts?.done;
  const all = total ?? counts?.total;
  if (done === undefined || !all) return null;

  return (
    <Text className={cn(progress(), className)} {...props}>
      {done} of {all}
    </Text>
  );
}

export interface PlanFooterProps extends ViewProps {
  className?: string;
  /**
   * How the actions divide the row. `stretch` splits it between them, which is
   * what a phone wants: the decision is the point of the card, and the two
   * buttons that make it should be the width of a thumb. `end` packs them
   * against the trailing edge for a plan sitting inside something denser.
   */
  layout?: 'stretch' | 'end';
  children?: ReactNode;
}

/**
 * Where the buttons that answer the plan go.
 *
 * Each action takes an equal share of the row by default. A pair of small
 * buttons hugging the trailing corner is a pointer-and-cursor shape; on a phone
 * the answer to "shall I do this" is the most important control on the screen
 * and wants to be hit without aiming.
 */
function PlanFooter({ className, layout = 'stretch', children, ...props }: PlanFooterProps) {
  const { footer } = planVariants();

  return (
    <View
      {...props}
      className={cn(footer(), layout === 'end' && 'justify-end', className)}
    >
      {layout === 'stretch'
        ? // A view stretches its children across the cross axis by default, so
          // a button inside one of these fills it without being told to.
          Children.map(children, (child) =>
            isValidElement(child) ? <View className="flex-1">{child}</View> : child
          )
        : children}
    </View>
  );
}

PlanHeader.displayName = 'Plan.Header';
PlanIcon.displayName = 'Plan.Icon';
PlanTitle.displayName = 'Plan.Title';
PlanDescription.displayName = 'Plan.Description';
PlanAction.displayName = 'Plan.Action';
PlanProgress.displayName = 'Plan.Progress';
PlanTrigger.displayName = 'Plan.Trigger';
PlanContent.displayName = 'Plan.Content';
PlanSteps.displayName = 'Plan.Steps';
PlanStep.displayName = 'Plan.Step';
PlanFooter.displayName = 'Plan.Footer';

export const Plan = Object.assign(PlanRoot, {
  Header: PlanHeader,
  Icon: PlanIcon,
  Title: PlanTitle,
  Description: PlanDescription,
  Action: PlanAction,
  Progress: PlanProgress,
  Trigger: PlanTrigger,
  Content: PlanContent,
  Steps: PlanSteps,
  Step: PlanStep,
  Footer: PlanFooter,
});
