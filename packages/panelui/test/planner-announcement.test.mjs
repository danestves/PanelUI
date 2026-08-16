import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { usePlannerMonthAnnouncement } from '../src/components/planner/planner-announcement.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mountAnnouncement(current) {
  let request;
  function Harness({ options }) {
    request = usePlannerMonthAnnouncement(options);
    return null;
  }

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Harness, { options: current }));
  });

  return {
    async request(month) {
      await act(async () => request(month));
    },
    async update(options) {
      await act(async () => renderer.update(React.createElement(Harness, { options })));
    },
    async unmount() {
      await act(async () => renderer.unmount());
    },
  };
}

const january = new Date(2026, 0, 1);
const february = new Date(2026, 1, 1);
const march = new Date(2026, 2, 1);

const options = (month, announcements) => ({
  monthKey: month.getTime(),
  monthLabel: month.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
  announce: (label) => announcements.push(label),
});

test('mount and ordinary prop-driven month changes stay silent', async () => {
  const announcements = [];
  const mounted = await mountAnnouncement(options(january, announcements));

  await mounted.update(options(february, announcements));
  await mounted.update(options(march, announcements));
  assert.deepEqual(announcements, []);
  await mounted.unmount();
});

test('an accepted user month request announces after it is committed', async () => {
  const announcements = [];
  const mounted = await mountAnnouncement(options(january, announcements));

  await mounted.request(february);
  assert.deepEqual(announcements, []);
  await mounted.update(options(february, announcements));
  assert.deepEqual(announcements, ['February 2026']);

  await mounted.update(options(february, announcements));
  assert.deepEqual(announcements, ['February 2026']);
  await mounted.unmount();
});

test('a rejected controlled request never announces on a later external reset', async () => {
  const announcements = [];
  const mounted = await mountAnnouncement(options(january, announcements));

  await mounted.request(february);
  await mounted.update(options(january, announcements));
  await mounted.update(options(february, announcements));
  assert.deepEqual(announcements, []);
  await mounted.unmount();
});

test('only the latest request may own the next committed announcement', async () => {
  const announcements = [];
  const mounted = await mountAnnouncement(options(january, announcements));

  await mounted.request(february);
  await mounted.request(march);
  await mounted.update(options(february, announcements));
  assert.deepEqual(announcements, []);

  await mounted.request(march);
  await mounted.update(options(march, announcements));
  assert.deepEqual(announcements, ['March 2026']);
  await mounted.unmount();
});
