/**
 * QRCode — a string, drawn as something a camera can read.
 *
 * ```tsx
 * <QRCode value="https://panelui.dev">
 *   <QRCode.Frame>
 *     <QRCode.Canvas />
 *   </QRCode.Frame>
 *   <QRCode.Caption>Scan to open the docs</QRCode.Caption>
 * </QRCode>
 * ```
 *
 * Composition is the API, as everywhere else here: a code in a titled panel is
 * one with a `QRCode.Header` in it, and a code behind a button is one wrapped
 * in a `QRCode.Trigger` and a `QRCode.Content` — not one with a prop turned on.
 *
 * ## What it draws
 *
 * Every dark module is one subpath of a single `<Path>`, not a `<Rect>` of its
 * own. A version 10 code is 3,481 modules; half of them dark is seventeen
 * hundred native views for a picture that never changes, and the difference
 * between that and one node is the difference between a code that appears and
 * one that appears eventually.
 *
 * The colours come from the theme, so a code drawn on a card is legible on
 * every one of them — and light-on-dark is drawn the way scanners expect it,
 * with the quiet zone painted rather than left transparent. A code with
 * nothing behind it reads at about half the distance.
 *
 * ## The hole in the middle
 *
 * `QRCode.Logo` clears a square of modules and puts its children there.
 * Error correction is what makes that survivable — the modules are gone, and
 * the code still reads because there is enough redundancy to reconstruct them.
 * How much is `errorCorrection`, and a logo raises the level it needs: the
 * default `M` tolerates about 15% loss, `H` about 30%. A logo is measured
 * against that budget and the level is raised for you if it has to be.
 */
