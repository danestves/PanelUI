import { ImageResponse } from 'next/og';
import { OG_SIZE, OgCard } from '@/lib/og-card';
import { componentCount, site } from '@/lib/site';

export const alt = `${site.name} — ${site.tagline}`;
export const size = OG_SIZE;
export const contentType = 'image/png';

/** Social card for the site root. Docs pages generate their own via `/og`. */
export default function Image() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="React Native UI library"
        title={site.tagline}
        // Counted, not written down: this line claimed 26 components for a
        // library that shipped 74.
        description={`${componentCount} accessible components · Reanimated · Expo Go`}
        footer={`npm i ${site.package}`}
      />
    ),
    size
  );
}
