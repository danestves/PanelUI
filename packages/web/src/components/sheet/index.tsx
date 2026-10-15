'use client';

/**
 * Sheet — a panel that rises over the page from one of its edges, floating
 * clear of them, and leaves with a swipe.
 *
 * ```tsx
 * <Sheet>
 *   <Sheet.Trigger render={<Button />}>Edit profile</Sheet.Trigger>
 *   <Sheet.Content>
 *     <Sheet.Header title="Edit profile" description="Shown on your public page." />
 *     <Sheet.Body>…</Sheet.Body>
 *     <Sheet.Footer>
 *       <Button>Save</Button>
 *       <Sheet.Close render={<Button variant="ghost" />}>Cancel</Sheet.Close>
 *     </Sheet.Footer>
 *   </Sheet.Content>
 * </Sheet>
 * ```
 *
 * ## It floats
 *
 * A sheet that holds a task for the page is a card laid over it, so by
 * default it stands a few pixels off every edge with all four corners rounded.
 * The corners are large and concentric with the gap around them, which is what
 * makes the card read as belonging to the screen it sits in rather than as a
 * box dropped onto it. `size="full"` or `detached={false}` gives the gap up and
 * meets the edges, for a sheet that needs every pixel.
 *
 * ## Sheets stack
 *
 * A sheet opened from inside another slides over it from the same edge, and
 * the one underneath steps back: a little smaller, pushed inward so its edge
 * still shows, and dimmed. Only the first sheet darkens the page, so two open
 * sheets do not stack two shades of black.
 *
 * ## The hand decides
 *
 * Every sheet follows a drag and leaves on a flick toward its own edge. The
 * grabber on a top or bottom sheet says so before anybody tries.
 */
