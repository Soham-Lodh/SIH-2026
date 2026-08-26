import {
  EvidenceBundle,
  CitedSource,
  TimelineEvent,
  ConflictingReport,
  NewsArticle,
  DisasterCategory,
} from './types/disaster';
import type { HistoricalDisasterItem } from './data/historicalDisasters';
import {
  extractCasualtyNumericClaims,
  filterIncidentEvidenceArticles,
  filterSourcesForEvent,
  reconcileNumericClaims,
  validateAndCleanCitations,
} from './lib/evidenceUtils';
import { coerceIsoDate, formatDisasterDate } from './lib/dateFormat';
import { normalizeLang, translateArray, translateText } from './lib/translate';
import { searchGoogleNews } from './googleNews';

const evidenceBundleCache = new Map<string, { expiresAt: number; bundle: EvidenceBundle }>();
const recentArchiveCache = new Map<string, { expiresAt: number; items: HistoricalDisasterItem[] }>();
const eraDiscoveryCache = new Map<string, { expiresAt: number; events: EraDisasterSeed[] }>();
let recentArchiveWarmupStarted = false;
const EVIDENCE_BUNDLE_CACHE_TTL_MS = 10 * 60 * 1000;
const RECENT_ARCHIVE_CACHE_TTL_MS = 20 * 60 * 1000;
const ERA_DISCOVERY_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
type GroqKeyScope = 'default' | 'past' | 'pastFilters' | 'chat' | 'stt' | 'tts';
type EraDisasterSeed = {
  eventName: string;
  approxDate: string;
  eventDate?: string;
  location: string;
  state?: string;
  disasterType: DisasterCategory;
};
const RECENT_ARCHIVE_QUERIES = [
  'India flood',
  'India cyclone',
  'India earthquake',
  'India landslide',
  'India heavy rain',
  'India heat wave',
  'India thunderstorm',
  'India lightning',
  'India forest fire',
  'India drought',
  'India urban flood',
  'India avalanche',
];
const INDIAN_STATES = [
  'andaman and nicobar islands',
  'andhra pradesh',
  'arunachal pradesh',
  'assam',
  'bihar',
  'chhattisgarh',
  'goa',
  'gujarat',
  'haryana',
  'himachal pradesh',
  'jharkhand',
  'karnataka',
  'kerala',
  'ladakh',
  'madhya pradesh',
  'maharashtra',
  'manipur',
  'meghalaya',
  'mizoram',
  'nagaland',
  'odisha',
  'punjab',
  'rajasthan',
  'sikkim',
  'tamil nadu',
  'telangana',
  'tripura',
  'uttarakhand',
  'uttar pradesh',
  'west bengal',
  'delhi',
  'jammu and kashmir',
  'puducherry',
];

function getGroqBaseUrl(): string {
  return process.env.GROQ_BASE_URL?.trim() || 'https://api.groq.com/openai/v1';
}

