import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateTemporalGate, deduplicateNewsArticles } from '../server/lib/evidenceUtils.ts';
import { NewsArticle } from '../server/types/disaster.ts';

describe('News Temporal Gate & Deduplication (Sections 17, 60, 93)', () => {
  const currentTestTime = new Date('2026-08-20T12:00:00.000Z');

  it('accepts recent article from yesterday within 72h window', () => {
    const yesterdayDate = new Date('2026-08-19T10:00:00.000Z').toISOString();
    const res = evaluateTemporalGate(yesterdayDate, currentTestTime, 72);
    assert.strictEqual(res.isEligible, true);
    assert.strictEqual(res.recencyVerified, true);
    assert.ok(res.relativeTime.includes('ago'));
  });

  it('rejects old article from 2025 in 2026 (Section 93 Test)', () => {
    const old2025Date = new Date('2025-05-15T08:00:00.000Z').toISOString();
    const res = evaluateTemporalGate(old2025Date, currentTestTime, 72);
    assert.strictEqual(res.isEligible, false);
    assert.strictEqual(res.recencyVerified, true);
    assert.ok(res.reason?.includes('older than 72 hours'));
  });

  it('rejects future timestamp and marks recency unverified', () => {
    const futureDate = new Date('2026-08-25T12:00:00.000Z').toISOString();
    const res = evaluateTemporalGate(futureDate, currentTestTime, 72);
    assert.strictEqual(res.isEligible, false);
    assert.strictEqual(res.recencyVerified, false);
    assert.strictEqual(res.relativeTime, 'recency unverified');
  });

  it('handles invalid / unparseable dates gracefully without throwing', () => {
    const res = evaluateTemporalGate('invalid-date-string', currentTestTime, 72);
    assert.strictEqual(res.isEligible, false);
    assert.strictEqual(res.recencyVerified, false);
    assert.strictEqual(res.relativeTime, 'recency unverified');
  });

  it('deduplicates articles by normalized URL and title similarity', () => {
    const articles: NewsArticle[] = [
      {
        id: '1',
        title: 'Cyclone Warning Issued for Odisha Coast',
        summary: 'IMD warns of heavy rain.',
        url: 'https://timesofindia.indiatimes.com/india/cyclone-warning-odisha/?utm_source=rss',
        publisher: 'Times of India',
        publishedAt: '2026-08-20T08:00:00Z',
        relativeTime: '4h ago',
        recencyVerified: true,
        isWithinTemporalGate: true,
      },
      {
        id: '2', // Duplicate URL with different query parameters
        title: 'Cyclone Warning Issued for Odisha Coast!',
        summary: 'IMD warns of heavy rain.',
        url: 'https://timesofindia.indiatimes.com/india/cyclone-warning-odisha/#section',
        publisher: 'Times of India',
        publishedAt: '2026-08-20T08:00:00Z',
        relativeTime: '4h ago',
        recencyVerified: true,
        isWithinTemporalGate: true,
      },
      {
        id: '3',
        title: 'Relief Teams Pre-Positioned in Puri and Khordha',
        summary: 'NDRF deployed.',
        url: 'https://ndtv.com/odisha/ndrf-deployed',
        publisher: 'NDTV',
        publishedAt: '2026-08-20T09:00:00Z',
        relativeTime: '3h ago',
        recencyVerified: true,
        isWithinTemporalGate: true,
      },
    ];

    const deduped = deduplicateNewsArticles(articles);
    assert.strictEqual(deduped.length, 2);
    assert.strictEqual(deduped[0].id, '1');
    assert.strictEqual(deduped[1].id, '3');
  });
});

