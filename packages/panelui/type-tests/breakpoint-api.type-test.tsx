import type { ReactNode } from 'react';
import { createBreakpoints, useBreakpoint } from '../src';

const AppBreakpoints = createBreakpoints({ compact: 0, medium: 600, expanded: 900 });
const node: ReactNode = <AppBreakpoints.Provider />;
void node;

function CustomConsumer() {
  const state = AppBreakpoints.useBreakpoint();
  const current: 'base' | 'compact' | 'medium' | 'expanded' = state.current;
  const matches: boolean = state.isAtLeast('medium');
  void current;
  void matches;
  // @ts-expect-error custom contracts reject undeclared names
  state.isAtLeast('md');
  return null;
}
void CustomConsumer;

function LegacyConsumer() {
  const state = useBreakpoint();
  const current: 'base' | 'sm' | 'md' | 'lg' | 'xl' = state.current;
  state.isAtLeast('lg');
  // @ts-expect-error legacy names remain restricted
  state.isAtLeast('expanded');
  return current;
}
void LegacyConsumer;