function getGroqChatModels(): string[] {
  return (process.env.GROQ_MODEL_FALLBACKS || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
}

function getGroqSttModel(): string {
  return process.env.GROQ_STT_MODEL?.trim() || 'whisper-large-v3-turbo';
}

function getGroqTtsModel(): string {
  return process.env.GROQ_TTS_MODEL?.trim() || 'canopylabs/orpheus-v1-english';
}

function getGroqTtsVoice(): string {
  return process.env.GROQ_TTS_VOICE?.trim() || 'austin';
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

function getGroqKey(scope: GroqKeyScope = 'default'): string {
  const scopeEnvMap: Record<Exclude<GroqKeyScope, 'default'>, string[]> = {
    past: ['GROQ_API_KEY_PAST', 'GROQ_API_KEY_HISTORY', 'GROQ_API_KEY'],
    pastFilters: ['GROQ_API_KEY_PAST_FILTERS'],
    chat: ['GROQ_API_KEY_CHAT', 'GROQ_API_KEY_ASSISTANT', 'GROQ_API_KEY'],
    stt: ['GROQ_API_KEY_STT', 'GROQ_API_KEY_AUDIO', 'GROQ_API_KEY'],
    tts: ['GROQ_API_KEY_TTS', 'GROQ_API_KEY_AUDIO', 'GROQ_API_KEY'],
  };

  const envNames =
    scope === 'default'
      ? ['GROQ_API_KEY']
      : scopeEnvMap[scope];

  for (const envName of envNames) {
    const apiKey = process.env[envName]?.trim();
    if (apiKey) return apiKey;
  }

  const label = scope === 'default' ? 'GROQ_API_KEY' : envNames.join(' or ');
  throw new Error(`${label} is not configured.`);
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[(S\d+)\]/gi, ' ')
    .replace(/[*_`>#-]+/g, ' ')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeGeneratedReply(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function translatePreservingCitations(text: string, targetLanguage?: string): Promise<string> {
  const lang = normalizeLang(targetLanguage);
  if (lang === 'en') return text;

  const citations = Array.from(new Set(text.match(/\[S\d+\]/gi) || []));
  const placeholders = citations.map((citation, idx) => ({
    citation,
    token: `__CITE_${idx}__`,
  }));

  let working = text;
  for (const { citation, token } of placeholders) {
    working = working.replace(new RegExp(citation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), token);
  }

  const translated = await translateText(working, lang);

  let restored = translated;
  for (const { citation, token } of placeholders) {
    restored = restored.replace(new RegExp(token, 'g'), citation.toUpperCase());
  }

  return restored;
}

function inferDisasterType(text: string): DisasterCategory {
  const lower = text.toLowerCase();
  if (lower.includes('cyclone') || lower.includes('storm')) return 'Cyclone';
  if (lower.includes('flood') || lower.includes('inundat') || lower.includes('waterlogging')) return 'Flood';
  if (lower.includes('earthquake') || lower.includes('seismic') || lower.includes('tremor')) return 'Earthquake';
  if (lower.includes('landslide') || lower.includes('mudslide') || lower.includes('rockfall')) return 'Landslide';
  if (lower.includes('heat wave') || lower.includes('heatwave') || lower.includes('heat')) return 'Heat Wave';
  if (lower.includes('thunderstorm')) return 'Thunderstorm';
  if (lower.includes('lightning')) return 'Lightning';
  if (lower.includes('heavy rain') || lower.includes('rain')) return 'Heavy Rain';
  if (lower.includes('forest fire') || lower.includes('wildfire')) return 'Forest Fire';
  if (lower.includes('drought')) return 'Drought';
  if (lower.includes('avalanche')) return 'Avalanche';
  return 'General Alert';
}

function inferState(text: string): string {
  const lower = text.toLowerCase();
  for (const state of INDIAN_STATES) {
    if (lower.includes(state)) {
      return state.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  if (lower.includes('odisha') || lower.includes('puri') || lower.includes('bhubaneswar')) return 'Odisha';
  if (lower.includes('kerala') || lower.includes('wayanad') || lower.includes('kochi')) return 'Kerala';
  if (lower.includes('assam') || lower.includes('guwahati')) return 'Assam';
  if (lower.includes('tamil nadu') || lower.includes('chennai')) return 'Tamil Nadu';
  if (lower.includes('maharashtra') || lower.includes('mumbai')) return 'Maharashtra';
  if (lower.includes('uttarakhand') || lower.includes('dehradun')) return 'Uttarakhand';
  if (lower.includes('himachal') || lower.includes('shimla')) return 'Himachal Pradesh';
  if (lower.includes('rajasthan') || lower.includes('jaipur')) return 'Rajasthan';
  if (lower.includes('gujarat') || lower.includes('ahmedabad')) return 'Gujarat';
  if (lower.includes('west bengal') || lower.includes('kolkata')) return 'West Bengal';
  if (lower.includes('delhi') || lower.includes('ncr')) return 'Delhi';

  return 'India';
}

function inferLocation(text: string, fallbackState: string): string {
  const lower = text.toLowerCase();
  const separators = [',', ' - ', ' near ', ' in '];
  for (const sep of separators) {
    const idx = lower.indexOf(sep);
    if (idx > 0) {
      const raw = text.slice(0, idx).trim();
      if (raw.length >= 3) return raw;
    }
  }

  if (fallbackState !== 'India') return fallbackState;
  return 'India';
}

function deriveYearFromBundle(bundle: EvidenceBundle): number {
  const eventDate = coerceIsoDate(bundle.eventDate);
  if (eventDate) return new Date(eventDate).getFullYear();
  const dateRangeYear = bundle.dateRange?.match(/\b(19\d\d|20\d\d)\b/)?.[0];
  if (dateRangeYear) return Number(dateRangeYear);
  return new Date(bundle.synthesizedAt).getFullYear();
}

function formatCasualtyRange(range: ReturnType<typeof reconcileNumericClaims>): string | null {
  if (!range.rangeMin && !range.rangeMax) return null;
  const base = range.rangeMin === range.rangeMax
    ? `${range.rangeMin.toLocaleString('en-IN')} reported casualties/deaths in retrieved source claims.`
    : `${range.rangeMin.toLocaleString('en-IN')}-${range.rangeMax.toLocaleString('en-IN')} reported casualties/deaths across clustered source claims.`;
  if (!range.outliers.length) return base;
  return `${base} Outlier claim(s) ${range.outliers.map((value) => value.toLocaleString('en-IN')).join(', ')} excluded from the range.`;
}

function extractCandidateFacts(sources: CitedSource[]): Record<string, string[]> {
  const patterns: Record<string, RegExp> = {
    casualties: /\b(?:\d[\d,]*\s+(?:people\s+)?(?:dead|deaths?|killed|fatalit(?:y|ies)|injured|missing)|(?:dead|deaths?|killed|injured|missing|casualties)[^.;]{0,80}\d[\d,]*)\b/gi,
    damage: /\b(?:₹|rs\.?|inr|crore|lakh|damage(?:d)?|collapsed?|washed away|destroyed|houses?|roads?|bridges?|power|infrastructure)[^.;]{0,140}/gi,
    response: /\b(?:ndrf|sdrf|evacuat(?:ed|ion)|rescued?|relief|shelter|army|navy|air force|government|administration)[^.;]{0,140}/gi,
    location: /\b(?:district|village|state|coast|city|town|taluk|block|panchayat)[^.;]{0,120}/gi,
    dates: /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+(?:19|20)\d{2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(?:19|20)\d{2}|\b(?:19|20)\d{2}\b)/gi,
  };

  return Object.fromEntries(Object.entries(patterns).map(([key, pattern]) => [
    key,
    sources.flatMap((source) => {
      const text = `${source.title}. ${source.summary}`;
      return Array.from(text.matchAll(pattern))
        .map((match) => `[${source.id}] ${match[0].replace(/\s+/g, ' ').trim()}`)
        .slice(0, 3);
    }).slice(0, 10),
  ]));
}

function sanitizeUnavailableField(value: string, facts: string[], fallback: string): string {
  if (facts.length && /information unavailable|not available|not clearly quantified|no .*details/i.test(value)) {
    return `${fallback} ${facts.slice(0, 3).join('; ')}.`;
  }
  return value;
}

function buildNumericRangeObject(range: ReturnType<typeof reconcileNumericClaims>): EvidenceBundle['numericCasualtiesRange'] | undefined {
  if (!range.rangeMin && !range.rangeMax) return undefined;
  return {
    min: range.rangeMin,
    max: range.rangeMax,
    outliers: range.outliers,
    outlierSources: range.outlierClaims.map((claim) => ({
      value: claim.value,
      sourceIds: claim.sourceId ? [claim.sourceId] : [],
    })),
  };
}

function buildNumericConflictReports(range: ReturnType<typeof reconcileNumericClaims>): ConflictingReport[] {
  return range.outlierClaims.map((claim) => ({
    topic: 'Casualty figure outlier',
    details: `${claim.value.toLocaleString('en-IN')} was excluded from the reported casualty range as a statistical outlier${claim.sourceId ? ` [${claim.sourceId}]` : ''}.`,
    sources: claim.sourceId ? [claim.sourceId] : [],
  }));
}

function normalizeSynthesizedData(raw: any, fallbackQuery: string, sources: CitedSource[]): any {
  const fallback = buildDeterministicFallbackSynthesis(fallbackQuery, sources);
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    ...fallback,
    ...data,
    eventName: typeof data.eventName === 'string' && data.eventName.trim() ? data.eventName.trim() : fallback.eventName,
    disasterType: typeof data.disasterType === 'string' && data.disasterType.trim() ? data.disasterType.trim() : fallback.disasterType,
    location: typeof data.location === 'string' && data.location.trim() ? data.location.trim() : fallback.location,
    state: typeof data.state === 'string' && data.state.trim() ? data.state.trim() : fallback.state,
    country: 'India',
    dateRange: typeof data.dateRange === 'string' && data.dateRange.trim() ? data.dateRange.trim() : fallback.dateRange,
    eventDate: coerceIsoDate(data.eventDate || data.approxDate || data.dateRange),
    conflictingReports: Array.isArray(data.conflictingReports) ? data.conflictingReports : [],
    timeline: Array.isArray(data.timeline) ? data.timeline : [],
  };
}

function sortArchiveItems(items: HistoricalDisasterItem[]): HistoricalDisasterItem[] {
  return items.sort((a, b) => {
    const aTime = a.eventDate ? new Date(a.eventDate).getTime() : NaN;
    const bTime = b.eventDate ? new Date(b.eventDate).getTime() : NaN;
    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return bTime - aTime;
    if (Number.isFinite(aTime)) return -1;
    if (Number.isFinite(bTime)) return 1;
    return b.year - a.year;
  });
}

function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Buffer.from(bytes).toString('base64');
}

async function groqChatCompletion(params: {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  keyScope?: GroqKeyScope;
}): Promise<string> {
  const apiKey = getGroqKey(params.keyScope || 'default');
  const baseUrl = getGroqBaseUrl();
  let lastError: Error | null = null;

  for (const model of [params.model, ...getGroqChatModels()].filter(Boolean)) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: params.messages,
          temperature: params.temperature ?? 0.2,
          ...(params.maxTokens ? { max_completion_tokens: params.maxTokens } : {}),
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Groq chat completion failed for ${model}: HTTP ${response.status} ${text}`.trim());
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) {
        return content.trim();
      }

      throw new Error(`Groq chat completion returned an empty response for ${model}.`);
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError || new Error('Groq chat completion failed.');
}

function mimeToExt(mime: string): string {
  const base = mime.split(';')[0].trim().toLowerCase();
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/flac': 'flac',
    'audio/m4a': 'm4a',
  };
  return map[base] || 'webm';
}

