import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRightIcon, HeartIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NeonMark, OpenPanelMark } from '@/components/sponsor-marks';
import { absoluteUrl, site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Sponsors',
  description: `The companies and people funding ${site.name}'s development, and how to join them.`,
  alternates: { canonical: absoluteUrl('/sponsors') },
};

/**
 * Companies backing the library through their open-source programme.
 *
 * A list rather than markup, so the grid below stays one cell however many
 * there are. `mark` is a component because each brand has its own lockup —
 * some ship a wordmark, some only a symbol — and a shared `<img>` would flatten
 * that into whichever one happened to be first.
 */
const OPEN_SOURCE_PROGRAM = [
  {
    name: 'Neon',
    url: 'https://neon.com',
    mark: <NeonMark className="h-8 w-auto" />,
  },
  {
    name: 'OpenPanel',
    url: 'https://openpanel.dev',
    mark: <OpenPanelMark className="h-6 w-auto" />,
  },
];

export default function SponsorsPage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="px-6 pt-20 pb-14">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <p className="text-sm text-muted-foreground">Sponsors</p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Backed by the community.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground text-balance">
            {site.name} is MIT-licensed and free to use. These are the companies and
            people paying for the time that goes into it.
          </p>
        </div>
      </section>

      <section className="border-t px-6 py-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <h2 className="text-sm text-muted-foreground">Open Source Program</h2>

          {/*
            One rule between the cells rather than a border on each. Cells that
            each draw their own edge double up where two meet, which reads as a
            heavier line down the middle of the grid than around the outside.
          */}
          <ul className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border sm:grid-cols-2 sm:divide-x">
            {OPEN_SOURCE_PROGRAM.map(({ name, url, mark }) => (
              <li key={name}>
                <Link
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={name}
                  className="flex h-40 items-center justify-center px-8 text-foreground transition-colors hover:bg-accent"
                >
                  {mark}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t px-6 py-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <h2 className="text-sm text-muted-foreground">Sponsors</h2>

          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-8 py-14 text-center">
            <HeartIcon className="size-5 text-muted-foreground" aria-hidden="true" />
            <p className="font-heading text-lg font-medium">No sponsors yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              This is where individual sponsors are listed. The first one goes at the
              top.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t px-6 py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-4">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Sponsor {site.name}
          </h2>
          <p className="max-w-2xl text-muted-foreground">
            Sponsorship pays for the components, the documentation and the releases.
            Every tier is listed on GitHub, and one-off amounts are welcome.
          </p>
          <Button render={<Link href={site.sponsors} target="_blank" rel="noreferrer" />}>
            Sponsor on GitHub
            <ArrowRightIcon />
          </Button>
        </div>
      </section>
    </main>
  );
}
