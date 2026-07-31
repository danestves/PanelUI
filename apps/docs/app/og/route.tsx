import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { OG_SIZE, OgCard } from '@/lib/og-card';
import { site } from '@/lib/site';

/**
 * Social card generator, driven by query params.
 *
 * A route handler rather than a colocated `opengraph-image.tsx`: the docs
 * route is an optional catch-all (`[[...slug]]`), and Next forbids nesting a
 * file segment under one.
 *
 * The card itself is `lib/og-card.tsx`, shared with the root image so the two
 * cannot drift.
 */
export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title')?.slice(0, 90) ?? site.name;
  const description = searchParams.get('description')?.slice(0, 130) ?? site.tagline;
  const eyebrow = searchParams.get('eyebrow') ?? `${site.name} docs`;

  return new ImageResponse(
    (
      <OgCard
        eyebrow={eyebrow}
        title={title}
        description={description}
        footer={`npm i ${site.package}`}
      />
    ),
    OG_SIZE
  );
}
