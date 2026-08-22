import assert from 'node:assert/strict';
import test from 'node:test';
import { getTranslation, hazardLabel, translate } from '../../frontend/src/types/language.ts';

test('application locale copy falls back safely and interpolates counts', () => {
  assert.equal(translate('hi', 'present.activeHazards', { count: 2 }), '2 सक्रिय खतरे');
  assert.equal(translate('en', 'history.sourcesCount', { count: 1 }), '1 source');
  assert.equal(translate('en', 'history.sourcesCount', { count: 3 }), '3 sources');
  assert.equal(translate('unknown-locale', 'common.close'), 'Close');
  assert.deepEqual(getTranslation('unknown-locale'), getTranslation('en'));
});

test('hazard identifiers remain stable while only their rendered label changes', () => {
  const category = 'Flood';
  assert.equal(category, 'Flood');
  assert.equal(hazardLabel('hi', category), 'बाढ़');
  assert.equal(hazardLabel('bn', category), 'বন্যা');
  assert.equal(hazardLabel('unknown-locale', category), category);
});