export async function transcribeAudio(audio: Buffer | string, mimeType: string = 'audio/webm'): Promise<{ text: string; language?: string }> {
  const apiKey = getGroqKey('stt');
  const baseUrl = getGroqBaseUrl();
  const sttModel = getGroqSttModel();
  const audioBuffer = Buffer.isBuffer(audio)
    ? audio
    : Buffer.from(audio.replace(/^data:[^;]+;base64,/, ''), 'base64');
  const form = new FormData();
  const normalizedMime = mimeType.split(';')[0] || 'audio/webm';
  form.append('file', new Blob([audioBuffer], { type: normalizedMime }), `audio.${mimeToExt(mimeType)}`);
  form.append('model', sttModel);
  // verbose_json keeps Whisper's detected language so the client can preserve
  // the language actually spoken instead of blindly using the UI selection.
  form.append('response_format', 'verbose_json');
  form.append('temperature', '0');
  form.append(
    'prompt',
    'Transcribe the spoken disaster query accurately in the same language/script as spoken. Return only the transcription text.',
  );

  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Groq transcription failed: HTTP ${response.status} ${text}`.trim());
  }

  const data = (await response.json()) as { text?: unknown; language?: unknown };
  return {
    text: String(data?.text || '').trim(),
    language: typeof data?.language === 'string' ? data.language.trim() : undefined,
  };
}

export async function generateWithFallback(params: {
  prompt: string;
  systemInstruction?: string;
  responseMimeType?: string;
  keyScope?: GroqKeyScope;
}): Promise<string | null> {
  try {
    return await groqChatCompletion({
      messages: [
        ...(params.systemInstruction
          ? [{ role: 'system' as const, content: params.systemInstruction }]
          : []),
        { role: 'user', content: params.prompt },
      ],
      temperature: params.responseMimeType === 'application/json' ? 0.1 : 0.2,
      keyScope: params.keyScope,
    });
  } catch (error) {
    console.warn('Groq generation failed:', (error as Error).message);
    return null;
  }
}

async function normalizeDisasterSearchQuery(query: string): Promise<string | null> {
  const raw = await generateWithFallback({
    keyScope: 'past',
    systemInstruction: 'Correct Indian disaster event search phrases. Return only the corrected search phrase, with no commentary.',
    prompt: `The user is searching for an Indian disaster event. Correct spelling or typo errors to the most likely real event/location name. If it is already correct, return the original phrase.\n\nQuery: ${query}`,
  });

  const normalized = raw?.replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.toLowerCase() === query.toLowerCase()) return null;
  return normalized;
}

export async function buildHistoricalEvidenceBundle(
  userQuery: string,
  categoryFilter?: string,
  stateFilter?: string,
): Promise<EvidenceBundle> {
  const baseQuery = userQuery.trim();
  const cacheKey = JSON.stringify({
    baseQuery: baseQuery.toLowerCase(),
    categoryFilter: categoryFilter || '',
    stateFilter: stateFilter || '',
  });

  const cached = evidenceBundleCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.bundle;
  }

  let searchQueries = Array.from(
    new Set(
      [
        baseQuery,
        `${baseQuery} India`,
        `${baseQuery} India disaster`,
        `${baseQuery} casualties damage`,
        `${baseQuery} evacuation rescue relief`,
        categoryFilter ? `${baseQuery} ${categoryFilter} India` : '',
        stateFilter ? `${baseQuery} ${stateFilter} India` : '',
      ].filter(Boolean),
    ),
  );

  const allArticles: NewsArticle[] = [];
  for (const q of searchQueries) {
    const res = await searchGoogleNews(q, { isCurrentNews: false, maxResults: 4 });
    allArticles.push(...res);
  }
  let eventFilterQuery = baseQuery;

  if (!allArticles.length) {
    const normalizedQuery = await normalizeDisasterSearchQuery(baseQuery);
    if (normalizedQuery) {
      eventFilterQuery = normalizedQuery;
      searchQueries = Array.from(new Set([
        ...searchQueries,
        normalizedQuery,
        `${normalizedQuery} India`,
        `${normalizedQuery} India disaster`,
        `${normalizedQuery} casualties damage`,
      ]));
      for (const q of searchQueries.slice(-4)) {
        const res = await searchGoogleNews(q, { isCurrentNews: false, maxResults: 4 });
        allArticles.push(...res);
      }
    }
  }

  const uniqueArticlesMap = new Map<string, NewsArticle>();
  for (const art of allArticles) {
    const key = art.title.toLowerCase().trim();
    if (!uniqueArticlesMap.has(key)) {
      uniqueArticlesMap.set(key, art);
    }
  }

  const incidentArticles = filterIncidentEvidenceArticles(Array.from(uniqueArticlesMap.values()));
  let sourcesList = filterSourcesForEvent(incidentArticles, {
    eventName: eventFilterQuery,
    disasterType: categoryFilter || inferDisasterType(baseQuery),
    state: stateFilter || inferState(baseQuery),
    approxDate: eventFilterQuery,
  }).slice(0, 6);
  if (!sourcesList.length) {
    const normalizedQuery = await normalizeDisasterSearchQuery(baseQuery);
    if (normalizedQuery) {
      eventFilterQuery = normalizedQuery;
      const correctedArticles: NewsArticle[] = [];
      const correctedQueries = [
        normalizedQuery,
        `${normalizedQuery} India disaster`,
        `${normalizedQuery} casualties damage`,
        `${normalizedQuery} evacuation rescue relief`,
      ];
      for (const q of correctedQueries) {
        const res = await searchGoogleNews(q, { isCurrentNews: false, maxResults: 4 });
        correctedArticles.push(...res);
      }
      searchQueries = Array.from(new Set([...searchQueries, ...correctedQueries]));
      sourcesList = filterSourcesForEvent(filterIncidentEvidenceArticles(correctedArticles), {
        eventName: normalizedQuery,
        disasterType: categoryFilter || inferDisasterType(normalizedQuery),
        state: stateFilter || inferState(normalizedQuery),
        approxDate: normalizedQuery,
      }).slice(0, 6);
    }
  }
  if (!sourcesList.length) {
    throw new Error('No live Google News sources were found for this query.');
  }

  const citedSources: CitedSource[] = sourcesList.map((art, idx) => ({
    id: `S${idx + 1}`,
    title: art.title,
    publisher: art.publisher,
    publishedAt: art.publishedAt,
    url: art.url,
    summary: art.summary,
    qualityScore: 90 - idx * 5,
  }));

  const sourcesText = citedSources
    .map((s) => `[${s.id}] Title: ${s.title}\nPublisher: ${s.publisher} (${s.publishedAt})\nSummary: ${s.summary}\nURL: ${s.url}`)
    .join('\n\n');
  const casualtyReconciliation = reconcileNumericClaims(extractCasualtyNumericClaims(citedSources));
  const casualtyRangeText = formatCasualtyRange(casualtyReconciliation);
  const candidateFacts = extractCandidateFacts(citedSources);
  const factsText = Object.entries(candidateFacts)
    .map(([topic, facts]) => `${topic}: ${facts.length ? facts.join(' | ') : 'none extracted'}`)
    .join('\n');

const systemInstruction = `You are a Senior Disaster Intelligence Research Architect.
Synthesize the provided disaster evidence strictly using the source documents labeled [S1], [S2], etc.
ABSOLUTE RULES:
1. Every factual statement MUST cite its source using [S1], [S2], etc.
2. NEVER invent casualty numbers, dates, locations, or source IDs.
3. If information is not provided in the sources, write "Information unavailable in the retrieved sources."
4. If sources conflict on numbers/facts, prefer a compact range when the values cluster closely (for example, 23-25). If one value is a clear outlier, do not merge it into the range; report it separately in conflictingReports and explain the likely reason for the spread.
5. Return JSON matching the requested schema.`;

  const prompt = `User Query: "${baseQuery}"
Category Filter: ${categoryFilter || 'None'}
State Filter: ${stateFilter || 'None'}
Retrieved Sources:
${sourcesText}
Per-source candidate facts extracted before synthesis:
${factsText}
Pre-computed casualty reconciliation:
${casualtyRangeText || 'No casualty/death numeric claims were confidently extracted from the source text.'}

Produce a structured historical evidence synthesis in JSON format:
{
  "eventName": "Clear event name",
  "disasterType": "Cyclone | Flood | Earthquake | Landslide | Heavy Rain | Heat Wave | General Alert",
  "location": "Affected City/District",
  "state": "State name",
  "country": "India",
  "eventDate": "ISO 8601 event date if the event occurrence date is supported by the sources",
  "dateRange": "Date or range",
  "reportedCasualties": "Reported human loss with citations",
  "reportedDamage": "Summary of infrastructure and economic loss with citations",
  "whatHappened": "3-5 factual sentences synthesizing the event with citations",
  "affectedAreas": "3-5 factual sentences on districts and communities impacted with citations",
  "humanImpact": "3-5 factual sentences on displacement, casualties, injuries, and missing people with citations",
  "infrastructureDamage": "3-5 factual sentences on power, roads, telecommunications, housing, and public infrastructure with citations",
  "economicImpact": "3-5 factual sentences on agricultural, business, and monetary loss with citations",
  "governmentResponse": "3-5 factual sentences on evacuation operations, declarations, deployments, and administration with citations",
  "rescueRelief": "3-5 factual sentences on shelters, ration distribution, medical aid, and rescue operations with citations",
  "recovery": "3-5 factual sentences on reconstruction, utility restoration, rehabilitation, and longer-term rebuilding with citations",
  "sourceAssessment": "Objective assessment of source reliability and coverage completeness",
  "conflictingReports": [{"topic": "Topic", "details": "Conflict summary", "sources": ["S1", "S2"]}],
  "timeline": [{"date": "Date string", "event": "Short title", "description": "Description with citations", "citations": ["S1"]}]
}`;

  const depthInstruction = `Write 3-5 substantive sentences per narrative section using all available facts across all sources and the extracted fact fragments. Do not output one-line placeholders when source material contains relevant facts for that section.`;

  let synthesizedData: any = null;

  try {
    const rawJson = await generateWithFallback({
      prompt,
      systemInstruction: `${systemInstruction}\n${depthInstruction}`,
      responseMimeType: 'application/json',
      keyScope: categoryFilter || stateFilter ? 'pastFilters' : 'past',
    });

    if (rawJson) {
      synthesizedData = normalizeSynthesizedData(JSON.parse(stripCodeFences(rawJson)), baseQuery, citedSources);
    }
  } catch (err) {
    console.warn('Groq synthesis parse failure:', (err as Error).message);
  }

  if (!synthesizedData) {
    synthesizedData = normalizeSynthesizedData(buildDeterministicFallbackSynthesis(baseQuery, citedSources), baseQuery, citedSources);
  }

  const whatHappened = validateAndCleanCitations(synthesizedData.whatHappened || '', citedSources);
  const affectedAreas = validateAndCleanCitations(sanitizeUnavailableField(synthesizedData.affectedAreas || '', candidateFacts.location, 'Affected locations extracted from sources:'), citedSources);
  const humanImpact = validateAndCleanCitations(sanitizeUnavailableField(synthesizedData.humanImpact || '', candidateFacts.casualties, 'Human-impact facts extracted from sources:'), citedSources);
  const infrastructureDamage = validateAndCleanCitations(sanitizeUnavailableField(synthesizedData.infrastructureDamage || '', candidateFacts.damage, 'Damage facts extracted from sources:'), citedSources);
  const economicImpact = validateAndCleanCitations(sanitizeUnavailableField(synthesizedData.economicImpact || '', candidateFacts.damage, 'Economic or damage facts extracted from sources:'), citedSources);
  const governmentResponse = validateAndCleanCitations(sanitizeUnavailableField(synthesizedData.governmentResponse || '', candidateFacts.response, 'Response facts extracted from sources:'), citedSources);
  const rescueRelief = validateAndCleanCitations(sanitizeUnavailableField(synthesizedData.rescueRelief || '', candidateFacts.response, 'Rescue and relief facts extracted from sources:'), citedSources);
  const recovery = validateAndCleanCitations(synthesizedData.recovery || '', citedSources);
  const reportedCasualties = validateAndCleanCitations(
    casualtyRangeText || synthesizedData.reportedCasualties || '',
    citedSources,
  );
  const reportedDamage = validateAndCleanCitations(synthesizedData.reportedDamage || '', citedSources);

  const cleanTimeline: TimelineEvent[] = (synthesizedData.timeline || []).map((t: any) => ({
    date: t.date || 'Recorded Period',
    event: t.event || 'Incident Milestone',
    description: validateAndCleanCitations(t.description || '', citedSources),
    citations: (t.citations || []).filter((c: string) => citedSources.some((s) => s.id === c)),
  }));

  const cleanConflicts: ConflictingReport[] = [
    ...buildNumericConflictReports(casualtyReconciliation),
    ...(synthesizedData.conflictingReports || []).map((c: any) => ({
    topic: c.topic || 'Reported Figures',
    details: validateAndCleanCitations(c.details || '', citedSources),
    sources: (c.sources || []).filter((sId: string) => citedSources.some((s) => s.id === sId)),
    })),
  ];
  const eventDate = coerceIsoDate(synthesizedData.eventDate || synthesizedData.dateRange)
    || coerceIsoDate([eventFilterQuery, ...candidateFacts.dates].join(' '));

  const bundle: EvidenceBundle = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    eventName: synthesizedData.eventName || baseQuery,
    disasterType: (synthesizedData.disasterType as DisasterCategory) || 'Cyclone',
    location: synthesizedData.location || 'India',
    state: synthesizedData.state || 'India',
    country: 'India',
    eventDate,
    dateRange: eventDate ? formatDisasterDate(eventDate) : synthesizedData.dateRange || 'Documented Occurrence',
    numericCasualtiesRange: buildNumericRangeObject(casualtyReconciliation),
    reportedCasualties: reportedCasualties || 'Casualty figures documented in source reports.',
    reportedDamage: reportedDamage || 'Infrastructure and sector damages documented in evidence.',
    sources: citedSources,
    timeline: cleanTimeline.length > 0 ? cleanTimeline : [
      {
        date: 'Day 1',
        event: 'Disaster Inception & Warning',
        description: `Early warnings and alerts issued [${citedSources[0]?.id || 'S1'}].`,
        citations: citedSources[0] ? [citedSources[0].id] : [],
      },
      {
        date: 'Day 2',
        event: 'Peak Impact',
        description: `Peak impact recorded in media reports [${citedSources[1]?.id || citedSources[0]?.id || 'S1'}].`,
        citations: citedSources[1] ? [citedSources[1].id] : [],
      },
    ],
    whatHappened: whatHappened || `${citedSources[0].summary} [${citedSources[0].id}]`,
    affectedAreas: affectedAreas || 'Districts and communities documented in source coverage.',
    humanImpact: humanImpact || 'Displacement and community disruption documented in cited journalism.',
    infrastructureDamage: infrastructureDamage || 'Electrical grid, highway corridors, and residential impacts reported.',
    economicImpact: economicImpact || 'Monetary losses and agricultural impacts reported across regional sectors.',
    governmentResponse: governmentResponse || 'State Disaster Management Authority and NDRF mobilization recorded.',
    rescueRelief: rescueRelief || 'Shelter operations, dry food packets, and medical deployment.',
    recovery: recovery || 'Long-term rehabilitation and infrastructure reconstruction initiatives.',
    sourceAssessment: synthesizedData.sourceAssessment || `Retrieved ${citedSources.length} verified news and government records.`,
    conflictingReports: cleanConflicts,
    synthesizedAt: new Date().toISOString(),
    evidenceStatus: citedSources.length >= 3 ? 'High Confidence' : 'Moderate Evidence',
    retrievalMetadata: {
      queriesExecuted: searchQueries,
      rawSourcesCount: allArticles.length,
      dedupedSourcesCount: citedSources.length,
    },
  };

  evidenceBundleCache.set(cacheKey, {
    expiresAt: Date.now() + EVIDENCE_BUNDLE_CACHE_TTL_MS,
    bundle,
  });

  return bundle;
}

const RECENT_ARCHIVE_SEARCHES = [
  'Kerala flood 2024 India',
  'Assam flood 2024 India',
  'Himachal Pradesh landslide 2024 India',
  'Wayanad landslide 2024 India',
  'Sikkim earthquake 2023 India',
  'Odisha cyclone 2024 India',
  'Maharashtra flood 2024 India',
  'Delhi heat wave 2024 India',
  'Rajasthan flood 2024 India',
  'Tamil Nadu cyclone 2024 India',
  'Karnataka rain flood 2024 India',
  'Bihar flood 2024 India',
  'West Bengal flood 2024 India',
  'Uttarakhand landslide 2024 India',
  'Punjab flood 2024 India',
  'Gujarat heat wave 2024 India',
  'Andhra Pradesh cyclone 2024 India',
  'Telangana flood 2024 India',
  'Goa heavy rain 2024 India',
  'Arunachal Pradesh landslide 2024 India',
  'Meghalaya flood 2024 India',
  'Mizoram landslide 2024 India',
  'Nagaland heavy rain 2024 India',
  'Chhattisgarh forest fire 2024 India',
  'Ladakh avalanche 2024 India',
  'Jammu Kashmir snow avalanche 2024 India',
  'Madhya Pradesh flood 2024 India',
  'Uttar Pradesh flood 2024 India',
  'West Bengal cyclone 2024 India',
  'Bengaluru urban flood 2024 India',
  'Tripura flood 2024 India',
  'Jammu Kashmir flood 2024 India',
  'Sikkim landslide 2024 India',
  'Odisha heat wave 2024 India',
  'Haryana heat wave 2024 India',
];

function buildArchiveQueryPool(options?: {
  categoryFilter?: string;
  stateFilter?: string;
  decadeFilter?: string;
  limit?: number;
}): string[] {
  const limit = Math.max(options?.limit || 30, 1);
  const category = options?.categoryFilter?.trim() || '';
  const state = options?.stateFilter?.trim() || '';
  const decade = options?.decadeFilter?.trim() || '';
  const decadeYearHints: Record<string, string[]> = {
    '1990s': ['1993', '1998', '1999'],
    '2000s': ['2001', '2004', '2008', '2009'],
    '2010s': ['2013', '2014', '2015', '2018', '2019'],
    '2020s': ['2020', '2021', '2022', '2023', '2024', '2025', '2026'],
  };

  const searchRoots = [
    category && state ? `${state} ${category}` : '',
    state ? `${state} disaster` : '',
    category ? `India ${category}` : '',
    state && decade ? `${state} ${decade}` : '',
  ].filter(Boolean);

  const hints = decadeYearHints[decade] || ['2024', '2025', '2026'];
  const decorateQuery = (query: string) => {
    const parts = [query, category, state, decade ? hints.slice(0, 3).join(' ') : '']
      .filter(Boolean)
      .join(' ');
    return `${parts} India`.replace(/\s+/g, ' ').trim();
  };
  const targeted = searchRoots.flatMap((root) => {
    const variants = [root, `${root} flood`, `${root} disaster`, ...hints.map((year) => `${root} ${year}`)];
    return variants.map(decorateQuery);
  });

  const combined = [
    ...targeted,
    ...RECENT_ARCHIVE_SEARCHES.map(decorateQuery),
  ];
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const query of combined) {
    const key = query.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(query);
    if (deduped.length >= Math.min(Math.max(limit * 3, 100), 240)) break;
  }

  return deduped;
}

function bundleToArchiveItem(bundle: EvidenceBundle, index: number): HistoricalDisasterItem {
  const year = deriveYearFromBundle(bundle);
  return {
    ...bundle,
    year,
    numericCasualties: bundle.numericCasualtiesRange?.max || Number(bundle.reportedCasualties?.match(/(\d[\d,]*)/)?.[1]?.replace(/,/g, '') || 0),
    decade: year < 2000 ? '1990s' : year < 2010 ? '2000s' : year < 2020 ? '2010s' : '2020s',
    id: bundle.id || `archive-${index}`,
  };
}

function makeArchiveTimeline(sources: CitedSource[], eventDate?: string): TimelineEvent[] {
  const incidentDate = eventDate ? formatDisasterDate(eventDate) : 'Recorded period';
  if (sources.length === 0) {
    return [
      {
        date: incidentDate,
        event: 'Event summary unavailable',
        description: 'No archived source timeline could be synthesized.',
        citations: [],
      },
    ];
  }

  return sources.map((source, idx) => ({
    date: incidentDate,
    event: source.title.slice(0, 48),
    description: `${source.summary} [${source.id}]`,
    citations: [source.id],
  }));
}

async function buildArchiveEvidenceBundle(query: string, index: number, seed?: EraDisasterSeed): Promise<HistoricalDisasterItem | null> {
  const articles = await searchGoogleNews(query, { isCurrentNews: false, maxResults: 3 });
  const incidentArticles = filterIncidentEvidenceArticles(articles);
  const sourcesList = filterSourcesForEvent(incidentArticles, {
    eventName: seed?.eventName || query,
    disasterType: seed?.disasterType || inferDisasterType(query),
    state: seed?.state || inferState(query),
    approxDate: seed?.approxDate,
  }).slice(0, 3);

  if (!sourcesList.length && !seed) {
    return null;
  }

  const citedSources: CitedSource[] = sourcesList.map((art, idx) => ({
    id: `S${idx + 1}`,
    title: art.title,
    publisher: art.publisher,
    publishedAt: art.publishedAt,
    url: art.url,
    summary: art.summary,
    qualityScore: 90 - idx * 5,
  }));

  const joinedText = [query, ...citedSources.map((s) => `${s.title} ${s.summary}`)].join(' ');
  const disasterType = seed?.disasterType || inferDisasterType(joinedText);
  const queryState = seed?.state || inferState(query);
  const state = queryState !== 'India' ? queryState : inferState(joinedText);
  const location = seed?.location || inferLocation(joinedText, state);
  const topSource = citedSources[0];
  const eventDate = coerceIsoDate(seed?.eventDate || seed?.approxDate || query);
  const casualtyReconciliation = reconcileNumericClaims(extractCasualtyNumericClaims(citedSources));
  const casualtyRangeText = formatCasualtyRange(casualtyReconciliation);
  const sourceCitation = citedSources[0] ? ` [${citedSources[0].id}]` : '';

  const bundle: EvidenceBundle = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    eventName: seed?.eventName || topSource?.title.replace(/^\d{4}\s*[-:]\s*/, '') || query,
    disasterType,
    location,
    state,
    country: 'India',
    eventDate,
    dateRange: eventDate ? formatDisasterDate(eventDate) : seed?.approxDate || 'Documented Occurrence',
    numericCasualtiesRange: buildNumericRangeObject(casualtyReconciliation),
    reportedCasualties: casualtyRangeText || 'Information unavailable in the retrieved sources.',
    reportedDamage: 'Information unavailable in the retrieved sources.',
    sources: citedSources,
    timeline: makeArchiveTimeline(citedSources, eventDate),
    whatHappened: citedSources.length
      ? citedSources.map((s) => `${s.summary} [${s.id}]`).join(' ')
      : `${seed?.eventName || query} is a model-sourced historical Indian disaster seed for ${location}, ${state}. External Google News citations were sparse for this era.`,
    affectedAreas: `Coverage indicates ${state} and nearby affected districts were discussed${sourceCitation}.`,
    humanImpact: citedSources.length ? 'Human impact details were referenced in the retrieved source coverage.' : 'Human impact details require external archival corroboration.',
    infrastructureDamage: 'Infrastructure damage details were not clearly quantified in the retrieved source coverage.',
    economicImpact: 'Economic impact figures were not clearly quantified in the retrieved source coverage.',
    governmentResponse: 'Official response details were summarized in the retrieved source coverage.',
    rescueRelief: 'Rescue and relief information was referenced in the retrieved source coverage.',
    recovery: 'Recovery details were not clearly quantified in the retrieved source coverage.',
    sourceAssessment: citedSources.length
      ? `Synthesized from ${citedSources.length} live news sources indexed for the archive.`
      : 'Model-Sourced / Limited External Citation: Google News RSS returned sparse or no archival citations for this era; event metadata comes from the era discovery model prompt.',
    conflictingReports: buildNumericConflictReports(casualtyReconciliation),
    synthesizedAt: new Date().toISOString(),
    evidenceStatus: citedSources.length >= 2 ? 'High Confidence' : citedSources.length ? 'Moderate Evidence' : 'Model-Sourced / Limited External Citation',
    retrievalMetadata: {
      queriesExecuted: [query],
      rawSourcesCount: articles.length,
      dedupedSourcesCount: citedSources.length,
    },
  };

  return bundleToArchiveItem(bundle, index);
}

export async function discoverEraDisasters(params: {
  decade?: string;
  state?: string;
  category?: string;
  limit: number;
}): Promise<EraDisasterSeed[]> {
  const cacheKey = JSON.stringify({
    decade: params.decade || '2020s',
    state: params.state || '',
    category: params.category || '',
    limit: params.limit,
  }).toLowerCase();
  const cached = eraDiscoveryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.events;

  const fallbackSeeds: EraDisasterSeed[] = [
    { eventName: '1999 Odisha Super Cyclone', approxDate: '1999-10-29', location: 'Odisha coast', state: 'Odisha', disasterType: 'Cyclone' },
    { eventName: '1993 Latur earthquake', approxDate: '1993-09-30', location: 'Latur and Osmanabad', state: 'Maharashtra', disasterType: 'Earthquake' },
    { eventName: '1998 Malpa landslide', approxDate: '1998-08-18', location: 'Malpa, Pithoragarh', state: 'Uttarakhand', disasterType: 'Landslide' },
    { eventName: '2001 Gujarat earthquake', approxDate: '2001-01-26', location: 'Bhuj and Kutch', state: 'Gujarat', disasterType: 'Earthquake' },
    { eventName: '2004 Indian Ocean tsunami Tamil Nadu', approxDate: '2004-12-26', location: 'Tamil Nadu coast', state: 'Tamil Nadu', disasterType: 'Tsunami' },
    { eventName: '2008 Bihar Kosi flood', approxDate: '2008-08-18', location: 'Kosi basin', state: 'Bihar', disasterType: 'Flood' },
    { eventName: '2013 Uttarakhand floods', approxDate: '2013-06-16', location: 'Kedarnath and Garhwal', state: 'Uttarakhand', disasterType: 'Flood' },
    { eventName: '2014 Kashmir floods', approxDate: '2014-09-05', location: 'Jammu and Kashmir', state: 'Jammu and Kashmir', disasterType: 'Flood' },
    { eventName: '2018 Kerala floods', approxDate: '2018-08-15', location: 'Kerala', state: 'Kerala', disasterType: 'Flood' },
    { eventName: '2020 Cyclone Amphan', approxDate: '2020-05-20', location: 'West Bengal and Odisha coast', state: 'West Bengal', disasterType: 'Cyclone' },
    { eventName: '2021 Chamoli disaster', approxDate: '2021-02-07', location: 'Chamoli', state: 'Uttarakhand', disasterType: 'Flood' },
    { eventName: '2024 Wayanad landslides', approxDate: '2024-07-30', location: 'Wayanad', state: 'Kerala', disasterType: 'Landslide' },
  ];

  const raw = await generateWithFallback({
    keyScope: 'pastFilters',
    responseMimeType: 'application/json',
    systemInstruction: 'You list only real, verifiable, well-known Indian disaster events. Return strict JSON only. Do not invent events.',
    prompt: `List up to ${Math.min(Math.max(params.limit, 1), 20)} real, notable Indian disaster events matching:
decade: ${params.decade || 'any, prefer 2020s'}
state: ${params.state || 'any'}
category: ${params.category || 'any'}
Return {"events":[{"eventName":"","approxDate":"YYYY-MM-DD or YYYY-MM","location":"","state":"","disasterType":"Cyclone | Flood | Earthquake | Landslide | Heavy Rain | Heat Wave | Tsunami | Avalanche | Forest Fire | Drought | General Alert"}]}.
Prefer high-confidence events with known names and dates.`,
  });

  let discovered: EraDisasterSeed[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(stripCodeFences(raw));
      discovered = Array.isArray(parsed?.events) ? parsed.events
        .map((event: any) => ({
          eventName: String(event.eventName || '').trim(),
          approxDate: String(event.approxDate || '').trim(),
          eventDate: coerceIsoDate(event.approxDate),
          location: String(event.location || '').trim(),
          state: String(event.state || '').trim() || undefined,
          disasterType: (event.disasterType as DisasterCategory) || 'General Alert',
        }))
        .filter((event: EraDisasterSeed) => event.eventName && event.location && event.eventDate) : [];
    } catch (error) {
      console.warn('Era discovery parse failed:', (error as Error).message);
    }
  }

  const decade = params.decade && params.decade !== 'all' ? params.decade : undefined;
  const state = params.state && params.state !== 'All States' ? params.state.toLowerCase() : undefined;
  const category = params.category && params.category !== 'all' ? params.category.toLowerCase() : undefined;
  const deterministic = fallbackSeeds.filter((event) => {
    const year = new Date(coerceIsoDate(event.approxDate) || event.approxDate).getFullYear();
    if (decade) {
      const eventDecade = year < 2000 ? '1990s' : year < 2010 ? '2000s' : year < 2020 ? '2010s' : '2020s';
      if (eventDecade !== decade) return false;
    }
    if (state && !(event.state || '').toLowerCase().includes(state) && !event.location.toLowerCase().includes(state)) return false;
    if (category && !event.disasterType.toLowerCase().includes(category)) return false;
    return true;
  });
  const merged = [...discovered, ...deterministic]
    .filter((event, idx, all) => all.findIndex((candidate) => candidate.eventName.toLowerCase() === event.eventName.toLowerCase()) === idx)
    .slice(0, params.limit);

  eraDiscoveryCache.set(cacheKey, {
    expiresAt: Date.now() + ERA_DISCOVERY_CACHE_TTL_MS,
    events: merged,
  });
  return merged;
}

export async function buildRecentIndiaArchive(limit: number = 100, options?: {
  categoryFilter?: string;
  stateFilter?: string;
  decadeFilter?: string;
}): Promise<HistoricalDisasterItem[]> {
  const cacheKey = JSON.stringify({
    limit,
    categoryFilter: options?.categoryFilter || '',
    stateFilter: options?.stateFilter || '',
    decadeFilter: options?.decadeFilter || '',
  });
  const cached = recentArchiveCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  if (options?.decadeFilter && options.decadeFilter !== 'all') {
    const seeds = await discoverEraDisasters({
      decade: options.decadeFilter,
      state: options.stateFilter,
      category: options.categoryFilter,
      limit,
    });
    const results = await Promise.allSettled(
      seeds.map((seed, index) => buildArchiveEvidenceBundle(`${seed.eventName} ${seed.approxDate}`, index, seed)),
    );
    const sorted = sortArchiveItems(results
      .filter((result): result is PromiseFulfilledResult<HistoricalDisasterItem | null> => result.status === 'fulfilled')
      .map((result) => result.value)
      .filter((item): item is HistoricalDisasterItem => Boolean(item)))
      .slice(0, limit);
    recentArchiveCache.set(cacheKey, { expiresAt: Date.now() + RECENT_ARCHIVE_CACHE_TTL_MS, items: sorted });
    return sorted;
  }

  const queries = buildArchiveQueryPool({ ...options, limit });
  const archive: HistoricalDisasterItem[] = [];
  const seen = new Set<string>();
  const concurrency = 4;

  const matchesFilters = (item: HistoricalDisasterItem) => {
    if (options?.categoryFilter && options.categoryFilter !== 'all') {
      const category = options.categoryFilter.toLowerCase();
      const matchesCategory = item.disasterType.toLowerCase().includes(category) ||
        (category === 'landslide' && item.disasterType.toLowerCase().includes('avalanche'));
      if (!matchesCategory) return false;
    }
    if (options?.stateFilter && options.stateFilter !== 'All States') {
      const state = options.stateFilter.toLowerCase();
      if (!item.state.toLowerCase().includes(state) && !item.location.toLowerCase().includes(state)) return false;
    }
    if (options?.decadeFilter && options.decadeFilter !== 'all' && item.decade !== options.decadeFilter) {
      return false;
    }
    return true;
  };

  for (let i = 0; i < queries.length && archive.length < limit; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((query, offset) => buildArchiveEvidenceBundle(query, i + offset))
    );

    for (const result of batchResults) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const item = result.value;
      if (!matchesFilters(item)) continue;
      const dedupeKey = `${item.eventName.toLowerCase()}|${item.state.toLowerCase()}|${item.dateRange.toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      archive.push(item);
      if (archive.length >= limit) break;
    }

    if (archive.length >= limit) break;
  }

  const sorted = sortArchiveItems(archive).slice(0, limit);

  recentArchiveCache.set(cacheKey, {
    expiresAt: Date.now() + RECENT_ARCHIVE_CACHE_TTL_MS,
    items: sorted,
  });
  return sorted;
}

