/**
 * The three miniatures a theme selector is made of.
 *
 * Drawn from fixed neutrals rather than from theme tokens, which is the one
 * thing about this file that is not obvious. A preview built out of the active
 * theme's colours shows the reader the theme they already have, three times —
 * the light option has to look light while the app around it is dark, or it is
 * not a preview of anything.
 *
 * The greys are the ones a screenshot of an app would actually have: a ground,
 * a surface sitting on it, a mark, and the lines of text. Two sets, and the
 * system option draws both.
 */
import { useId, type ReactNode } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

/** Which of the three a preview is drawing. */
export type ThemePreviewMode = 'system' | 'light' | 'dark';

/** How the miniature is drawn. */
export type ThemePreviewVariant = 'window' | 'card';

interface Palette {
  /** Behind everything — the desktop, the page, the space around the app. */
  ground: string;
  /** The app's own surface. */
  surface: string;
  /** A shape on it: an avatar, an image, a control. */
  mark: string;
  /** Lines of text. */
  line: string;
}

const PALETTE: Record<'light' | 'dark', Palette> = {
  light: { ground: '#e5e5e5', surface: '#ffffff', mark: '#d4d4d4', line: '#e5e5e5' },
  dark: { ground: '#171717', surface: '#262626', mark: '#525252', line: '#404040' },
};

/**
 * The one colour that is not a grey.
 *
 * Fixed for the same reason the greys are, and warm rather than blue: it has to
 * read as "a colour in the app" on both grounds without looking like the ring
 * that marks the chosen option.
 */
const ACCENT = '#c1704f';

/** Everything is drawn in this box and scaled by the container. */
const VIEW_BOX = { width: 88, height: 70 };

/**
 * The lower-right half of the box, cut from the top-right corner to the
 * bottom-left one. Both text lines sit above it and the accent below it, which
 * is what makes one card show a light screen and a dark one at the same time.
 */
const DIAGONAL = `M${VIEW_BOX.width} 0V${VIEW_BOX.height}H0Z`;

/* -------------------------------------------------------------------------- *
 * window — an app screen, with the panel inset from the leading edge
 * -------------------------------------------------------------------------- */

function WindowHalf({ palette, side }: { palette: Palette; side: 'left' | 'right' | 'full' }) {
  if (side === 'full') {
    return (
      <>
        <Rect x={0} y={0} width={88} height={70} fill={palette.ground} />
        <Path d="M10 12a4 4 0 0 1 4-4h74v62H10V12Z" fill={palette.surface} />
        <Circle cx={28} cy={26} r={8} fill={palette.mark} />
        <Rect x={20} y={42} width={58} height={4} rx={2} fill={palette.line} />
        <Rect x={20} y={49} width={58} height={4} rx={2} fill={palette.line} />
        <Rect x={20} y={56} width={29} height={4} rx={2} fill={palette.line} />
      </>
    );
  }

  /*
   * Half a screen each, and the halves are not mirror images: the panel starts
   * at the same inset on the left and runs to the edge on the right, so the
   * seam falls where the two app surfaces meet rather than down the middle of
   * one of them.
   */
  const x = side === 'left' ? 0 : 44;
  return (
    <>
      <Rect x={x} y={0} width={44} height={70} fill={palette.ground} />
      {side === 'left' ? (
        <>
          <Path d="M10 12a4 4 0 0 1 4-4h30v62H10V12Z" fill={palette.surface} />
          <Circle cx={28} cy={26} r={8} fill={palette.mark} />
          <Rect x={20} y={42} width={24} height={4} rx={2} fill={palette.line} />
          <Rect x={20} y={49} width={24} height={4} rx={2} fill={palette.line} />
          <Rect x={20} y={56} width={24} height={4} rx={2} fill={palette.line} />
        </>
      ) : (
        <>
          <Path d="M54 12a4 4 0 0 1 4-4h30v62H54V12Z" fill={palette.surface} />
          <Circle cx={72} cy={26} r={8} fill={palette.mark} />
          <Rect x={64} y={42} width={24} height={4} rx={2} fill={palette.line} />
          <Rect x={64} y={49} width={24} height={4} rx={2} fill={palette.line} />
          <Rect x={64} y={56} width={24} height={4} rx={2} fill={palette.line} />
        </>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- *
 * card — a framed card, with an accent on it
 * -------------------------------------------------------------------------- */

function CardBody({ palette }: { palette: Palette }) {
  return (
    <>
      <Rect x={4} y={4} width={80} height={62} rx={14} fill={palette.ground} />
      <Rect x={12} y={12} width={64} height={46} rx={9} fill={palette.surface} />
      <Rect x={20} y={21} width={32} height={4} rx={2} fill={palette.line} />
      <Rect x={20} y={29} width={22} height={4} rx={2} fill={palette.line} />
    </>
  );
}

export interface ThemePreviewProps {
  mode: ThemePreviewMode;
  variant?: ThemePreviewVariant;
  width: number;
}

/**
 * One miniature.
 *
 * `width` rather than a scale factor: the option's box is what decides the
 * size, and everything inside is drawn against a fixed box and scaled by the
 * viewBox — so the geometry above never has to know how big it ended up.
 */
export function ThemePreview({ mode, variant = 'window', width }: ThemePreviewProps): ReactNode {
  const height = Math.round((width / VIEW_BOX.width) * VIEW_BOX.height);
  /*
   * `useId` returns something with colons in it, which is not a name an SVG
   * fragment reference accepts — a clip that silently fails to resolve draws
   * nothing at all, and on a shape covering half the artwork that is the whole
   * option missing.
   */
  const clip = `panelui-theme-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;

  if (variant === 'card') {
    return (
      <Svg width={width} height={height} viewBox="0 0 88 70">
        <CardBody palette={PALETTE[mode === 'dark' ? 'dark' : 'light']} />

        {mode === 'system' ? (
          <>
            {/*
              The other half, cut corner to corner.
              
              The same triangle twice, clipped once to the frame and once to
              the card inside it, rather than one shape tracing where the
              diagonal crosses both. Two clips is less arithmetic than one path
              and stays right if either radius changes; an unclipped triangle
              squares off the two corners the diagonal runs into.
            */}
            <Defs>
              <ClipPath id={`${clip}-frame`}>
                <Rect x={4} y={4} width={80} height={62} rx={14} />
              </ClipPath>
              <ClipPath id={`${clip}-card`}>
                <Rect x={12} y={12} width={64} height={46} rx={9} />
              </ClipPath>
            </Defs>
            <G clipPath={`url(#${clip}-frame)`}>
              <Path d={DIAGONAL} fill={PALETTE.dark.ground} />
            </G>
            <G clipPath={`url(#${clip}-card)`}>
              <Path d={DIAGONAL} fill={PALETTE.dark.surface} />
            </G>
          </>
        ) : null}

        <Circle cx={62} cy={45} r={7} fill={ACCENT} />
      </Svg>
    );
  }

  return (
    <Svg width={width} height={height} viewBox="0 0 88 70">
      {mode === 'system' ? (
        <>
          <WindowHalf palette={PALETTE.light} side="left" />
          <WindowHalf palette={PALETTE.dark} side="right" />
        </>
      ) : (
        <WindowHalf palette={PALETTE[mode]} side="full" />
      )}
    </Svg>
  );
}
