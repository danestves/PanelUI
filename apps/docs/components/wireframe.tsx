import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The kit every gallery thumbnail is drawn from.
 *
 * A thumbnail on the components index is not a screenshot and not the real
 * component. It is a wireframe: grey bars where text goes, plain rectangles
 * where surfaces go, and one accent where the component's primary control is.
 * Six primitives, and the whole set of a hundred and sixteen is built from
 * them.
 *
 * Three reasons it is drawn rather than captured.
 *
 * A screenshot of a React Native component would have to be recorded on a
 * device, re-recorded whenever the component changed, and would carry that
 * device's type sizes into a web page — a hundred and sixteen of them is a
 * hundred and sixteen files nobody can regenerate in a hurry.
 *
 * Rendering the real component is not available either: these are React Native
 * components, and this is a Next.js page.
 *
 * And a wireframe is what the reader wants at this size anyway. At 200 points
 * tall the question is "which one of these is the shape I need", and the
 * silhouette answers it where legible text would not fit to.
 *
 * Everything here is tone-only — no component ever picks a colour. That is
 * what keeps a page of a hundred and sixteen cards reading as one set instead
 * of as a hundred and sixteen opinions, and it is what makes them work in both
 * themes without a single dark-mode override.
 */

/** A line of text. `faint` is body copy, the default is a heading or a label. */
export function Bar({
  className,
  faint,
}: {
  className?: string;
  faint?: boolean;
}) {
  return (
    <div
      className={cn(
        'h-1.5 rounded-full',
        faint ? 'bg-fd-muted-foreground/25' : 'bg-fd-muted-foreground/45',
        className
      )}
    />
  );
}

/** An icon. Muted, and the same size everywhere, so it reads as a glyph slot. */
export function Glyph({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return <Icon className={cn('size-4 shrink-0 text-fd-muted-foreground/70', className)} />;
}

/**
 * The one filled thing in a thumbnail — the component's primary control.
 *
 * At most one per card. Two accents and the card stops saying which part of it
 * is the point.
 */
export function Accent({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return <div className={cn('rounded-md bg-fd-primary/85', className)}>{children}</div>;
}

/**
 * A line of text *on* an `Accent` — the label inside a filled control.
 *
 * Its own primitive because it is the one place a bar is not drawn in the
 * muted tone: on top of the accent it has to be the accent's contrasting
 * colour, and in a dark theme that fill is near-white. Without it a filled
 * button is a blank rectangle, which is what a button with no label is.
 */
export function AccentBar({ className }: { className?: string }) {
  return <div className={cn('h-1.5 rounded-full bg-fd-primary-foreground/60', className)} />;
}

/** A dim shape: a track, an inactive chip, a placeholder tile. */
export function Fill({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return <div className={cn('rounded-md bg-fd-muted-foreground/15', className)}>{children}</div>;
}

/** A surface with an edge — a card, a sheet, a popover, a field. */
export function Plate({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-fd-border bg-fd-card shadow-sm',
        className
      )}
    >
      {children}
    </div>
  );
}

/** A row of things with the standard gap, so every thumbnail spaces alike. */
export function Row({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return <div className={cn('flex items-center gap-2', className)}>{children}</div>;
}

/** A column of things, same reason. */
export function Stack({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return <div className={cn('flex flex-col gap-2', className)}>{children}</div>;
}

/**
 * The frame a chart thumbnail is drawn in.
 *
 * The charts are the one group whose silhouette *is* the component — a bar
 * chart and a line chart differ in nothing else at this size — so they get an
 * SVG rather than a stack of divs. One viewBox for all sixteen, so a bar in
 * one is the same height as a bar in the next and the row reads as a set.
 *
 * Everything inside uses `currentColor`, and the frame sets that from the
 * muted token — so a chartlet needs no colour of its own and follows the theme
 * with the rest of the page.
 */
export function Chartlet({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 120 64"
      className={cn('w-full max-w-52 text-fd-muted-foreground/45', className)}
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