type ArchiveFilterOptions = {
  categoryFilter?: string;
  stateFilter?: string;
  decadeFilter?: string;
};

async function buildFilterSearchPlan(options: ArchiveFilterOptions, limit: number): Promise<string[]> {
  const filterSummary = [
    options.categoryFilter && options.categoryFilter !== 'all' ? `hazard: ${options.categoryFilter}` : '',
    options.stateFilter && options.stateFilter !== 'All States' ? `state: ${options.stateFilter}` : '',
    options.decadeFilter && options.decadeFilter !== 'all' ? `era: ${options.decadeFilter}` : '',
  ].filter(Boolean).join('; ') || 'all Indian disasters';

  const planned = await generateWithFallback({
    keyScope: 'pastFilters',
    responseMimeType: 'application/json',
    systemInstruction: 'You plan evidence searches for Indian disaster research. Return only JSON. Every query must target India and the requested filter. Do not invent events or facts.',
    prompt: `Create up to ${Math.min(Math.max(limit, 10), 40)} concise Google News search queries for this filter: ${filterSummary}.
Return exactly {"queries":["..."]}. Use specific Indian states, hazards, districts, or documented event names when helpful. For an era, include the era years in the queries.`,
  });

  let plannedQueries: string[] = [];
  if (planned) {
    try {
      const parsed = JSON.parse(stripCodeFences(planned));
      plannedQueries = Array.isArray(parsed?.queries)
        ? parsed.queries.filter((query: unknown): query is string => typeof query === 'string')
        : [];
    } catch (error) {
      console.warn('Filter search plan parse failed:', (error as Error).message);
    }
  }

  const generated = plannedQueries
    .map((query) => query.replace(/\s+/g, ' ').trim())
    .filter((query) => query.length >= 8 && /india/i.test(query))
    .slice(0, 40);
  const deterministicQueries = buildArchiveQueryPool({ ...options, limit });
  return Array.from(new Set([...generated, ...deterministicQueries]));
}

