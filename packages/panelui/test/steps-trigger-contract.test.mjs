import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { stepsTriggerDisabled } from '../src/components/steps/steps-trigger.ts';

test('Steps.Trigger merges item and trigger disabled states', () => {
  assert.equal(stepsTriggerDisabled(false, undefined), false);
  assert.equal(stepsTriggerDisabled(false, false), false);
  assert.equal(stepsTriggerDisabled(false, true), true);
  assert.equal(stepsTriggerDisabled(true, false), true);
  assert.equal(stepsTriggerDisabled(true, true), true);
});

test('Steps.Trigger composes consumer presses before its owned transition', async () => {
  const source = await readFile(new URL('../src/components/steps/index.tsx', import.meta.url), 'utf8');
  const trigger = source.slice(source.indexOf('const StepsTrigger ='), source.indexOf('StepsTrigger.displayName'));

  assert.match(source, /export interface StepsTriggerProps extends PressableProps/);
  assert.match(trigger, /const triggerDisabled = stepsTriggerDisabled\(isDisabled, disabled\)/);
  assert.ok(trigger.indexOf('{...props}') < trigger.indexOf('accessibilityRole="button"'));
  assert.ok(trigger.indexOf('onPress?.(event)') < trigger.indexOf('setActiveStep(step)'));
  assert.match(trigger, /disabled={triggerDisabled}/);
  assert.match(trigger, /\.\.\.accessibilityState,[\s\S]*disabled: triggerDisabled,[\s\S]*selected: state === 'active'/);
});
