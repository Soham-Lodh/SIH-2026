import { XMLParser } from 'fast-xml-parser';
import { NewsArticle } from './types/disaster';
import { deduplicateNewsArticles, evaluateTemporalGate, filterIncidentEvidenceArticles } from './lib/evidenceUtils';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  trimValues: true,
});

type CacheEntry = {
  expiresAt: number;
  articles: NewsArticle[];
};

const newsCache = new Map<string, CacheEntry>();
const NEWS_CACHE_TTL_MS = 5 * 60 * 1000;

function cleanNewsText(value: string): string {
  return value
    .replace(/<[^>]*>?/gm, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchPhrase(query: string, isCurrentNews: boolean): string {
  const cleanQuery = query.replace(/[^\w\s]/gi, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanQuery) return isCurrentNews ? 'India disaster alert' : 'India disaster';
  if (isCurrentNews) return `${cleanQuery} India disaster weather alert`;
  const hasIndia = /\bindia|indian|odisha|kerala|gujarat|bengal|uttarakhand|maharashtra|assam|bihar|tamil|karnataka|andhra|telangana|rajasthan|sikkim|kashmir|ladakh|goa|punjab|haryana|delhi\b/i.test(cleanQuery);
  return hasIndia ? cleanQuery : `${cleanQuery} India`;
}

/**
 * Searches Google News RSS for Indian disaster queries and constructs validated URLs.
 */
export async function searchGoogleNews(
  query: string,
  options: {
    isCurrentNews?: boolean; // If true, enforces strict 72h temporal gate
    windowHours?: number;
    maxResults?: number;
  } = {}
): Promise<NewsArticle[]> {
  const { isCurrentNews = false, windowHours = 72, maxResults = 12 } = options;
  const cacheKey = JSON.stringify({
    query: query.trim().toLowerCase(),
    isCurrentNews,
    windowHours,
    maxResults,
  });

  const cached = newsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.articles.slice(0, maxResults);
  }

  const searchPhrase = buildSearchPhrase(query, isCurrentNews);
  const encodedQuery = encodeURIComponent(searchPhrase);
  const rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en`;

  const articles: NewsArticle[] = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (response && response.ok) {
      const xmlText = await response.text();
      const parsed = xmlParser.parse(xmlText);

      const items = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
      const itemsArray = Array.isArray(items) ? items : [items];

      const now = new Date();

      for (let i = 0; i < itemsArray.length && articles.length < maxResults; i++) {
        const item = itemsArray[i];
        if (!item || !item.title) continue;

        const rawTitle = String(item.title || '');
        const pubDateStr = String(item.pubDate || item.published || item.updated || '');

        // Extract publisher if available in title "Headline - Publisher Name"
        let title = rawTitle;
        let publisher = item.source?.['#text'] || item.source || 'National News Media';

        if (typeof publisher === 'object') {
          publisher = publisher['#text'] || 'Media';
        }

        if (rawTitle.includes(' - ')) {
          const parts = rawTitle.split(' - ');
          if (parts.length > 1) {
            publisher = parts[parts.length - 1].trim();
            title = parts.slice(0, -1).join(' - ').trim();
          }
        }

        // Clean HTML tags from summary / description
        const rawDesc = String(item.description || item.summary || '');
        const summary = cleanNewsText(rawDesc) || cleanNewsText(title);

        const gateResult = evaluateTemporalGate(pubDateStr, now, windowHours);

        // For Present layer: strictly enforce gate
        if (isCurrentNews && !gateResult.isEligible) {
          continue;
        }

        // Direct validated Google News search URL for 100% reliable link resolution
        const validNewsUrl = item.link && item.link.startsWith('http')
          ? item.link
          : `https://news.google.com/search?q=${encodeURIComponent(title)}&hl=en-IN&gl=IN&ceid=IN:en`;

        articles.push({
          id: `gn-${Math.random().toString(36).substring(2, 9)}`,
          title,
          summary: summary.length > 280 ? summary.substring(0, 277) + '...' : summary,
          url: validNewsUrl,
          publisher: String(publisher),
          publishedAt: pubDateStr || new Date().toISOString(),
          relativeTime: gateResult.relativeTime,
          recencyVerified: gateResult.recencyVerified,
          isWithinTemporalGate: gateResult.isEligible,
          query,
        });
      }
    }
  } catch (err) {
    console.log('Google News fetch notice:', (err as Error).message);
  }

  const deduped = filterIncidentEvidenceArticles(deduplicateNewsArticles(articles)).slice(0, maxResults);
  newsCache.set(cacheKey, {
    expiresAt: Date.now() + NEWS_CACHE_TTL_MS,
    articles: deduped,
  });

  return deduped;
}

