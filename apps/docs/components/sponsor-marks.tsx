/**
 * The marks on the sponsors page.
 *
 * Drawn inline rather than served from `public/`. Two of the three reasons are
 * the same ones the sidebar's marks are inline — the page renders on the
 * server, and a handful of paths is cheaper than a request for them. The third
 * is `next/image`, which refuses SVG unless the whole project opts into
 * serving it, and a logo is exactly the file you want to keep as vector.
 *
 * Every mark is a lockup: the symbol and the company's name, sized off the
 * same line so the two sit level. Where a name is part of the supplied
 * artwork it stays part of it; where it is not, it is set in the page's own
 * type beside the symbol.
 */

/**
 * Neon's wordmark, from the brand's own light and dark files.
 *
 * One element rather than two. The name is identical in both variants, so it
 * takes `currentColor` and follows the page; only the symbol's green differs
 * between them, and that is two classes rather than a second copy of the
 * artwork.
 */
export function NeonMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 157 45"
      role="img"
      aria-label="Neon"
      className={className}
      fill="none"
    >
      <path
        d="M43.9842 0.0123174V44L26.9844 29.2514V44H0.416626V0L43.9842 0.0123174ZM5.75712 38.6595H21.6439V17.5326L38.644 32.5729V5.35124L5.75712 5.34181V38.6595Z"
        className="fill-[#37C38F] dark:fill-[#34D59A]"
      />
      <path
        d="M79.0702 35.7042L62.1565 20.7349V35.4106H56.8365V9.06775L73.7503 24.037V9.36126H79.0702V35.7042ZM84.9267 35.4106V9.36126H100.85V14.6078H90.2467V19.7443H98.6485V24.8808H90.2467V30.1641H100.85V35.4106H84.9267ZM117.32 35.7042C109.945 35.7042 104.001 29.7605 104.001 22.386C104.001 15.0114 109.945 9.06775 117.32 9.06775C124.694 9.06775 130.638 15.0114 130.638 22.386C130.638 29.7605 124.694 35.7042 117.32 35.7042ZM117.32 30.5677C121.869 30.5677 125.281 26.8987 125.281 22.386C125.281 17.8732 121.869 14.2042 117.32 14.2042C112.77 14.2042 109.358 17.8732 109.358 22.386C109.358 26.8987 112.77 30.5677 117.32 30.5677ZM156.493 35.7042L139.579 20.7349V35.4106H134.259V9.06775L151.173 24.037V9.36126H156.493V35.7042Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * OpenPanel's symbol, with the name set beside it.
 *
 * The brand ships the symbol on a blue plate; the plate is dropped and the
 * viewBox tightened to the glyphs, so the mark reads on the page's own
 * background the way Neon's does instead of arriving in a coloured tile of its
 * own. `currentColor` is what makes the same file correct in both themes.
 */
export function OpenPanelMark({ className }: { className?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg
        viewBox="122.742 283.344 753.665 432.424"
        role="img"
        aria-label="OpenPanel"
        className={className}
        fill="currentColor"
      >
        <rect x="548.075" y="287.946" width="129.343" height="427.822" rx="64.6715" />
        <rect x="747.064" y="287.946" width="129.343" height="218.886" rx="64.6715" />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M300.392 283.344C202.279 283.344 122.742 362.881 122.742 460.994V533.594C122.742 631.708 202.279 711.244 300.392 711.244C398.506 711.244 478.042 631.708 478.042 533.594V460.994C478.042 362.881 398.506 283.344 300.392 283.344ZM300.714 387.844C264.997 387.844 236.042 416.799 236.042 452.516V542.058C236.042 577.775 264.997 606.73 300.714 606.73C336.431 606.73 365.385 577.776 365.385 542.058V452.516C365.385 416.799 336.431 387.844 300.714 387.844Z"
        />
      </svg>
      <span
        aria-hidden="true"
        className="font-heading text-2xl font-semibold tracking-tight"
      >
        OpenPanel
      </span>
    </span>
  );
}
