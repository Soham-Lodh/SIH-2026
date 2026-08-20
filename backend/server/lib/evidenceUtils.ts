import { CitedSource, NewsArticle } from '../types/disaster';

/**
 * Validates and sanitizes citation references in text.
 * If text contains [S7] or [S99] but only [S1, S2, S3] exist in the evidence bundle,
 * invalid citations are removed or cleaned so fake source references never reach the user (Section 23 / Section 94).
 */
export function validateAndCleanCitations(text: string, validSources: CitedSource[]): string {
  if (!text) return '';
  const validIds = new Set(validSources.map((s) => s.id.toUpperCase().trim()));

  // Replace citation markers like [S1], [S2][S4], [S7]
  return text.replace(/\[(S\d+)\]/gi, (match, citationId) => {
    const upperId = citationId.toUpperCase().trim();
    if (validIds.has(upperId)) {
      return `[${upperId}]`;
    }
    // Invalid citation -> strip it cleanly
    return '';
  });
}

/**
 * Deduplicates news articles based on normalized URL, title similarity, and publisher.
 */
export function deduplicateNewsArticles(articles: NewsArticle[]): NewsArticle[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const results: NewsArticle[] = [];

  for (const article of articles) {
    if (!article.url || !article.title) continue;

    // Normalize URL: remove query params and protocol trailing slashes
    const normUrl = article.url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/[\?#].*$/, '')
      .replace(/\/+$/, '');

    // Normalize title: remove punctuation and lowercase
    const normTitle = article.title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (seenUrls.has(normUrl) || seenTitles.has(normTitle)) {
      continue;
    }

    seenUrls.add(normUrl);
    seenTitles.add(normTitle);
    results.push(article);
  }

  return results;
}

/**
 * Validates whether an article satisfies the Present Current-News Temporal Gate (default 72 hours).
 * Rejects articles from previous years (e.g. 2025 in 2026), future dates, or unparseable timestamps.
 */
export function evaluateTemporalGate(
  publishedAtStr: string,
  now: Date = new Date(),
  windowHours: number = 72
): { isEligible: boolean; recencyVerified: boolean; relativeTime: string; reason?: string } {
  if (!publishedAtStr) {
    return {
      isEligible: false,
      recencyVerified: false,
      relativeTime: 'recency unverified',
      reason: 'Missing published timestamp',
    };
  }

  const pubDate = new Date(publishedAtStr);
  const pubTime = pubDate.getTime();
  const nowTime = now.getTime();

  if (isNaN(pubTime)) {
    return {
      isEligible: false,
      recencyVerified: false,
      relativeTime: 'recency unverified',
      reason: 'Unparseable date format',
    };
  }

  // Reject future dates (more than 15 minutes ahead)
  if (pubTime > nowTime + 15 * 60 * 1000) {
    return {
      isEligible: false,
      recencyVerified: false,
      relativeTime: 'recency unverified',
      reason: 'Timestamp is in the future',
    };
  }

  const diffHours = (nowTime - pubTime) / (1000 * 60 * 60);

  // Compute clean relative time
  let relativeTime: string;
  if (diffHours < 1) {
    const mins = Math.max(1, Math.round(diffHours * 60));
    relativeTime = `Published ${mins}m ago`;
  } else if (diffHours < 24) {
    const hrs = Math.round(diffHours);
    relativeTime = `Published ${hrs}h ago`;
  } else {
    const days = Math.round(diffHours / 24);
    relativeTime = `Published ${days}d ago`;
  }

  if (diffHours <= windowHours) {
    return {
      isEligible: true,
      recencyVerified: true,
      relativeTime,
    };
  } else {
    return {
      isEligible: false,
      recencyVerified: true,
      relativeTime,
      reason: `Article is older than ${windowHours} hours (${Math.round(diffHours)}h old)`,
    };
  }
}
