import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCasualtyNumericClaims,
  filterIncidentEvidenceArticles,
  validateAndCleanCitations,
} from '../server/lib/evidenceUtils';
import { normalizeHistoricalEventQuery } from '../server/aiGateway';

test('normalizes common Indian disaster typos and aliases before retrieval', () => {
  assert.equal(normalizeHistoricalEventQuery('gujrat earthquake 2001').normalizedQuery, '2001 Gujarat earthquake');
  assert.equal(normalizeHistoricalEventQuery('amfan').normalizedQuery, 'Cyclone Amphan');
  assert.equal(normalizeHistoricalEventQuery('waynad landslide').normalizedQuery, '2024 Wayanad landslide');
  assert.equal(normalizeHistoricalEventQuery('bhuj earthqake').normalizedQuery, '2001 Gujarat earthquake');
  assert.equal(normalizeHistoricalEventQuery('Cyclone Amphan').normalizedQuery, 'Cyclone Amphan');
});

test('extracts headline casualty figures as structured death claims', () => {
  const claims = extractCasualtyNumericClaims([
    {
      id: 'S1',
      title: 'At least 16 killed as heavy rain triggers landslides, flash floods across north and east India',
      summary: 'Nagaland heavy rain and landslides disrupted several districts.',
    },
  ]);

  assert.equal(claims.length, 1);
  assert.equal(claims[0].value, 16);
  assert.equal(claims[0].metric, 'deaths');
  assert.equal(claims[0].qualifier, 'at least');
});

test('incident evidence filter does not pass articles on year alone', () => {
  const filtered = filterIncidentEvidenceArticles([
    {
      title: "When this astrologer was arrested for creating panic post-2001 Kutch quake",
      summary: 'The article profiles an astrologer and does not provide disaster impact facts.',
    },
    {
      title: '2001 Gujarat earthquake killed thousands and damaged homes in Kutch',
      summary: 'The quake caused casualties, housing damage and relief operations in Gujarat.',
    },
  ]);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, '2001 Gujarat earthquake killed thousands and damaged homes in Kutch');
});

test('citation cleanup normalizes fullwidth source brackets and removes fake ids', () => {
  const cleaned = validateAndCleanCitations('Damage was reported 【S1】 and another claim used ［S9］.', [
    { id: 'S1', title: 'Source', publisher: 'Publisher', publishedAt: '2026-01-01', url: 'https://example.com', summary: 'Summary' },
  ]);

  assert.equal(cleaned, 'Damage was reported [S1] and another claim used .');
});
