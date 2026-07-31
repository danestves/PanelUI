import Image from 'next/image';

export interface DiagramProps {
  /** Path under `public/` for the dark rendering, e.g. `/diagrams/x-dark.webp`. */
  src: string;
  /** The same diagram drawn for a light page. */
  srcLight: string;
  /** What the diagram shows. Not decorative — it is the only description. */
  alt: string;
  /** Intrinsic pixel dimensions of the files, for the aspect ratio. */
  width: number;
  height: number;
  /** Optional line under the figure. */
  caption?: string;
}

/**
 * A labelled schematic of a component's structure.
 *
 * Separate from `Preview` because the two are opposite shapes. A preview is a
 * portrait shot of a device, held narrow and inset in a frame so it reads as an
 * artifact on the page. A diagram is wide, is already drawn on its own canvas,
 * and is only legible at full column width — framing and padding it would shrink
 * the one thing it exists to make readable.
 *
 * Both renderings ship and the page hides one, rather than a client component
 * reading the theme: a diagram that arrives after hydration is a diagram that
 * pops in, and this way the correct one is in the first paint.
 */
export function Diagram({ src, srcLight, alt, width, height, caption }: DiagramProps) {
  return (
    <figure className="not-prose my-6">
      <div className="overflow-hidden rounded-xl border border-fd-border">
        <Image
          src={srcLight}
          alt={alt}
          width={width}
          height={height}
          className="h-auto w-full dark:hidden"
          sizes="(min-width: 1024px) 48rem, 100vw"
        />
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="hidden h-auto w-full dark:block"
          sizes="(min-width: 1024px) 48rem, 100vw"
        />
      </div>
      {caption ? (
        <figcaption className="mt-2 text-center text-sm text-fd-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
