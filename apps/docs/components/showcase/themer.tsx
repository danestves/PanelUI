'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { MoonIcon, SunIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The theme picker over the home page's component previews, and the element
 * the previews are themed by.
 *
 * The tokens live on this wrapper rather than on `<html>`, so picking Moon
 * restyles the previews and leaves the page around them in whatever the reader
 * chose. A visitor comparing the three families should not have the navigation
 * change colour under them to do it.
 *
 * Only the picker is interactive, so only the picker is a client component —
 * the previews are passed in as `children` and stay server-rendered.
 */

/**
 * The three families, with each one's accent in both modes — a swatch is the
 * family's own `--primary`, and Panel's is a near-black that vanishes on a dark
 * control and a near-white that vanishes on a light one.
 */
const FAMILIES = [
  { id: 'panel', name: 'Panel', swatch: { light: '#262626', dark: '#f5f5f5' } },
  { id: 'moon', name: 'Moon', swatch: { light: '#5e6ad2', dark: '#5e6ad2' } },
  { id: 'grass', name: 'Grass', swatch: { light: '#24b47e', dark: '#3ecf8e' } },
] as const;

type Family = (typeof FAMILIES)[number]['id'];
type Mode = 'light' | 'dark';

/**
 * The library's own theme name for a family and a mode — the string
 * `setTheme()` takes, and the value `panel-themes.css` keys on. Panel is the
 * default family, so its two are just `light` and `dark`.
 */
function themeName(family: Family, mode: Mode): string {
  if (family === 'panel') return mode;
  return mode === 'dark' ? `${family}-dark` : family;
}

export function Themer({ children }: { children: ReactNode }): React.ReactElement {
  const [family, setFamily] = useState<Family>('panel');
  const [mode, setMode] = useState<Mode>('light');

  /*
   * Start on whatever the page is already in, so the previews do not open in
   * daylight for a reader who chose dark. It has to be an effect: the class is
   * written to <html> by the theme provider after hydration, and reading it
   * during render would give the server one answer and the browser another.
   *
   * From then on the two are independent — the point of this control is to
   * look at a theme the page is not in.
   */
  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) setMode('dark');
  }, []);

  const theme = themeName(family, mode);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex items-center gap-1 rounded-full border bg-card p-1"
          role="radiogroup"
          aria-label="Theme family"
        >
          {FAMILIES.map(({ id, name, swatch }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={family === id}
              onClick={() => setFamily(id)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                family === id
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span
                className="size-3 rounded-full ring-1 ring-foreground/10 ring-inset"
                style={{ backgroundColor: swatch[mode] }}
                aria-hidden="true"
              />
              {name}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          aria-pressed={mode === 'dark'}
          className="flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === 'dark' ? (
            <MoonIcon className="size-4" aria-hidden="true" />
          ) : (
            <SunIcon className="size-4" aria-hidden="true" />
          )}
          {mode === 'dark' ? 'Dark' : 'Light'}
        </button>
      </div>

      <div
        data-panel-theme={theme}
        /*
         * `inert`, because none of this does anything. Ten cards of controls
         * between the hero and the rest of the page is sixty tab stops that
         * lead nowhere, and a screen reader reading out a form nobody can
         * submit. The previews are a picture of the components; the links to
         * the real ones are underneath.
         */
        inert
        style={{ colorScheme: mode }}
        /*
         * A background, because the previews carry their own theme: a Moon-dark
         * card on a white page would be a dark tile floating in daylight. No
         * border, though — a frame around a frame around every card is one
         * frame too many, and with the page in the same theme this surface
         * disappears, which is the point.
         */
        className="rounded-3xl bg-background p-3 text-foreground sm:p-4"
      >
        {children}
      </div>
    </div>
  );
}