import { Drawer } from '@base-ui/react/drawer';
import { ScrollArea } from '@base-ui/react/scroll-area';
import {
  createContext,
  useContext,
  useMemo,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import { tv } from 'tailwind-variants';

/*
 * One curve for every movement: the sheet arriving, the one behind it stepping
 * back, the page receding. A fast start that eases into place reads as weight,
 * where a symmetric ease reads as a slide show.
 */
const MOVE =
  '[transition:transform_450ms_cubic-bezier(0.32,0.72,0,1),border-radius_450ms_cubic-bezier(0.32,0.72,0,1),margin_450ms_cubic-bezier(0.32,0.72,0,1)]';

const sheetVariants = tv({
  slots: {
    backdrop: [
      'fixed inset-0 z-50 bg-black opacity-[calc(var(--sheet-dim)*(1-var(--drawer-swipe-progress,0)))]',
      '[--sheet-dim:0.28] dark:[--sheet-dim:0.5]',
      'transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0',
      'data-starting-style:opacity-0 data-ending-style:opacity-0',
      'data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*400ms)] motion-reduce:transition-none',
    ],
    /*
     * The viewport holds the gap. The sheet is laid out inside it, so the
     * distance to every edge is one number, and the corner radius below is
     * that number's companion.
     */
    viewport: 'pointer-events-none fixed inset-0 z-50 flex [--sheet-gap:0.5rem] sm:[--sheet-gap:0.75rem]',
    popup: [
      'group/sheet pointer-events-auto relative flex min-h-0 flex-col bg-popover text-popover-foreground outline-none',
      'shadow-[0_24px_64px_-16px_rgb(0_0_0/0.3)] ring-1 ring-foreground/[0.06] dark:ring-foreground/10',
      MOVE,
      'data-swiping:select-none data-swiping:duration-0 data-nested-drawer-swiping:duration-0',
      'data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*400ms)]',
      'motion-reduce:transition-none',
      /*
       * The stack. Each sheet behind the front one is 4% smaller and pushed
       * 14px inward from its edge, so a strip of it shows past the one in front
       * and the depth can be counted. It scales about its inner edge, so the
       * strip stays put while it shrinks.
       */
      '[--sheet-scale:calc(1-var(--nested-drawers,0)*0.04)] [--sheet-push:calc(var(--nested-drawers,0)*14px)]',
      // A veil in the sheet's own colour: what is on the sheet behind fades, the
      // same way in either theme, instead of going grey under a black tint.
      "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-popover after:opacity-0 after:transition-opacity after:duration-[450ms] after:content-['']",
      'data-nested-drawer-open:after:opacity-50',
    ],
    grabber: [
      'pointer-events-none absolute inset-x-0 z-10 mx-auto flex h-6 w-24 justify-center',
      'before:h-[5px] before:w-9 before:rounded-full before:bg-muted-foreground/35',
    ],
    close: [
      'absolute end-4 top-4 z-10 inline-flex size-8 cursor-pointer items-center justify-center rounded-full',
      'bg-muted text-muted-foreground outline-none transition-[background-color,color,scale] duration-150',
      'after:absolute after:-inset-1.5 hover:bg-foreground/10 hover:text-foreground active:scale-95',
      'focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
    ],
    header: 'flex shrink-0 flex-col gap-1 px-6 pt-6 pb-3',
    title: 'text-[19px] font-semibold leading-6 tracking-[-0.01em]',
    description: 'text-[15px] leading-5 text-muted-foreground',
    body: 'relative flex min-h-0 flex-1 flex-col',
    bodyViewport: 'min-h-0 flex-1 overscroll-contain outline-none',
    bodyContent: 'px-6 pb-2',
    scrollbar:
      'my-3 me-1 flex w-1.5 opacity-0 transition-opacity delay-300 data-hovering:opacity-100 data-hovering:delay-0 data-scrolling:opacity-100 data-scrolling:delay-0',
    thumb: 'relative flex-1 rounded-full bg-foreground/20',
    footer: 'flex shrink-0 flex-col gap-2 px-6 pt-3 pb-6',
    /*
     * The page behind steps back by 3%, not more: enough to read as a layer
     * underneath, not so much that the page looks like it shrank. It keeps its
     * own colours and draws no outline of its own: the only edge is the strip
     * of the surface it steps back onto, which is the muted tone of the theme
     * rather than black, so it is quiet in light and dark alike. A rim on top
     * of that strip doubles every border the page sits inside.
     *
     * It shrinks about its centre, so the strip is the same width on every
     * side, and its corners take `--stage-radius`: set that to the radius of
     * whatever the stage sits in, less the strip, and the two outlines are
     * concentric instead of a second, tighter curve inside the first.
     */
    stage: 'relative isolate overflow-hidden [--stage-radius:1rem]',
    stageBackground: 'absolute inset-0 -z-10 bg-muted',
    stagePage: [
      'relative h-full origin-center bg-background will-change-transform',
      'transition-[transform,border-radius] duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
      '[--stage-progress:calc(1-var(--drawer-swipe-progress,0))]',
      'data-active:[transform:scale(calc(1-0.03*var(--stage-progress)))]',
      'data-active:overflow-hidden data-active:rounded-[calc(var(--stage-radius)*var(--stage-progress))]',
    ],
  },
  variants: {
    side: {
      bottom: {
        grabber: 'top-0 items-start pt-1.5',
        viewport:
          'items-end justify-center px-(--sheet-gap) pt-12 pb-[max(var(--sheet-gap),env(safe-area-inset-bottom))]',
        popup: [
          'max-h-full w-full max-w-lg origin-[50%_0] rounded-[32px]',
          '[transform:translateY(calc(var(--drawer-swipe-movement-y,0px)-var(--sheet-push)))_scale(var(--sheet-scale))]',
          'data-starting-style:[transform:translateY(calc(100%+var(--sheet-gap)+2rem))]',
          'data-ending-style:[transform:translateY(calc(100%+var(--sheet-gap)+2rem))]',
        ],
      },
      top: {
        // Swiped up, so the grabber sits on the edge the hand pushes.
        grabber: 'bottom-0 items-end pb-1.5',
        viewport:
          'items-start justify-center px-(--sheet-gap) pb-12 pt-[max(var(--sheet-gap),env(safe-area-inset-top))]',
        popup: [
          'max-h-full w-full max-w-lg origin-[50%_100%] rounded-[32px]',
          '[transform:translateY(calc(var(--drawer-swipe-movement-y,0px)+var(--sheet-push)))_scale(var(--sheet-scale))]',
          'data-starting-style:[transform:translateY(calc(-100%-var(--sheet-gap)-2rem))]',
          'data-ending-style:[transform:translateY(calc(-100%-var(--sheet-gap)-2rem))]',
        ],
      },
      left: {
        viewport: 'items-stretch justify-start p-(--sheet-gap)',
        popup: [
          'h-full w-[min(24rem,calc(100vw-2*var(--sheet-gap)))] origin-[100%_50%] rounded-[28px]',
          '[transform:translateX(calc(var(--drawer-swipe-movement-x,0px)+var(--sheet-push)))_scale(var(--sheet-scale))]',
          'data-starting-style:[transform:translateX(calc(-100%-var(--sheet-gap)-2rem))]',
          'data-ending-style:[transform:translateX(calc(-100%-var(--sheet-gap)-2rem))]',
        ],
      },
      right: {
        viewport: 'items-stretch justify-end p-(--sheet-gap)',
        popup: [
          'h-full w-[min(24rem,calc(100vw-2*var(--sheet-gap)))] origin-[0_50%] rounded-[28px]',
          '[transform:translateX(calc(var(--drawer-swipe-movement-x,0px)-var(--sheet-push)))_scale(var(--sheet-scale))]',
          'data-starting-style:[transform:translateX(calc(100%+var(--sheet-gap)+2rem))]',
          'data-ending-style:[transform:translateX(calc(100%+var(--sheet-gap)+2rem))]',
        ],
      },
    },
    size: {
      auto: {},
      half: { popup: 'h-[min(50dvh,100%)]' },
      full: { popup: 'h-full' },
    },
    // Meets the edges it rises from instead of standing clear of them.
    attached: {
      true: {},
    },
    blur: {
      true: { backdrop: 'backdrop-blur-sm [--sheet-dim:0.16] dark:[--sheet-dim:0.36]' },
    },
  },
  compoundVariants: [
    {
      side: 'bottom',
      attached: true,
      class: {
        popup:
          '-mx-(--sheet-gap) -mb-[max(var(--sheet-gap),env(safe-area-inset-bottom))] max-w-[calc(100%+2*var(--sheet-gap))] rounded-b-none pb-[env(safe-area-inset-bottom)] sm:mx-0 sm:max-w-2xl',
      },
    },
    {
      side: 'top',
      attached: true,
      class: {
        popup:
          '-mx-(--sheet-gap) -mt-[max(var(--sheet-gap),env(safe-area-inset-top))] max-w-[calc(100%+2*var(--sheet-gap))] rounded-t-none sm:mx-0 sm:max-w-2xl',
      },
    },
    { side: 'left', attached: true, class: { popup: '-my-(--sheet-gap) -ms-(--sheet-gap) rounded-s-none' } },
    { side: 'right', attached: true, class: { popup: '-my-(--sheet-gap) -me-(--sheet-gap) rounded-e-none' } },
  ],
  defaultVariants: { side: 'bottom', size: 'auto' },
});

/** Where the sheet rises from, which is also the direction it leaves in. */
export type SheetSide = 'bottom' | 'top' | 'left' | 'right';

const SWIPE: Record<SheetSide, 'down' | 'up' | 'left' | 'right'> = {
  bottom: 'down',
  top: 'up',
  left: 'left',
  right: 'right',
};

interface SheetContextValue {
  side: SheetSide;
  /** Opened from inside another sheet, which already darkens the page. */
  nested: boolean;
  /** Set by `Sheet.Content`. */
  inline: boolean;
  showClose: boolean;
}

const SheetContext = createContext<SheetContextValue | null>(null);

function useSheet(part: string): SheetContextValue {
  const context = useContext(SheetContext);
  if (!context) throw new Error(`${part} must be used inside a <Sheet>.`);
  return context;
}

export interface SheetProps {
  children?: ReactNode;
  /** Whether the sheet is open, when the caller holds that. */
  open?: boolean;
  /** Called when the sheet asks to open or close. */
  onOpenChange?: (open: boolean) => void;
  /** Whether it starts open, when the caller does not hold it. */
  defaultOpen?: boolean;
  /** The edge it rises from and is swiped back to. Default `bottom`. */
  side?: SheetSide;
  /**
   * Whether a click outside, a swipe or Escape closes it. Turn it off for a
   * sheet that must be answered; `Sheet.Close` still works.
   */
  dismissible?: boolean;
}

function SheetRoot({
  children,
  open,
  onOpenChange,
  defaultOpen = false,
  side = 'bottom',
  dismissible = true,
}: SheetProps) {
  // A sheet inside another sheet's content finds that sheet's context.
  const parent = useContext(SheetContext);
  const context = useMemo<SheetContextValue>(
    () => ({ side, nested: parent !== null && !parent.inline, inline: false, showClose: true }),
    [side, parent]
  );

  return (
    <SheetContext.Provider value={context}>
      <Drawer.Root
        open={open}
        defaultOpen={defaultOpen}
        swipeDirection={SWIPE[side]}
        disablePointerDismissal={!dismissible}
        onOpenChange={(next, details) => {
          // The primitive has a switch for a press outside and none for
          // Escape or a swipe, so those are refused here.
          if (
            !next &&
            !dismissible &&
            details.reason !== 'close-press' &&
            details.reason !== 'imperative-action'
          ) {
            return;
          }
          onOpenChange?.(next);
        }}
      >
        {children}
      </Drawer.Root>
    </SheetContext.Provider>
  );
}
SheetRoot.displayName = 'Sheet';

export interface SheetTriggerProps extends Omit<ComponentProps<'button'>, 'children'> {
  children?: ReactNode;
  /**
   * Your own element to be the trigger, such as a styled button. It is given
   * the click handler and the attributes that tie it to the sheet.
   */
  render?: ReactElement;
}

/** What opens the sheet. A plain button unless `render` supplies one. */
function SheetTrigger({ render, children, ...props }: SheetTriggerProps) {
  return (
    <Drawer.Trigger render={render} {...props}>
      {children}
    </Drawer.Trigger>
  );
}
SheetTrigger.displayName = 'Sheet.Trigger';

export interface SheetContentProps extends Omit<ComponentProps<'div'>, 'children'> {
  children?: ReactNode;
  /**
   * Stand clear of the screen edges with every corner rounded. On by default;
   * off, the sheet meets the edges it rises from.
   */
  detached?: boolean;
  /**
   * How tall a top or bottom sheet is. `auto` fits the content; `half` and
   * `full` take that share of the screen, and `full` meets the edges.
   */
  size?: 'auto' | 'half' | 'full';
  /** Show the grabber. On by default for a top or bottom sheet. */
  showGrabber?: boolean;
  /** Show the round close button in the top trailing corner. Default true. */
  showClose?: boolean;
  /** Frost the page behind the sheet instead of only dimming it. */
  blur?: boolean;
  /**
   * Draw the sheet in the page instead of over it: no backdrop, no trigger,
   * always there. For previews and for a layout that shows the sheet as part
   * of a screen.
   */
  inline?: boolean;
}

/** The sheet itself, with the backdrop behind it. */
function SheetContent({
  children,
  detached = true,
  size = 'auto',
  showGrabber,
  showClose = true,
  blur = false,
  inline = false,
  className,
  ...props
}: SheetContentProps) {
  const sheet = useSheet('Sheet.Content');
  const vertical = sheet.side === 'bottom' || sheet.side === 'top';
  const slots = sheetVariants({
    side: sheet.side,
    size: vertical ? size : undefined,
    attached: !detached || (vertical && size === 'full'),
    blur,
  });
  const context = useMemo(() => ({ ...sheet, inline, showClose }), [sheet, inline, showClose]);

  const inside = (
    <>
      {(showGrabber ?? vertical) ? <div aria-hidden className={slots.grabber()} /> : null}
      {showClose ? <SheetClose aria-label="Close" className={slots.close()} icon /> : null}
      {children}
    </>
  );

  if (inline) {
    return (
      <SheetContext.Provider value={context}>
        <div className={slots.popup({ className: ['[transform:none]', className] })} {...props}>
          {inside}
        </div>
      </SheetContext.Provider>
    );
  }

  return (
    <Drawer.Portal>
      {/* The first sheet darkens the page; one opened from it does not add a second shade. */}
      {sheet.nested ? null : <Drawer.Backdrop className={slots.backdrop()} />}
      <Drawer.Viewport className={slots.viewport()}>
        <Drawer.Popup className={slots.popup({ className })} {...props}>
          {/* The popup is portalled out from under the provider, so the
              context is given again for the parts inside it. */}
          <SheetContext.Provider value={context}>{inside}</SheetContext.Provider>
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  );
}
SheetContent.displayName = 'Sheet.Content';

export interface SheetHeaderProps extends Omit<ComponentProps<'div'>, 'title'> {
  /** The heading. In an open sheet it is also what the sheet is announced as. */
  title?: ReactNode;
  /** A line under the heading. */
  description?: ReactNode;
}

/**
 * The heading block. It leaves room for the close button beside the title,
 * so the two share the top line instead of stacking.
 */
function SheetHeader({ title, description, className, children, ...props }: SheetHeaderProps) {
  const { showClose } = useSheet('Sheet.Header');
  const slots = sheetVariants();
  return (
    <div className={slots.header({ className: [showClose && 'pe-14', className] })} {...props}>
      {title !== undefined ? <SheetTitle>{title}</SheetTitle> : null}
      {description !== undefined ? <SheetDescription>{description}</SheetDescription> : null}
      {children}
    </div>
  );
}
SheetHeader.displayName = 'Sheet.Header';

export interface SheetTitleProps extends ComponentProps<'h2'> {}

/** The sheet's name, announced when it opens. */
function SheetTitle({ className, ...props }: SheetTitleProps) {
  const { inline } = useSheet('Sheet.Title');
  const slots = sheetVariants();
  if (inline) return <h2 className={slots.title({ className })} {...props} />;
  return <Drawer.Title className={slots.title({ className })} {...props} />;
}
SheetTitle.displayName = 'Sheet.Title';

export interface SheetDescriptionProps extends ComponentProps<'p'> {}

/** A sentence under the title, read out after it. */
function SheetDescription({ className, ...props }: SheetDescriptionProps) {
  const { inline } = useSheet('Sheet.Description');
  const slots = sheetVariants();
  if (inline) return <p className={slots.description({ className })} {...props} />;
  return <Drawer.Description className={slots.description({ className })} {...props} />;
}
SheetDescription.displayName = 'Sheet.Description';

export interface SheetBodyProps extends ComponentProps<'div'> {}

/**
 * The part that scrolls. The header and footer stay put while it moves, and
 * the scrollbar is a thin drawn thumb that shows while the content is moving.
 */
function SheetBody({ className, children, ...props }: SheetBodyProps) {
  const slots = sheetVariants();
  return (
    <ScrollArea.Root className={slots.body()}>
      <ScrollArea.Viewport className={slots.bodyViewport()}>
        <ScrollArea.Content className={slots.bodyContent({ className })} {...props}>
          {children}
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" className={slots.scrollbar()}>
        <ScrollArea.Thumb className={slots.thumb()} />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}
SheetBody.displayName = 'Sheet.Body';

export interface SheetFooterProps extends ComponentProps<'div'> {}

/** The actions, stacked full width at the bottom of the sheet. */
function SheetFooter({ className, ...props }: SheetFooterProps) {
  const slots = sheetVariants();
  return <div className={slots.footer({ className })} {...props} />;
}
SheetFooter.displayName = 'Sheet.Footer';

export interface SheetCloseProps extends ComponentProps<'button'> {
  /**
   * Your own element to close the sheet with, such as a Cancel button.
   * Without it, and without children, this is the round close button.
   */
  render?: ReactElement;
  /** Draw the cross glyph. Set for you on the built-in close button. */
  icon?: boolean;
}

/** Closes the sheet. Works even when `dismissible` is off. */
function SheetClose({ render, icon = false, children, ...props }: SheetCloseProps) {
  const { inline } = useSheet('Sheet.Close');
  const content = icon ? (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ) : (
    children
  );
  if (inline) {
    return (
      <button type="button" {...props}>
        {content}
      </button>
    );
  }
  return (
    <Drawer.Close render={render} {...props}>
      {content}
    </Drawer.Close>
  );
}
SheetClose.displayName = 'Sheet.Close';

export interface SheetStageProps extends ComponentProps<'div'> {}

/**
 * Wrap the app — or the part of the page a sheet belongs to — in this, and
 * the page steps back slightly while a sheet is open. Sheets opened anywhere
 * inside it take part.
 */
function SheetStage({ className, children, ...props }: SheetStageProps) {
  const slots = sheetVariants();
  return (
    <Drawer.Provider>
      <div className={slots.stage({ className })} {...props}>
        <Drawer.IndentBackground className={slots.stageBackground()} />
        <Drawer.Indent className={slots.stagePage()}>{children}</Drawer.Indent>
      </div>
    </Drawer.Provider>
  );
}
SheetStage.displayName = 'Sheet.Stage';

export const Sheet = Object.assign(SheetRoot, {
  Trigger: SheetTrigger,
  Content: SheetContent,
  Header: SheetHeader,
  Title: SheetTitle,
  Description: SheetDescription,
  Body: SheetBody,
  Footer: SheetFooter,
  Close: SheetClose,
  Stage: SheetStage,
});

export {
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetClose,
  SheetStage,
};