export async function buildFilteredIndiaArchive(
  limit: number = 100,
  options: ArchiveFilterOptions = {},
): Promise<HistoricalDisasterItem[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit) || 100, 1), 100);
  const cacheKey = `filter:${JSON.stringify({
    limit: safeLimit,
    categoryFilter: options.categoryFilter || '',
    stateFilter: options.stateFilter || '',
    decadeFilter: options.decadeFilter || '',
  })}`;
  const cached = recentArchiveCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const seeds = options.decadeFilter && options.decadeFilter !== 'all'
    ? await discoverEraDisasters({
        decade: options.decadeFilter,
        state: options.stateFilter,
        category: options.categoryFilter,
        limit: safeLimit,
      })
    : [];
  const queries = seeds.length
    ? seeds.map((seed) => `${seed.eventName} ${seed.approxDate}`)
    : await buildFilterSearchPlan(options, safeLimit);
  const archive: HistoricalDisasterItem[] = [];
  const seen = new Set<string>();
  const concurrency = 4;

  const matchesFilters = (item: HistoricalDisasterItem) => {
    if (options.categoryFilter && options.categoryFilter !== 'all') {
      const category = options.categoryFilter.toLowerCase();
      const matchesCategory = item.disasterType.toLowerCase().includes(category) ||
        (category === 'landslide' && item.disasterType.toLowerCase().includes('avalanche'));
      if (!matchesCategory) return false;
    }
    if (options.stateFilter && options.stateFilter !== 'All States') {
      const state = options.stateFilter.toLowerCase();
      const itemState = item.state.toLowerCase();
      const stateMatches = itemState === state || itemState.includes(state) ||
        (itemState === 'india' && item.location.toLowerCase().includes(state));
      if (!stateMatches) return false;
    }
    if (options.decadeFilter && options.decadeFilter !== 'all' && item.decade !== options.decadeFilter) {
      return false;
    }
    return true;
  };

  for (let i = 0; i < queries.length && archive.length < safeLimit; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((query, offset) => buildArchiveEvidenceBundle(query, i + offset, seeds[i + offset])),
    );

    for (const result of batchResults) {
      if (result.status !== 'fulfilled' || !result.value || !matchesFilters(result.value)) continue;
      const item = result.value;
      const dedupeKey = `${item.eventName.toLowerCase()}|${item.state.toLowerCase()}|${item.dateRange.toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      archive.push(item);
      if (archive.length >= safeLimit) break;
    }
  }

  const sorted = sortArchiveItems(archive).slice(0, safeLimit);
  recentArchiveCache.set(cacheKey, {
    expiresAt: Date.now() + RECENT_ARCHIVE_CACHE_TTL_MS,
    items: sorted,
  });
  return sorted;
}

export function warmRecentIndiaArchive(limit: number = 100): void {
  if (recentArchiveWarmupStarted) {
    return;
  }

  recentArchiveWarmupStarted = true;
  void buildRecentIndiaArchive(limit).catch((error) => {
    recentArchiveWarmupStarted = false;
    console.warn('Archive warmup failed:', (error as Error).message);
  });
}

function buildDeterministicFallbackSynthesis(query: string, sources: CitedSource[]) {
  const qLower = query.toLowerCase();
  let type: DisasterCategory = 'General Alert';
  if (qLower.includes('cyclon') || qLower.includes('fani') || qLower.includes('amphan')) type = 'Cyclone';
  else if (qLower.includes('flood') || qLower.includes('kerala')) type = 'Flood';
  else if (qLower.includes('earthquake')) type = 'Earthquake';
  else if (qLower.includes('landslide')) type = 'Landslide';

  const s1 = sources[0] ? `[${sources[0].id}]` : '';
  const s2 = sources[1] ? `[${sources[1].id}]` : s1;

  return {
    eventName: query,
    disasterType: type,
    location: 'India',
    state: 'India',
    country: 'India',
    dateRange: 'Historical Record',
    reportedCasualties: `Casualties recorded in official state bulletins ${s1}.`,
    reportedDamage: `Large scale infrastructure disruption documented ${s2}.`,
    whatHappened: sources.map((s) => `${s.summary} [${s.id}]`).join(' '),
    affectedAreas: `Districts specified in retrieved coverage ${s1}.`,
    humanImpact: `Evacuation and relief measures mobilized across shelters ${s1}.`,
    infrastructureDamage: `Telecommunications, road connectivity, and power transmission line damages ${s2}.`,
    economicImpact: `Economic assessment conducted by respective state disaster management departments ${s1}.`,
    governmentResponse: `NDMA and SDRF pre-positioned personnel in vulnerable zones ${s1}.`,
    rescueRelief: `Distribution of relief supplies, clean drinking water, and medical aid ${s2}.`,
    recovery: `Restoration of utility services and rehabilitation programs ${s1}.`,
    sourceAssessment: `Synthesized from ${sources.length} indexed media reports.`,
    conflictingReports: [],
    timeline: sources.map((s, i) => ({
      date: `Phase ${i + 1}`,
      event: s.title.slice(0, 40) + '...',
      description: `${s.summary} [${s.id}]`,
      citations: [s.id],
    })),
  };
}

export async function compareDisasterEvents(bundles: EvidenceBundle[]): Promise<{
  comparisonPoints: { category: string; label: string; values: { eventId: string; value: string; citations: string[] }[] }[];
  aiSynthesis: { broaderImpact: string; responseDifferences: string; crossEventLessons: string; citations: string[] };
}> {
  const comparisonPoints = [
    {
      category: 'Overview',
      label: 'Disaster Type & Location',
      values: bundles.map((b) => ({
        eventId: b.id,
        value: `${b.disasterType} in ${b.location}, ${b.state} (${b.dateRange})`,
        citations: b.sources.slice(0, 1).map((s: CitedSource) => s.id),
      })),
    },
    {
      category: 'Human Impact',
      label: 'Casualties & Evacuation',
      values: bundles.map((b) => ({
        eventId: b.id,
        value: b.reportedCasualties || b.humanImpact.slice(0, 150),
        citations: b.sources.slice(0, 2).map((s: CitedSource) => s.id),
      })),
    },
    {
      category: 'Damage',
      label: 'Infrastructure & Economic Loss',
      values: bundles.map((b) => ({
        eventId: b.id,
        value: b.reportedDamage || b.infrastructureDamage.slice(0, 150),
        citations: b.sources.slice(0, 2).map((s: CitedSource) => s.id),
      })),
    },
    {
      category: 'Response',
      label: 'Government & Relief Response',
      values: bundles.map((b) => ({
        eventId: b.id,
        value: b.governmentResponse.slice(0, 150) || 'State Disaster Management response',
        citations: b.sources.slice(0, 1).map((s: CitedSource) => s.id),
      })),
    },
  ];

  const prompt = `Compare the following ${bundles.length} historical disaster events based solely on their evidence:
${bundles
  .map(
    (b, i) =>
      `Event ${i + 1}: ${b.eventName} (${b.disasterType}, ${b.location})\n` +
      `Impact: ${b.humanImpact}\nDamage: ${b.infrastructureDamage}\nResponse: ${b.governmentResponse}\nSources: ${b.sources.map((s: CitedSource) => `[${s.id}] ${s.title}`).join(', ')}`,
  )
  .join('\n\n')}

Analyze:
1. Which event had broader human/infrastructure impact?
2. How did government and rescue responses differ?
3. What key disaster preparedness lessons emerge across these events?
When sources disagree on a numeric fact, prefer a range if the values are tightly clustered and call out outliers separately.
Return JSON:
{
  "broaderImpact": "text with citations like [S1]",
  "responseDifferences": "text with citations",
  "crossEventLessons": "text with citations"
}`;

  let aiSynthesis = {
    broaderImpact: `Comparative impact analysis between ${bundles.map((b) => b.eventName).join(' and ')}.`,
    responseDifferences: `Early warning dissemination and evacuation preparedness differed based on lead time and terrain.`,
    crossEventLessons: `Key lessons include robust shelter networks, redundant communications, and staged evacuation planning.`,
    citations: bundles.flatMap((b) => b.sources.slice(0, 1).map((s: CitedSource) => s.id)),
  };

  try {
    const raw = await generateWithFallback({
      prompt,
      responseMimeType: 'application/json',
      systemInstruction: 'You are an objective disaster risk comparison analyst. Reference sources like [S1], [S2].',
      keyScope: 'past',
    });

    if (raw) {
      const parsed = JSON.parse(stripCodeFences(raw));
      const allSources = bundles.flatMap((b) => b.sources);
      aiSynthesis = {
        broaderImpact: validateAndCleanCitations(parsed.broaderImpact || aiSynthesis.broaderImpact, allSources),
        responseDifferences: validateAndCleanCitations(parsed.responseDifferences || aiSynthesis.responseDifferences, allSources),
        crossEventLessons: validateAndCleanCitations(parsed.crossEventLessons || aiSynthesis.crossEventLessons, allSources),
        citations: allSources.slice(0, 4).map((s: CitedSource) => s.id),
      };
    }
  } catch (error) {
    console.log('Groq comparison synthesis fallback:', (error as Error).message);
  }

  return { comparisonPoints, aiSynthesis };
}

export async function chatResearchAssistant(params: {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  targetLanguage?: string;
  associatedBundle?: EvidenceBundle | null;
}): Promise<{
  reply: string;
  sources: CitedSource[];
}> {
  const { message, history, targetLanguage = 'en', associatedBundle } = params;
  const englishMessage = await translateText(message, 'en');

  let evidenceSources: CitedSource[] = [];
  let contextText = '';

  if (associatedBundle) {
    evidenceSources = associatedBundle.sources;
    contextText = `Associated Event: ${associatedBundle.eventName} (${associatedBundle.disasterType}, ${associatedBundle.location})\n` +
      `Summary: ${associatedBundle.whatHappened}\nImpact: ${associatedBundle.humanImpact}\nDamage: ${associatedBundle.infrastructureDamage}\n` +
      `Sources:\n` +
      evidenceSources.map((s: CitedSource) => `[${s.id}] ${s.title} (${s.publisher}): ${s.summary}`).join('\n');
  } else {
    let articles = await searchGoogleNews(englishMessage, { isCurrentNews: false, maxResults: 4 });
    if (!articles.length) {
      const normalizedQuery = await normalizeDisasterSearchQuery(englishMessage);
      if (normalizedQuery) {
        articles = await searchGoogleNews(normalizedQuery, { isCurrentNews: false, maxResults: 4 });
      }
    }
    evidenceSources = articles.map((art, idx) => ({
      id: `S${idx + 1}`,
      title: art.title,
      publisher: art.publisher,
      publishedAt: art.publishedAt,
      url: art.url,
      summary: art.summary,
    }));
    contextText = `Retrieved Evidence Sources:\n` +
      evidenceSources.map((s: CitedSource) => `[${s.id}] ${s.title} (${s.publisher}): ${s.summary}`).join('\n');
  }

  const langInstruction =
    targetLanguage && targetLanguage !== 'en'
      ? `Respond fluently and naturally in the requested language code "${targetLanguage}" using accurate native script. Maintain all citation markers like [S1], [S2] intact.`
      : `Respond in clear, professional English.`;

  const systemInstruction = `You are the Lead Historical Disaster Intelligence Research Assistant.
Your goal is to answer queries strictly grounded in retrieved evidence.
RULES:
1. Support factual claims with citations [S1], [S2], etc.
2. If facts are not in the sources, say "Information unavailable in the retrieved sources."
3. Check spelling and grammar before responding. Output only clean professional text in the requested language.
4. Use concise Markdown: short paragraphs and bullet lists. Use tables only for truly tabular comparisons.
5. Do not emit raw HTML entities such as &nbsp;.
6. Avoid boilerplate disclaimers unless the evidence is genuinely missing.
7. ${langInstruction}`;

  const prompt = `Conversation Context:
${history.slice(-4).map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n')}

Evidence Documents:
${contextText}

User Question: "${message}"

Provide a professional, cited research answer:`;

  let reply: string = (await generateWithFallback({
    prompt,
    systemInstruction,
    keyScope: 'chat',
  })) || '';

  if (!reply) {
    reply = evidenceSources.length > 0
      ? `Based on retrieved historical records:\n\n` +
        evidenceSources.map((s) => `* **${s.title}** (${s.publisher}): ${s.summary} [${s.id}]`).join('\n\n')
      : `Information unavailable in the retrieved sources for this query.`;
  }

  reply = sanitizeGeneratedReply(validateAndCleanCitations(reply, evidenceSources));
  reply = await translatePreservingCitations(reply, targetLanguage);
  reply = sanitizeGeneratedReply(reply);

  return {
    reply,
    sources: evidenceSources,
  };
}

export async function localizeEvidenceBundle(bundle: EvidenceBundle, targetLanguage?: string): Promise<EvidenceBundle> {
  const lang = normalizeLang(targetLanguage);
  if (lang === 'en') return bundle;

  const translatedSources = await Promise.all(
    bundle.sources.map(async (source) => ({
      ...source,
      title: await translateText(source.title, lang),
      summary: await translateText(source.summary, lang),
      keyFacts: source.keyFacts ? await translateArray(source.keyFacts, lang) : source.keyFacts,
    })),
  );

  const translatedTimeline = await Promise.all(
    bundle.timeline.map(async (step) => ({
      ...step,
      event: await translateText(step.event, lang),
      description: await translateText(step.description, lang),
    })),
  );

  const translatedConflicts = await Promise.all(
    bundle.conflictingReports.map(async (conflict) => ({
      ...conflict,
      topic: await translateText(conflict.topic, lang),
      details: await translateText(conflict.details, lang),
    })),
  );

  return {
    ...bundle,
    eventName: await translateText(bundle.eventName, lang),
    location: await translateText(bundle.location, lang),
    state: await translateText(bundle.state, lang),
    dateRange: await translateText(bundle.dateRange, lang),
    reportedCasualties: await translateText(bundle.reportedCasualties, lang),
    reportedDamage: await translateText(bundle.reportedDamage, lang),
    whatHappened: await translateText(bundle.whatHappened, lang),
    affectedAreas: await translateText(bundle.affectedAreas, lang),
    humanImpact: await translateText(bundle.humanImpact, lang),
    infrastructureDamage: await translateText(bundle.infrastructureDamage, lang),
    economicImpact: await translateText(bundle.economicImpact, lang),
    governmentResponse: await translateText(bundle.governmentResponse, lang),
    rescueRelief: await translateText(bundle.rescueRelief, lang),
    recovery: await translateText(bundle.recovery, lang),
    sourceAssessment: await translateText(bundle.sourceAssessment, lang),
    sources: translatedSources,
    timeline: translatedTimeline,
    conflictingReports: translatedConflicts,
  };
}

export async function generateTTSAudio(text: string, voiceName: string = getGroqTtsVoice()): Promise<string | null> {
  const apiKey = getGroqKey('tts');
  const baseUrl = getGroqBaseUrl();
  const ttsModel = getGroqTtsModel();
  const cleanText = stripMarkdownForSpeech(text).replace(/\[S\d+\]/gi, '').slice(0, 500);

  try {
    const response = await fetch(`${baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ttsModel,
        input: cleanText,
        voice: voiceName || getGroqTtsVoice(),
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Groq TTS failed: HTTP ${response.status} ${text}`.trim());
    }

    const audioBuffer = await response.arrayBuffer();
    return toBase64(audioBuffer);
  } catch (error) {
    console.log('Groq TTS fallback:', (error as Error).message);
    return null;
  }
}

