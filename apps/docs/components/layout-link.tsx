'use client';

import Link from 'next/link';
import type { ComponentPropsWithRef } from 'react';

/**
 * Routes repeated by the persistent Fumadocs chrome.
 *
 * The desktop navbar, mobile menu and CTA can all contain the same destination,
 * so viewport prefetching each copy spends several RSC requests on one route.
 * Content links use `next/link` directly and keep its normal prefetching; this
 * policy applies only to links Fumadocs creates for its shared layouts.
 */
const REPEATED_CHROME_ROUTES = new Set(['/', '/docs', '/docs/components']);

type LayoutLinkProps = ComponentPropsWithRef<'a'> & { prefetch?: boolean };

export function LayoutLink({ href = '#', prefetch, ...props }: LayoutLinkProps) {
  const repeated = REPEATED_CHROME_ROUTES.has(href);

  return <Link href={href} prefetch={prefetch ?? (repeated ? false : null)} {...props} />;
}
