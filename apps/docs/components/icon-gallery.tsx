'use client';

import { useMemo, useState } from 'react';
import icons from '@/lib/icons.generated.json';

interface GalleryIcon {
  name: string;
  size: number;
  viewBox: string;
  fill: string;
  markup: string;
  brand: boolean;
}

const ALL = icons as GalleryIcon[];

/**
 * Splits a name into its words so a search for "arrow up" finds ArrowUpIcon.
 *
 * Matching the raw name only would mean a reader has to guess the library's
 * capitalisation before they can find out what the library calls things, which
 * is the wrong way round.
 */
function haystack(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

const INDEXED = ALL.map((icon) => ({ icon, search: haystack(icon.name) }));

export function IconGallery() {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return ALL;
    return INDEXED.filter(({ search }) => terms.every((t) => search.includes(t))).map(
      ({ icon }) => icon
    );
  }, [query]);

  const copy = (name: string) => {
    void navigator.clipboard.writeText(`<${name} size={20} />`).then(() => {
      setCopied(name);
      setTimeout(() => setCopied((current) => (current === name ? null : current)), 1200);
    });
  };

  return (
    <div className="not-prose my-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search icons — try “arrow”, “chevron”, “shield”"
          aria-label="Search icons"
          className="min-w-0 flex-1 rounded-lg border border-fd-border bg-fd-card px-3 py-2 text-sm outline-none placeholder:text-fd-muted-foreground focus-visible:border-fd-primary"
        />
        <span className="text-sm text-fd-muted-foreground" aria-live="polite">
          {results.length} of {ALL.length}
        </span>
      </div>

      {results.length === 0 ? (
        <p className="rounded-lg border border-fd-border px-4 py-8 text-center text-sm text-fd-muted-foreground">
          Nothing matches “{query}”. Every icon is listed above the search when it
          is empty — if what you need is not here, an SVG of your own works
          anywhere one of these does.
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
          {results.map((icon) => (
            <li key={icon.name}>
              <button
                type="button"
                onClick={() => copy(icon.name)}
                title={`Copy <${icon.name} />`}
                className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border border-fd-border bg-fd-card px-2 py-4 transition-colors hover:border-fd-primary hover:bg-fd-accent"
              >
                <svg
                  width={24}
                  height={24}
                  viewBox={icon.viewBox}
                  fill={icon.fill}
                  aria-hidden
                  /* `currentColor` is what the extractor rewrote the theme
                     colour to, so the icon takes the card's text colour and
                     follows light and dark without a second copy. A brand mark
                     has its own hexes and simply ignores this. */
                  className="text-fd-foreground"
                  dangerouslySetInnerHTML={{ __html: icon.markup }}
                />
                <span className="w-full break-words text-center text-[11px] leading-tight text-fd-muted-foreground">
                  {copied === icon.name ? 'Copied' : icon.name.replace(/Icon$/, '')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
