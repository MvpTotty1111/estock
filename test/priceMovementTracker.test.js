const assert = require('node:assert/strict');
const test = require('node:test');

const { PriceMovementTracker } = require('../out/priceMovementTracker');

test('waits for a full rolling window before triggering an upward alert', () => {
  const tracker = new PriceMovementTracker({ thresholdPercent: 1 });

  assert.equal(tracker.record('sh601318', 100, 0), undefined);
  assert.equal(tracker.record('sh601318', 101.2, 59000), undefined);
  assert.deepEqual(tracker.record('sh601318', 101.2, 60000), {
    direction: 'up',
    percent: 1.2,
  });
});

test('triggers a downward alert from the price one minute earlier', () => {
  const tracker = new PriceMovementTracker({ thresholdPercent: 1 });

  tracker.record('sh601318', 100, 0);

  assert.deepEqual(tracker.record('sh601318', 98.8, 60000), {
    direction: 'down',
    percent: 1.2,
  });
});

test('extends an alert only after movement grows by one tenth of a percentage point', () => {
  const tracker = new PriceMovementTracker({
    thresholdPercent: 1,
    extensionStepPercent: 0.1,
  });

  tracker.record('sh601318', 100, 0);
  tracker.record('sh601318', 100, 10000);
  tracker.record('sh601318', 100, 20000);
  assert.deepEqual(tracker.record('sh601318', 101.05, 60000), {
    direction: 'up',
    percent: 1.05,
  });

  assert.equal(tracker.record('sh601318', 101.14, 70000), undefined);
  assert.deepEqual(tracker.record('sh601318', 101.15, 80000), {
    direction: 'up',
    percent: 1.15,
  });
});

test('requires movement to return inside the threshold before alerting again', () => {
  const tracker = new PriceMovementTracker({ thresholdPercent: 1 });

  tracker.record('sh601318', 100, 0);
  tracker.record('sh601318', 100, 10000);
  tracker.record('sh601318', 100, 20000);
  tracker.record('sh601318', 100, 30000);
  tracker.record('sh601318', 101.05, 60000);

  assert.equal(tracker.record('sh601318', 101.06, 70000), undefined);
  assert.equal(tracker.record('sh601318', 100.5, 80000), undefined);
  assert.deepEqual(tracker.record('sh601318', 101.05, 90000), {
    direction: 'up',
    percent: 1.05,
  });
});

test('switches direction immediately after a sharp reversal', () => {
  const tracker = new PriceMovementTracker({ thresholdPercent: 1 });

  tracker.record('sh601318', 100, 0);
  tracker.record('sh601318', 100, 10000);
  tracker.record('sh601318', 101.2, 60000);

  assert.deepEqual(tracker.record('sh601318', 98.8, 70000), {
    direction: 'down',
    percent: 1.2,
  });
});

test('does not compare against a sample that is too old', () => {
  const tracker = new PriceMovementTracker({ thresholdPercent: 1 });

  tracker.record('sh601318', 100, 0);

  assert.equal(tracker.record('sh601318', 102, 76000), undefined);
});

test('uses the oldest sample inside a window when polling does not align with the boundary', () => {
  const tracker = new PriceMovementTracker({
    thresholdPercent: 1,
    windowMs: 90000,
  });

  tracker.record('sh601318', 100, 0);
  tracker.record('sh601318', 100, 60000);

  assert.deepEqual(tracker.record('sh601318', 101.2, 120000), {
    direction: 'up',
    percent: 1.2,
  });
});

test('does not use a sample older than a short configured window', () => {
  const tracker = new PriceMovementTracker({
    thresholdPercent: 1,
    windowMs: 1000,
  });

  tracker.record('sh601318', 100, 0);

  assert.equal(tracker.record('sh601318', 101.2, 10000), undefined);
});
