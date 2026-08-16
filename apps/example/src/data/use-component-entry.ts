import { useEffect, useState } from 'react';
import { loadComponent } from './components';
import {
  pendingComponentEntry,
  settleComponentEntry,
  type ComponentEntryLoadState,
} from './component-entry-state';

export function useComponentEntry(slug: string): ComponentEntryLoadState {
  const [state, setState] = useState(() => pendingComponentEntry(slug));

  useEffect(() => {
    let active = true;
    setState(pendingComponentEntry(slug));
    loadComponent(slug).then(
      (entry) => {
        if (active) setState((current) => settleComponentEntry(current, slug, { entry }));
      },
      () => {
        if (active) setState((current) => settleComponentEntry(current, slug, { unavailable: true }));
      }
    );
    return () => {
      active = false;
    };
  }, [slug]);

  return state.slug === slug ? state : pendingComponentEntry(slug);
}
