'use client';

import Link from 'next/link';
import type { ComponentPropsWithRef } from 'react';
import { layoutLinkPrefetch } from '@/components/layout-link-policy';

/**
 * Routes repeated by the persistent Fumadocs chrome.
 *
 * The desktop navbar, mobile menu and CTA can all contain the same destination,
 * so viewport prefetching each copy spends several RSC requests on one route.
 * Content links use `next/link` directly and keep its normal prefetching. This
 * wrapper owns links in Fumadocs' shared layouts and the repeated home footer.
 */
type LayoutLinkProps = ComponentPropsWithRef<'a'> & { prefetch?: boolean | null };

export function LayoutLink({ href = '#', prefetch, ...props }: LayoutLinkProps) {
  return <Link href={href} prefetch={layoutLinkPrefetch(href, prefetch)} {...props} />;
}
