import assert from 'node:assert/strict';
import test from 'node:test';
import {
  distanceFromMessageScrollerTarget,
  isMessageScrollerTargetVisible,
} from '../src/components/message-scroller/message-scroller-math.ts';

const CONTENT_HEIGHT = 1_000;
const VIEWPORT_HEIGHT = 200;

test('start and end controls use their own edge at every scroll position', () => {
  const positions = [
    { offset: 0, start: false, end: true },
    { offset: 400, start: true, end: true },
    { offset: 800, start: true, end: false },
  ];

  for (const position of positions) {
    assert.equal(
      isMessageScrollerTargetVisible(
        distanceFromMessageScrollerTarget(
          'start',
          position.offset,
          CONTENT_HEIGHT,
          VIEWPORT_HEIGHT
        )
      ),
      position.start
    );
    assert.equal(
      isMessageScrollerTargetVisible(
        distanceFromMessageScrollerTarget(
          'end',
          position.offset,
          CONTENT_HEIGHT,
          VIEWPORT_HEIGHT
        )
      ),
      position.end
    );
  }
});

test('edge distance remains stable during platform overscroll', () => {
  assert.equal(
    distanceFromMessageScrollerTarget(
      'start',
      -40,
      CONTENT_HEIGHT,
      VIEWPORT_HEIGHT
    ),
    0
  );
  assert.equal(
    distanceFromMessageScrollerTarget(
      'end',
      840,
      CONTENT_HEIGHT,
      VIEWPORT_HEIGHT
    ),
    0
  );
  assert.equal(
    distanceFromMessageScrollerTarget('end', 0, 100, VIEWPORT_HEIGHT),
    0
  );
});
