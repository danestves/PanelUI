import type { ComponentEntry } from './component-types';

export interface ComponentEntryLoadState {
  slug: string;
  status: 'loading' | 'ready' | 'unavailable';
  entry?: ComponentEntry;
}

export function pendingComponentEntry(slug: string): ComponentEntryLoadState {
  return { slug, status: 'loading' };
}

export function settleComponentEntry(
  current: ComponentEntryLoadState,
  slug: string,
  result: { entry?: ComponentEntry; unavailable?: true }
): ComponentEntryLoadState {
  if (current.slug !== slug) return current;
  return result.unavailable
    ? { slug, status: 'unavailable' }
    : { slug, status: 'ready', entry: result.entry };
}
