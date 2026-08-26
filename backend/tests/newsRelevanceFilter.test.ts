import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreIncidentEvidence } from '../server/lib/evidenceUtils';

test('incident evidence filter rejects disconnected prediction technology news', () => {
  const score = scoreIncidentEvidence({
    title: 'New AI model to predict floods in India',
    summary: 'Researchers unveil a system for early warning and planning.',
  });

  assert.equal(score, 0);
});

test('incident evidence filter keeps actual disaster reports', () => {
  const score = scoreIncidentEvidence({
    title: 'Wayanad landslides: 23 dead, rescue teams continue operations',
    summary: 'NDRF teams evacuated villagers after homes were damaged in the district.',
  });

  assert.ok(score > 0);
});
