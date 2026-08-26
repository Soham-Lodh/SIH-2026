import { CitedSource, NewsArticle } from '../types/disaster';

export interface NumericClaim {
  value: number;
  sourceId?: string;
  text: string;
  metric?: 'deaths' | 'injured' | 'missing' | 'displaced' | 'evacuated' | 'rescued' | 'affected';
  qualifier?: 'at least' | 'more than' | 'over' | 'around' | 'nearly' | 'reported';
}

export interface NumericReconciliationResult {
  rangeMin: number;
  rangeMax: number;
  outliers: number[];
  outlierClaims: NumericClaim[];
}

export interface EventSourceFilterContext {
  eventName: string;
  disasterType?: string;
  state?: string;
  approxDate?: string;
}

/**
 * Validates and sanitizes citation references in text.
 * If text contains [S7] or [S99] but only [S1, S2, S3] exist in the evidence bundle,
 * invalid citations are removed or cleaned so fake source references never reach the user (Section 23 / Section 94).
 */
export function validateAndCleanCitations(text: string, validSources: CitedSource[]): string {
  if (!text) return '';
  const validIds = new Set(validSources.map((s) => s.id.toUpperCase().trim()));

  const normalizedText = text
    .replace(/ã€\s*(S\d+)\s*ã€‘/gi, '[$1]')
    .replace(/【\s*(S\d+)\s*】/gi, '[$1]')
    .replace(/［\s*(S\d+)\s*］/gi, '[$1]');

  // Replace citation markers like [S1], [S2][S4], [S7]
  return normalizedText.replace(/\[(S\d+)\]/gi, (match, citationId) => {
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

const casualtyContextPattern =
  /\b(death|deaths|dead|killed|fatalit(?:y|ies)|casualt(?:y|ies)|missing|injured|injur(?:y|ies)|victims?|displaced|evacuat(?:ed|ion)|rescued?|affected)\b/i;
const numericPattern = /\b\d{1,3}(?:,\d{2,3})*(?:\.\d+)?\b/g;

function normalizeNumericClaim(raw: string): number | null {
  const value = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

/**
 * Extracts casualty and human-impact numeric claims from raw source text.
 * This intentionally requires nearby casualty language so years, dates, and money
 * do not get promoted into human-loss statistics.
 */
export function extractCasualtyNumericClaims(sources: Array<Pick<CitedSource, 'id' | 'title' | 'summary'>>): NumericClaim[] {
  const claims: NumericClaim[] = [];

  for (const source of sources) {
    const text = `${source.title || ''}. ${source.summary || ''}`;
    const matches = Array.from(text.matchAll(numericPattern));

    for (const match of matches) {
      const start = Math.max(0, (match.index || 0) - 120);
      const end = Math.min(text.length, (match.index || 0) + match[0].length + 120);
      const context = text.slice(start, end);
      if (!casualtyContextPattern.test(context)) continue;

      const value = normalizeNumericClaim(match[0]);
      if (value === null) continue;
      const lowerContext = context.toLowerCase();
      const metric: NumericClaim['metric'] =
        /\b(killed|dead|deaths?|fatalit)/i.test(lowerContext) ? 'deaths'
          : /\binjur/i.test(lowerContext) ? 'injured'
            : /\bmissing\b/i.test(lowerContext) ? 'missing'
              : /\bdisplaced\b/i.test(lowerContext) ? 'displaced'
                : /\bevacuat/i.test(lowerContext) ? 'evacuated'
                  : /\brescu/i.test(lowerContext) ? 'rescued'
                    : /\baffected\b/i.test(lowerContext) ? 'affected'
                      : undefined;
      const qualifier: NumericClaim['qualifier'] =
        /\bat least\b/i.test(lowerContext) ? 'at least'
          : /\bmore than\b/i.test(lowerContext) ? 'more than'
            : /\bover\b/i.test(lowerContext) ? 'over'
              : /\baround\b/i.test(lowerContext) ? 'around'
                : /\bnearly\b/i.test(lowerContext) ? 'nearly'
                  : 'reported';
      claims.push({
        value,
        sourceId: source.id,
        text: context.replace(/\s+/g, ' ').trim(),
        metric,
        qualifier,
      });
    }
  }

  return claims;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Reconciles numeric claims by clustering around the median and separating
 * extreme values. For small news sets, a value at least 3x the median is a
 * clearer signal than IQR, which is unstable with only 3-5 sources.
 */
export function reconcileNumericClaims(values: number[] | NumericClaim[]): NumericReconciliationResult {
  const claims: NumericClaim[] = values
    .map((value) => typeof value === 'number' ? { value, text: String(value) } : value)
    .filter((claim) => Number.isFinite(claim.value) && claim.value > 0);

  if (!claims.length) {
    return { rangeMin: 0, rangeMax: 0, outliers: [], outlierClaims: [] };
  }

  if (claims.length === 1) {
    return { rangeMin: claims[0].value, rangeMax: claims[0].value, outliers: [], outlierClaims: [] };
  }

  const valuesOnly = claims.map((claim) => claim.value);
  const med = median(valuesOnly);
  const sorted = [...valuesOnly].sort((a, b) => a - b);
  const lower = sorted.slice(0, Math.floor(sorted.length / 2));
  const upper = sorted.slice(Math.ceil(sorted.length / 2));
  const q1 = lower.length ? median(lower) : sorted[0];
  const q3 = upper.length ? median(upper) : sorted[sorted.length - 1];
  const iqr = q3 - q1;

  const outlierClaims = claims.filter((claim) => {
    if (claims.length <= 5 && med > 0 && claim.value >= med * 3) return true;
    if (iqr > 0 && (claim.value < q1 - 1.5 * iqr || claim.value > q3 + 1.5 * iqr)) return true;
    return false;
  });

  const outlierSet = new Set(outlierClaims);
  const clustered = claims.filter((claim) => !outlierSet.has(claim));
  const finalCluster = clustered.length ? clustered : claims;
  const clusterValues = finalCluster.map((claim) => claim.value);

  return {
    rangeMin: Math.min(...clusterValues),
    rangeMax: Math.max(...clusterValues),
    outliers: outlierClaims.map((claim) => claim.value),
    outlierClaims,
  };
}

const incidentEvidencePattern =
  /\b(killed|dead|deaths?|fatalit(?:y|ies)|injured|missing|evacuat(?:ed|ion)|rescued?|relief|shelter|ndrf|sdrf|damage(?:d)?|collapsed?|washed away|inundat(?:ed|ion)|landslide|flood(?:ed)?|cyclone|earthquake|quake|seismic|heatwave|heat wave|district|village|rainfall|warning issued)\b/i;
const hardIncidentPattern =
  /\b(killed|dead|deaths?|fatalit(?:y|ies)|injured|missing|evacuat(?:ed|ion)|rescued?|relief|shelter|ndrf|sdrf|damage(?:d)?|collapsed?|washed away|inundat(?:ed|ion)|district|village|quake|earthquake)\b/i;
const techAnnouncementPattern =
  /\b(new\s+(?:app|model|ai|system|tech|device|drone|sensor)\s+(?:to\s+|that\s+|for\s+)?(?:predict|counter|detect|prevent|warn)|launch(?:es|ed)?|unveils?|startup|funding|raises?\s+\$|partnership|research paper|study finds)\b/i;
const passingMentionPattern =
  /\b(astrologer|actor|film|celebrity|arrest(?:ed)?|politic(?:al|ian)|election|court|interview|opinion|column)\b/i;
const impactFactPattern =
  /\b(killed|dead|deaths?|fatalit(?:y|ies)|injured|missing|evacuat(?:ed|ion)|rescued?|relief|shelter|ndrf|sdrf|damage(?:d)?|collapsed?|washed away|inundat(?:ed|ion)|district|village|houses?|roads?|bridges?|power|economic|loss|crore)\b/i;

export function scoreIncidentEvidence(article: Pick<NewsArticle, 'title' | 'summary'>): number {
  const text = `${article.title || ''}. ${article.summary || ''}`;
  const matches = text.match(new RegExp(incidentEvidencePattern.source, 'gi'));
  const keywordScore = matches ? Math.min(matches.length, 5) : 0;
  if (keywordScore === 0) return 0;
  let score = keywordScore;
  if (/\b(19|20)\d{2}\b/.test(text)) score += 1;
  if (techAnnouncementPattern.test(text) && !hardIncidentPattern.test(text)) return 0;
  if (passingMentionPattern.test(text) && !impactFactPattern.test(text)) return 0;
  return score;
}

export function filterIncidentEvidenceArticles<T extends Pick<NewsArticle, 'title' | 'summary'>>(articles: T[]): T[] {
  return articles.filter((article) => scoreIncidentEvidence(article) > 0);
}

const disasterTerms = new Set([
  'cyclone',
  'flood',
  'floods',
  'earthquake',
  'landslide',
  'landslides',
  'disaster',
  'storm',
  'rain',
  'heavy',
  'heat',
  'wave',
  'india',
  'indian',
  'alert',
  'warning',
  'casualties',
  'damage',
  'rescue',
  'relief',
]);

function tokenizeSpecificTerms(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 4 && !disasterTerms.has(term));
}

function eventYear(value?: string): string | null {
  if (!value) return null;
  return value.match(/\b(19\d\d|20\d\d)\b/)?.[0] || null;
}

/**
 * Event-specific relevance gate for citation integrity. A source must mention
 * the named event/alias or enough specific entities to distinguish it from
 * generic disaster coverage.
 */
export function filterSourcesForEvent<T extends Pick<NewsArticle, 'title' | 'summary'>>(
  articles: T[],
  context: EventSourceFilterContext,
): T[] {
  const eventName = context.eventName.trim().toLowerCase();
  const specificTerms = tokenizeSpecificTerms(context.eventName);
  const requiredYear = eventYear(context.approxDate || context.eventName);
  const state = context.state?.trim().toLowerCase();
  const disasterType = context.disasterType?.trim().toLowerCase();

  return articles.filter((article) => {
    const text = `${article.title || ''}. ${article.summary || ''}`.toLowerCase();
    if (eventName.length >= 4 && text.includes(eventName)) return true;

    const overlap = specificTerms.filter((term) => text.includes(term)).length;
    if (overlap >= 1 && requiredYear && text.includes(requiredYear)) return true;
    if (overlap >= 2) return true;

    const hasState = Boolean(state && text.includes(state));
    const hasType = Boolean(disasterType && text.includes(disasterType));
    const hasYear = Boolean(requiredYear && text.includes(requiredYear));
    return hasState && hasType && hasYear;
  });
}
