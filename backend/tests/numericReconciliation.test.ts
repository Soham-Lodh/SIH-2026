import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileNumericClaims } from '../server/lib/evidenceUtils';

test('numeric reconciliation keeps a tight casualty cluster', () => {
  const result = reconcileNumericClaims([23, 28, 32]);

  assert.equal(result.rangeMin, 23);
  assert.equal(result.rangeMax, 32);
  assert.deepEqual(result.outliers, []);
});

test('numeric reconciliation excludes one clear outlier', () => {
  const result = reconcileNumericClaims([
    { value: 23, sourceId: 'S1', text: '23 deaths reported' },
    { value: 28, sourceId: 'S2', text: '28 people killed' },
    { value: 500, sourceId: 'S3', text: '500 deaths claimed' },
  ]);

  assert.equal(result.rangeMin, 23);
  assert.equal(result.rangeMax, 28);
  assert.deepEqual(result.outliers, [500]);
  assert.equal(result.outlierClaims[0].sourceId, 'S3');
});

test('numeric reconciliation handles a no-conflict single value', () => {
  const result = reconcileNumericClaims([12]);

  assert.equal(result.rangeMin, 12);
  assert.equal(result.rangeMax, 12);
  assert.deepEqual(result.outliers, []);
});
