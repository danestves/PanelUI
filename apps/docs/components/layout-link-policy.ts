/** Routes rendered more than once by the persistent navigation and footer. */
export const REPEATED_LAYOUT_ROUTES = new Set(['/', '/docs', '/docs/components']);

/** Keep explicit choices; otherwise suppress only repeated layout destinations. */
export function layoutLinkPrefetch(
  href: string,
  prefetch?: boolean | null
): boolean | null {
  return prefetch ?? (REPEATED_LAYOUT_ROUTES.has(href) ? false : null);
}
