import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateAndCleanCitations } from '../server/lib/evidenceUtils.ts';
import { CitedSource } from '../server/types/disaster.ts';

describe('Citation ID Validation (Section 23 / Section 94)', () => {
  const mockSources: CitedSource[] = [
    {
      id: 'S1',
      title: 'NDRF Cyclone Fani Preparedness Briefing',
      publisher: 'The Hindu',
      publishedAt: '2019-05-02T10:00:00Z',
      url: 'https://thehindu.com/news/national/fani-preparedness',
      summary: 'Over 1.2 million people evacuated in coastal Odisha.',
    },
    {
      id: 'S2',
      title: 'IMD Landfall Bulletin No. 24',
      publisher: 'IMD',
      publishedAt: '2019-05-03T08:00:00Z',
      url: 'https://mausam.imd.gov.in/fani-landfall',
      summary: 'Storm made landfall near Puri with winds up to 175 kmph.',
    },
    {
      id: 'S3',
      title: 'Odisha Government Relief and Recovery Report',
      publisher: 'NDTV',
      publishedAt: '2019-05-06T14:00:00Z',
      url: 'https://ndtv.com/odisha-relief-fani',
      summary: 'Power infrastructure severely damaged in Puri and Khordha.',
    },
  ];

  it('preserves valid citation IDs [S1] and [S2]', () => {
    const rawText = 'Evacuation began on May 2 [S1] and landfall occurred on May 3 [S2].';
    const cleaned = validateAndCleanCitations(rawText, mockSources);
    assert.strictEqual(cleaned, 'Evacuation began on May 2 [S1] and landfall occurred on May 3 [S2].');
  });

  it('strips nonexistent citation [S7] and preserves valid [S1] (Section 94 Test)', () => {
    const rawText = 'Cyclone hit coastal belt [S1], and 400 hospitals damaged [S7].';
    const cleaned = validateAndCleanCitations(rawText, mockSources);
    // [S7] is stripped cleanly
    assert.strictEqual(cleaned, 'Cyclone hit coastal belt [S1], and 400 hospitals damaged .');
  });

  it('normalizes case sensitivity e.g. [s3] to [S3]', () => {
    const rawText = 'Relief distribution began rapidly [s3].';
    const cleaned = validateAndCleanCitations(rawText, mockSources);
    assert.strictEqual(cleaned, 'Relief distribution began rapidly [S3].');
  });
});

