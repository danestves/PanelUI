import { createContext, createElement, useContext, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  breakpointAt,
  breakpointEntries,
  type BreakpointDefinition,
} from './breakpoint-contract';

/** Tailwind's breakpoints, minus the ones no phone or tablet reaches. */
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;
const DEFAULT_ENTRIES = breakpointEntries(BREAKPOINTS);

export type Breakpoint = keyof typeof BREAKPOINTS;

export interface UseBreakpointResult {
  /** Largest breakpoint the window currently satisfies, or `base`. */
  current: Breakpoint | 'base';
  /** True when the window is at least this wide. */
  isAtLeast: (breakpoint: Breakpoint) => boolean;
  width: number;
  height: number;
  isLandscape: boolean;
}

export interface BreakpointResult<Name extends string> {
  current: Name | 'base';
  isAtLeast: (breakpoint: Name) => boolean;
  width: number;
  height: number;
  isLandscape: boolean;
}

export interface BreakpointProviderProps {
  children?: ReactNode;
}

export interface BreakpointContract<Name extends string> {
  Provider: (props: BreakpointProviderProps) => ReactNode;
  useBreakpoint: () => BreakpointResult<Name>;
  breakpoints: Readonly<Record<Name, number>>;
}

/**
 * Create app-specific responsive names. One Provider owns the window
 * subscription; every bound hook below it reads the same dimensions.
 */
export function createBreakpoints<const T extends BreakpointDefinition>(
  definition: T
): BreakpointContract<keyof T & string> {
  type Name = keyof T & string;
  const breakpoints = Object.freeze({ ...definition }) as Readonly<T>;
  const entries = breakpointEntries(breakpoints);
  const Context = createContext<{ width: number; height: number } | null>(null);

  function Provider({ children }: BreakpointProviderProps) {
    const dimensions = useWindowDimensions();
    return createElement(Context.Provider, { value: dimensions }, children);
  }

  function useBoundBreakpoint(): BreakpointResult<Name> {
    const dimensions = useContext(Context);
    if (!dimensions) {
      throw new Error('This breakpoint hook must be used inside its Breakpoint Provider.');
    }
    const { width, height } = dimensions;
    return {
      current: breakpointAt(entries, width),
      isAtLeast: (name) => width >= breakpoints[name]!,
      width,
      height,
      isLandscape: width > height,
    };
  }

  return { Provider, useBreakpoint: useBoundBreakpoint, breakpoints };
}

/**
 * Responsive state from the window size — the React Native answer to a media
 * query, which has no equivalent here.
 *
 * For styling, prefer Uniwind's responsive class prefixes (`md:flex-row`).
 * Reach for this when the *behaviour* changes, not just the look — rendering
 * a sheet on a phone and a dialog on a tablet, say.
 *
 * ```tsx
 * const { isAtLeast } = useBreakpoint();
 * return isAtLeast('md') ? <Dialog …/> : <BottomSheet …/>;
 * ```
 */
export function useBreakpoint(): UseBreakpointResult {
  const { width, height } = useWindowDimensions();

  const current = breakpointAt(DEFAULT_ENTRIES, width);

  return {
    current,
    isAtLeast: (breakpoint) => width >= BREAKPOINTS[breakpoint],
    width,
    height,
    isLandscape: width > height,
  };
}