import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from 'react';
import { View, type ViewProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { tv, type VariantProps } from 'tailwind-variants';
import { useCSSVariable } from 'uniwind';
import { Text } from '../../primitives/text';
import { cn } from '../../utils/cn';
import { Popover, type PopoverContentProps } from '../popover';
import { encodeQr, type ErrorCorrectionLevel, type QrMatrix } from './qr-encode';

export type { ErrorCorrectionLevel };

const qrCodeVariants = tv({
  slots: {
    root: 'items-center gap-3',
    frame: 'overflow-hidden rounded-2xl border border-border bg-card',
    header: 'w-full gap-0.5 px-4 pb-3 pt-4',
    body: 'items-center p-4',
    caption: 'text-center text-sm text-muted-foreground',
    value: 'text-center text-xs text-muted-foreground',
  },
  variants: {
    size: {
      sm: {},
      md: {},
      lg: {},
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

type QrCodeVariantProps = VariantProps<typeof qrCodeVariants>;

/** How big the drawn code is. */
export type QRCodeSize = NonNullable<QrCodeVariantProps['size']>;

/** Side length in points per size. The module grid divides into it. */
const CANVAS_SIZE: Record<QRCodeSize, number> = { sm: 128, md: 180, lg: 240 };

/**
 * The quiet zone, in modules. Four is what the specification asks for and what
 * scanners are tuned to; less and a code against a busy background stops being
 * found at all.
 */
const QUIET_ZONE = 4;

/** Roughly how much of the code each level can lose and still be read. */
const TOLERANCE: Record<ErrorCorrectionLevel, number> = { L: 0.07, M: 0.15, Q: 0.25, H: 0.3 };

/** Ascending, so "the next level up" is a step through this. */
const LEVELS: ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H'];

/** How much of the code a logo of this fraction covers, plus its margin. */
function coverage(logoFraction: number) {
  return logoFraction * logoFraction;
}

/**
 * The level actually used: the one asked for, unless a logo would eat more of
 * the code than it can afford, in which case the next one that can.
 */
function levelFor(requested: ErrorCorrectionLevel, logoFraction: number): ErrorCorrectionLevel {
  const needed = coverage(logoFraction);
  // Half the budget, not all of it: the rest is for the things a code in the
  // world actually loses — glare, a fold, a thumb.
  const affordable = (level: ErrorCorrectionLevel) => TOLERANCE[level] / 2 >= needed;

  if (affordable(requested)) return requested;
  return LEVELS.slice(LEVELS.indexOf(requested)).find(affordable) ?? 'H';
}

interface QRCodeContextValue {
  matrix: QrMatrix | null;
  /** What went wrong, when there is no matrix. */
  error: string | null;
  value: string;
  size: QRCodeSize;
  /** Side of the logo hole as a fraction of the code, `0` for none. */
  logoFraction: number;
  slots: ReturnType<typeof qrCodeVariants>;
}

const QRCodeContext = createContext<QRCodeContextValue | null>(null);

function useQRCode(part: string) {
  const context = useContext(QRCodeContext);
  if (!context) throw new Error(`${part} must be used inside <QRCode>.`);
  return context;
}

/** Where the code is drawn: in place, in a popover, or up from the bottom. */
export type QRCodePresentation = 'inline' | 'popover' | 'bottom-sheet';

export interface QRCodeProps extends Omit<ViewProps, 'children'>, QrCodeVariantProps {
  className?: string;
  /**
   * What the code encodes. Anything: a URL, a WiFi string, a vCard. Encoded
   * as UTF-8, and the version grows to fit it.
   */
  value: string;
  /**
   * How much of the code can be lost and still read — `L` about 7%, `M` 15%,
   * `Q` 25%, `H` 30%. More correction means a denser code at the same size, so
   * `M` is the default. Raised automatically when a `QRCode.Logo` needs it.
   */
  errorCorrection?: ErrorCorrectionLevel;
  /**
   * Fix the QR version, 1–40, instead of taking the smallest that fits. Worth
   * setting when the content changes and the code should not visibly change
   * density with it.
   */
  version?: number;
  /**
   * Where the code appears. `inline` draws it where it sits; the other two
   * put it behind a `QRCode.Trigger` and draw it in a `QRCode.Content`.
   */
  presentation?: QRCodePresentation;
  /** Controlled open state. Ignored while `presentation` is `inline`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

const QRCodeRoot = forwardRef<View, QRCodeProps>(
  (
    {
      className,
      value,
      errorCorrection = 'M',
      version,
      size = 'md',
      presentation = 'inline',
      open,
      onOpenChange,
      children,
      ...props
    },
    ref
  ) => {
    const slots = qrCodeVariants({ size });

    /*
     * A logo is a child, and the matrix has to know about it before the child
     * renders — the level it forces changes the matrix itself. Rather than
     * inspecting children, the fraction is a constant the Logo part also uses,
     * and the root asks whether one is present at all.
     */
    const logoFraction = hasLogo(children) ? LOGO_FRACTION : 0;
    const level = levelFor(errorCorrection, logoFraction);

    const { matrix, error } = useMemo(() => {
      try {
        return { matrix: encodeQr(value, { errorCorrection: level, version }), error: null };
      } catch (cause) {
        // Too much data, or a version too small for it. A throw here would
        // take a screen down over a string, so it draws nothing and says why.
        return { matrix: null, error: (cause as Error).message };
      }
    }, [value, level, version]);

    const context: QRCodeContextValue = { matrix, error, value, size, logoFraction, slots };

    if (presentation !== 'inline') {
      // The provider stays outside the Popover, and Content re-provides it
      // inside — portal content mounts under the portal host, which is not in
      // this subtree.
      return (
        <QRCodeContext.Provider value={context}>
          <Popover open={open} onOpenChange={onOpenChange} presentation={presentation}>
            {children}
          </Popover>
        </QRCodeContext.Provider>
      );
    }

    return (
      <QRCodeContext.Provider value={context}>
        <View ref={ref} className={slots.root({ className })} {...props}>
          {children}
        </View>
      </QRCodeContext.Provider>
    );
  }
);
QRCodeRoot.displayName = 'QRCode';

/* ------------------------------------------------------------------ *
 * The code itself.
 * ------------------------------------------------------------------ */

export interface QRCodeCanvasProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** Side length in points. Defaults to the size variant's. */
  pixelSize?: number;
  /** Dark modules. Defaults to the theme's foreground. */
  color?: string;
  /** The quiet zone and the gaps. Defaults to the theme's card surface. */
  backgroundColor?: string;
}

const QRCodeCanvas = forwardRef<View, QRCodeCanvasProps>(
  ({ className, pixelSize, color, backgroundColor, ...props }, ref) => {
    const { matrix, error, value, size, logoFraction } = useQRCode('QRCode.Canvas');
    const [foreground, card] = useCSSVariable(['--color-foreground', '--color-card']) as (
      | string
      | undefined
    )[];

    const side = pixelSize ?? CANVAS_SIZE[size];
    const dark = color ?? foreground;
    const light = backgroundColor ?? card;

    /*
     * One path for every dark module.
     *
     * The viewBox is in module units, so the path is written once and scales
     * to whatever `side` is — no arithmetic per module, and no rounding gaps
     * between neighbours at fractional sizes.
     */
    const path = useMemo(() => {
      if (!matrix) return '';

      const hole = logoFraction
        ? {
            from: Math.floor((matrix.size * (1 - logoFraction)) / 2),
            to: Math.ceil((matrix.size * (1 + logoFraction)) / 2),
          }
        : null;

      let d = '';
      for (let y = 0; y < matrix.size; y++) {
        for (let x = 0; x < matrix.size; x++) {
          if (!matrix.modules[y]![x]) continue;
          // Modules under the logo are not drawn at all — drawing them and
          // covering them leaves a dark edge wherever the logo is smaller
          // than the square it cleared.
          if (hole && x >= hole.from && x < hole.to && y >= hole.from && y < hole.to) continue;
          d += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
        }
      }
      return d;
    }, [matrix, logoFraction]);

    if (error) {
      // A box the size the code would have been, so the layout does not jump
      // when the value becomes something that fits.
      return (
        <View
          ref={ref}
          accessibilityRole="image"
          accessibilityLabel="QR code could not be generated"
          className={cn('items-center justify-center rounded-lg bg-muted', className)}
          style={{ width: side, height: side }}
          {...props}
        />
      );
    }

    if (!matrix) return null;

    const grid = matrix.size + QUIET_ZONE * 2;

    return (
      <View
        ref={ref}
        accessibilityRole="image"
        accessibilityLabel={`QR code for ${value}`}
        className={className}
        style={{ width: side, height: side }}
        {...props}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${grid} ${grid}`}>
          {/* Painted, not left transparent: a scanner needs the quiet zone to
              be lighter than the code, and "whatever is behind it" is not. */}
          <Path d={`M0 0h${grid}v${grid}h-${grid}z`} fill={light} />
          <Path d={path} fill={dark} />
        </Svg>
      </View>
    );
  }
);
QRCodeCanvas.displayName = 'QRCode.Canvas';

/* ------------------------------------------------------------------ *
 * The shells around it.
 * ------------------------------------------------------------------ */

export interface QRCodeFrameProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

/**
 * The bordered panel a code sits in. With a `QRCode.Header` above it the
 * header takes the top of the panel and the code the rest; without one it is
 * just a padded card.
 */
const QRCodeFrame = forwardRef<View, QRCodeFrameProps>(
  ({ className, children, ...props }, ref) => {
    const { slots } = useQRCode('QRCode.Frame');
    return (
      <View ref={ref} className={slots.frame({ className })} {...props}>
        {children}
      </View>
    );
  }
);
QRCodeFrame.displayName = 'QRCode.Frame';

export interface QRCodeHeaderProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

/** The strip across the top of a frame: a title, and usually a line under it. */
const QRCodeHeader = forwardRef<View, QRCodeHeaderProps>(
  ({ className, children, ...props }, ref) => {
    const { slots } = useQRCode('QRCode.Header');
    return (
      <View ref={ref} className={slots.header({ className })} {...props}>
        {children}
      </View>
    );
  }
);
QRCodeHeader.displayName = 'QRCode.Header';

const QRCodeTitle = forwardRef<Text, { className?: string; children?: ReactNode }>(
  ({ className, children }, ref) => (
    <Text ref={ref as never} size="base" weight="semibold" className={className}>
      {children}
    </Text>
  )
);
QRCodeTitle.displayName = 'QRCode.Title';

const QRCodeDescription = forwardRef<Text, { className?: string; children?: ReactNode }>(
  ({ className, children }, ref) => (
    <Text ref={ref as never} size="sm" muted className={className}>
      {children}
    </Text>
  )
);
QRCodeDescription.displayName = 'QRCode.Description';

export interface QRCodeBodyProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

/** The padded area under a header that the code is centred in. */
const QRCodeBody = forwardRef<View, QRCodeBodyProps>(
  ({ className, children, ...props }, ref) => {
    const { slots } = useQRCode('QRCode.Body');
    return (
      <View ref={ref} className={slots.body({ className })} {...props}>
        {children}
      </View>
    );
  }
);
QRCodeBody.displayName = 'QRCode.Body';

/* ------------------------------------------------------------------ *
 * The readouts.
 * ------------------------------------------------------------------ */

export interface QRCodeCaptionProps {
  className?: string;
  children?: ReactNode;
}

/** A line under the code saying what scanning it does. */
function QRCodeCaption({ className, children }: QRCodeCaptionProps) {
  const { slots } = useQRCode('QRCode.Caption');
  return <Text className={slots.caption({ className })}>{children}</Text>;
}
QRCodeCaption.displayName = 'QRCode.Caption';

export interface QRCodeValueProps {
  className?: string;
  /** Show the whole string rather than one line of it. */
  full?: boolean;
}

/**
 * The encoded string itself, for someone who cannot scan it — typing a URL out
 * is slower than pointing a camera at it and it is the only way through when
 * the camera is the thing you are setting up.
 */
function QRCodeValue({ className, full }: QRCodeValueProps) {
  const { value, slots } = useQRCode('QRCode.Value');
  return (
    <Text
      className={slots.value({ className })}
      numberOfLines={full ? undefined : 1}
      selectable
    >
      {value}
    </Text>
  );
}
QRCodeValue.displayName = 'QRCode.Value';

/* ------------------------------------------------------------------ *
 * The logo.
 * ------------------------------------------------------------------ */

/**
 * How much of the code's width the logo hole takes.
 *
 * Constant rather than a prop, because the value has to be known before the
 * matrix is built — it decides the error-correction level — and a prop on a
 * child cannot be read from the parent without inspecting the tree. A quarter
 * costs about 6% of the modules, which every level above `L` can afford.
 */
const LOGO_FRACTION = 0.25;

export interface QRCodeLogoProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

/** Whether the tree contains a `QRCode.Logo`, without walking it deeply. */
function hasLogo(children: ReactNode): boolean {
  let found = false;

  const walk = (node: ReactNode) => {
    if (found || !node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const element = node as ReactElement<{ children?: ReactNode }> & { type?: unknown };
    if (typeof element !== 'object' || !('type' in element)) return;
    if (element.type === QRCodeLogo) {
      found = true;
      return;
    }
    walk(element.props?.children);
  };

  walk(children);
  return found;
}

/**
 * Content for the cleared square in the middle — a mark, an avatar, an icon.
 * Its presence is what clears the square, and what raises the error-correction
 * level if the one asked for could not afford it.
 */
const QRCodeLogo = forwardRef<View, QRCodeLogoProps>(
  ({ className, children, ...props }, ref) => {
    const { size } = useQRCode('QRCode.Logo');
    const side = CANVAS_SIZE[size] * LOGO_FRACTION;

    return (
      <View
        ref={ref}
        pointerEvents="none"
        className={cn('absolute items-center justify-center', className)}
        style={{ width: side, height: side }}
        {...props}
      >
        {children}
      </View>
    );
  }
);
QRCodeLogo.displayName = 'QRCode.Logo';

/* ------------------------------------------------------------------ *
 * Folded away.
 * ------------------------------------------------------------------ */

export interface QRCodeTriggerProps {
  /** The element that opens it. Must accept `onPress`. */
  children: ReactElement<{ onPress?: (...args: unknown[]) => void }>;
}

/** What opens a `popover` or `bottom-sheet` code. */
function QRCodeTrigger({ children }: QRCodeTriggerProps) {
  useQRCode('QRCode.Trigger');
  return <Popover.Trigger>{children}</Popover.Trigger>;
}
QRCodeTrigger.displayName = 'QRCode.Trigger';

export interface QRCodeContentProps extends PopoverContentProps {}

/** The panel the code is drawn in, when it is not drawn in place. */
function QRCodeContent({ className, width = 'content-fit', children, ...props }: QRCodeContentProps) {
  const context = useQRCode('QRCode.Content');
  return (
    <Popover.Content width={width} className={cn('items-center gap-3', className)} {...props}>
      <QRCodeContext.Provider value={context}>{children}</QRCodeContext.Provider>
    </Popover.Content>
  );
}
QRCodeContent.displayName = 'QRCode.Content';

export const QRCode = Object.assign(QRCodeRoot, {
  Canvas: QRCodeCanvas,
  Frame: QRCodeFrame,
  Header: QRCodeHeader,
  Title: QRCodeTitle,
  Description: QRCodeDescription,
  Body: QRCodeBody,
  Caption: QRCodeCaption,
  Value: QRCodeValue,
  Logo: QRCodeLogo,
  Trigger: QRCodeTrigger,
  Content: QRCodeContent,
});
