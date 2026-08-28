the import {
  EvidenceBundle,
  CitedSource,
  TimelineEvent,
  ConflictingReport,
  NewsArticle,
  DisasterCategory,
} from './types/disaster';
import type { HistoricalDisasterItem } from './data/historicalDisasters';
import {
  deduplicateNewsArticles,
  extractCasualtyNumericClaims,
  filterIncidentEvidenceArticles,
  filterSourcesForEvent,
  reconcileNumericClaims,
  scoreIncidentEvidence,
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

export type NormalizedHistoricalEvent = {
  originalQuery: string;
  normalizedQuery: string;
  aliases: string[];
  disasterType?: DisasterCategory;
  location?: string;
  state?: string;
  year?: number;
  eventDate?: string;
  confidence: number;
};

type EvidenceCoverage = {
  eventConfirmed: boolean;
  eventNameConfidence: number;
  relevantSourceCount: number;
  distinctPublisherCount: number;
  overview: boolean;
  eventDate: boolean;
  location: boolean;
  affectedAreas: boolean;
  casualtyData: boolean;
  injuryData: boolean;
  displacementData: boolean;
  infrastructureDamage: boolean;
  economicImpact: boolean;
  governmentResponse: boolean;
  rescueRelief: boolean;
  recovery: boolean;
  meaningfulTimelineEntries: number;
  sourceRelevanceScore: number;
  evidenceDepthScore: number;
  overallQualityScore: number;
  qualifies: boolean;
};

const NORMALIZATION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bgujrat\b/gi, 'Gujarat'],
  [/\bgujarath\b/gi, 'Gujarat'],
  [/\bgujrath\b/gi, 'Gujarat'],
  [/\bearthqake\b/gi, 'earthquake'],
  [/\bearthquak\b/gi, 'earthquake'],
  [/\berthquake\b/gi, 'earthquake'],
  [/\bwaynad\b/gi, 'Wayanad'],
  [/\bwayanad landslides\b/gi, 'Wayanad landslide'],
  [/\bamfan\b/gi, 'Cyclone Amphan'],
  [/\bamphan cyclone\b/gi, 'Cyclone Amphan'],
  [/\buttrakahand\b/gi, 'Uttarakhand'],
  [/\buttrakhand\b/gi, 'Uttarakhand'],
  [/\borrisa\b/gi, 'Odisha'],
  [/\borissa\b/gi, 'Odisha'],
  [/\bkutch quake\b/gi, 'Bhuj earthquake'],
  [/\bbhuj quake\b/gi, 'Bhuj earthquake'],
];

const KNOWN_EVENT_ALIASES: Array<{
  match: RegExp;
  event: Omit<NormalizedHistoricalEvent, 'originalQuery'>;
}> = [
    {
      match: /\b(2001\s+)?(gujarat|bhuj|kutch).*(earthquake|quake)|\b(republic day earthquake)\b/i,
      event: {
        normalizedQuery: '2001 Gujarat earthquake',
        aliases: ['Bhuj earthquake', 'Kutch earthquake', 'Republic Day earthquake Gujarat 2001'],
        disasterType: 'Earthquake',
        location: 'Bhuj and Kutch',
        state: 'Gujarat',
        year: 2001,
        eventDate: '2001-01-26T00:00:00.000Z',
        confidence: 0.96,
      },
    },
    {
      match: /\b(amphan|amfan)\b/i,
      event: {
        normalizedQuery: 'Cyclone Amphan',
        aliases: ['2020 Cyclone Amphan', 'Amphan West Bengal cyclone'],
        disasterType: 'Cyclone',
        location: 'West Bengal and Odisha coast',
        state: 'West Bengal',
        year: 2020,
        eventDate: '2020-05-20T00:00:00.000Z',
        confidence: 0.95,
      },
    },
    {
      match: /\b(wayanad|waynad).*(landslide|landslides)\b/i,
      event: {
        normalizedQuery: '2024 Wayanad landslide',
        aliases: ['Wayanad landslides', 'Chooralmala Mundakkai landslide'],
        disasterType: 'Landslide',
        location: 'Wayanad',
        state: 'Kerala',
        year: 2024,
        eventDate: '2024-07-30T00:00:00.000Z',
        confidence: 0.94,
      },
    },
    {
      match: /\b(1999\s+)?(odisha|orissa).*(super cyclone|cyclone)\b/i,
      event: {
        normalizedQuery: '1999 Odisha Super Cyclone',
        aliases: ['1999 Orissa cyclone', 'Odisha super cyclone'],
        disasterType: 'Cyclone',
        location: 'Odisha coast',
        state: 'Odisha',
        year: 1999,
        eventDate: '1999-10-29T00:00:00.000Z',
        confidence: 0.94,
      },
    },
    {
      match: /\b(2018\s+)?kerala.*flood/i,
      event: {
        normalizedQuery: '2018 Kerala floods',
        aliases: ['Kerala floods 2018'],
        disasterType: 'Flood',
        location: 'Kerala',
        state: 'Kerala',
        year: 2018,
        eventDate: '2018-08-15T00:00:00.000Z',
        confidence: 0.9,
      },
    },
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
  if (lower.includes('earthquake') || lower.includes('quake') || lower.includes('seismic') || lower.includes('tremor')) return 'Earthquake';
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
  const textField = (key: keyof typeof fallback) =>
    typeof data[key] === 'string' && hasMeaningfulText(data[key]) ? cleanEvidenceText(data[key]) : fallback[key];
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
    reportedCasualties: textField('reportedCasualties'),
    reportedDamage: textField('reportedDamage'),
    whatHappened: textField('whatHappened'),
    affectedAreas: textField('affectedAreas'),
    humanImpact: textField('humanImpact'),
    infrastructureDamage: textField('infrastructureDamage'),
    economicImpact: textField('economicImpact'),
    governmentResponse: textField('governmentResponse'),
    rescueRelief: textField('rescueRelief'),
    recovery: textField('recovery'),
    sourceAssessment: textField('sourceAssessment'),
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

function cleanEvidenceText(value?: string): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyDeterministicNormalization(query: string): string {
  return NORMALIZATION_REPLACEMENTS.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    query.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim(),
  ).replace(/\s+/g, ' ').trim();
}

export function normalizeHistoricalEventQuery(query: string): NormalizedHistoricalEvent {
  const originalQuery = query.trim();
  const corrected = applyDeterministicNormalization(originalQuery);
  for (const alias of KNOWN_EVENT_ALIASES) {
    if (alias.match.test(corrected)) {
      return { originalQuery, ...alias.event };
    }
  }

  const year = corrected.match(/\b(19\d\d|20\d\d)\b/)?.[0];
  const disasterType = inferDisasterType(corrected);
  const state = inferState(corrected);
  const normalizedQuery = corrected
    .replace(/\bfloods\b/gi, 'flood')
    .replace(/\blandslides\b/gi, 'landslide')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    originalQuery,
    normalizedQuery,
    aliases: normalizedQuery.toLowerCase() === originalQuery.toLowerCase() ? [] : [originalQuery],
    disasterType,
    location: inferLocation(normalizedQuery, state),
    state,
    year: year ? Number(year) : undefined,
    eventDate: coerceIsoDate(normalizedQuery),
    confidence: normalizedQuery === originalQuery ? 0.72 : 0.84,
  };
}

function buildHistoricalResearchQueries(event: NormalizedHistoricalEvent, categoryFilter?: string, stateFilter?: string): string[] {
  const base = event.normalizedQuery || event.originalQuery;
  const location = stateFilter || event.state || event.location || '';
  const type = categoryFilter || event.disasterType || '';
  const year = event.year ? String(event.year) : '';
  const aliases = [base, ...event.aliases].filter(Boolean);
  const dimensions = [
    '',
    'India',
    'what happened history impact',
    'casualties deaths injured missing',
    'affected districts villages towns',
    'houses damaged infrastructure roads bridges power',
    'economic loss damage estimate',
    'rescue relief evacuation government response',
    'timeline aftermath recovery reconstruction',
    'official report',
  ];

  const queries = aliases.flatMap((alias) =>
    dimensions.map((dimension) => [alias, year && !alias.includes(year) ? year : '', location, type, dimension]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()),
  );

  return Array.from(new Set(queries)).slice(0, 18);
}

function publisherKey(source: Pick<CitedSource, 'publisher'>): string {
  return source.publisher.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() || 'unknown';
}

function hasMeaningfulText(value?: string | null): boolean {
  if (!value) return false;
  const normalized = cleanEvidenceText(value).toLowerCase();
  if (normalized.length < 24) return false;
  const placeholders = [
    'information unavailable',
    'no information available',
    'details were not clearly quantified',
    'details were referenced',
    'were referenced in the retrieved source coverage',
    'were summarized in the retrieved source coverage',
    'requires external archival corroboration',
    'documented in source coverage',
    'documented in cited journalism',
    'state disaster management authority and ndrf mobilization recorded',
    'shelter operations, dry food packets, and medical deployment',
    'long-term rehabilitation and infrastructure reconstruction initiatives',
  ];
  if (placeholders.some((phrase) => normalized.includes(phrase))) return false;
  return /[a-z]/i.test(normalized.replace(/\[S\d+\]/gi, ''));
}

function extractBestFact(sources: CitedSource[], topic: keyof ReturnType<typeof extractCandidateFacts>, fallback = ''): string {
  const facts = extractCandidateFacts(sources)[topic] || [];
  return facts.length ? facts.slice(0, 3).join('; ') + '.' : fallback;
}

function hasSubstantiveImpactText(text: string): boolean {
  return /\b(killed|dead|deaths?|injured|missing|displaced|evacuat|affected|damage|destroyed|collapsed|washed away|crore|lakh|houses?|roads?|bridges?|power|relief|rescue|shelter|recovery|reconstruction)\b/i.test(text);
}

function buildEvidenceCoverage(bundle: Pick<EvidenceBundle,
  'eventName' | 'eventDate' | 'dateRange' | 'location' | 'state' | 'sources' | 'whatHappened' |
  'affectedAreas' | 'reportedCasualties' | 'humanImpact' | 'reportedDamage' | 'infrastructureDamage' |
  'economicImpact' | 'governmentResponse' | 'rescueRelief' | 'recovery' | 'timeline'
>): EvidenceCoverage {
  const sourceText = bundle.sources.map((s) => `${s.title} ${s.summary}`).join(' ');
  const distinctPublisherCount = new Set(bundle.sources.map(publisherKey)).size;
  const eventConfirmed = bundle.sources.some((source) => scoreIncidentEvidence(source) >= 2);
  const casualtyData = hasMeaningfulText(bundle.reportedCasualties) || /killed|dead|death|fatalit|injured|missing/i.test(sourceText);
  const infrastructureDamage = hasMeaningfulText(bundle.infrastructureDamage) || /damage|destroyed|collapsed|washed away|houses?|roads?|bridges?|power|infrastructure/i.test(sourceText);
  const economicImpact = hasMeaningfulText(bundle.economicImpact) || /(?:rs\.?|inr|crore|lakh|economic|loss|crop|agriculture)/i.test(sourceText);
  const governmentResponse = hasMeaningfulText(bundle.governmentResponse) || /\bgovernment|ndrf|sdrf|army|navy|administration|evacuat/i.test(sourceText);
  const rescueRelief = hasMeaningfulText(bundle.rescueRelief) || /\brescue|relief|shelter|food|medicine|camp/i.test(sourceText);
  const recovery = hasMeaningfulText(bundle.recovery) || /\brecovery|reconstruction|rehabilitation|restoration|aftermath/i.test(sourceText);
  const meaningfulTimelineEntries = (bundle.timeline || []).filter((step) =>
    hasMeaningfulText(step.event) &&
    hasMeaningfulText(step.description) &&
    !/published|article|source|headline/i.test(`${step.event} ${step.description}`),
  ).length;
  const impactDimensions = [
    casualtyData,
    infrastructureDamage,
    economicImpact,
    governmentResponse,
    rescueRelief,
    recovery,
    hasMeaningfulText(bundle.affectedAreas),
  ].filter(Boolean).length;
  const sourceRelevanceScore = bundle.sources.length
    ? bundle.sources.reduce((sum, source) => sum + scoreIncidentEvidence(source), 0) / bundle.sources.length
    : 0;
  const evidenceDepthScore = impactDimensions + meaningfulTimelineEntries + (hasMeaningfulText(bundle.whatHappened) ? 1 : 0);
  const overallQualityScore = sourceRelevanceScore + evidenceDepthScore + Math.min(distinctPublisherCount, 3);
  const qualifies =
    eventConfirmed &&
    Boolean(bundle.eventDate || /\b(19\d\d|20\d\d)\b/.test(bundle.dateRange || bundle.eventName)) &&
    bundle.location !== 'India' &&
    hasMeaningfulText(bundle.whatHappened) &&
    impactDimensions >= 1 &&
    meaningfulTimelineEntries >= 1 &&
    (bundle.sources.length >= 2 || (bundle.sources.length === 1 && sourceRelevanceScore >= 4 && impactDimensions >= 2));

  return {
    eventConfirmed,
    eventNameConfidence: eventConfirmed ? 0.85 : 0.25,
    relevantSourceCount: bundle.sources.length,
    distinctPublisherCount,
    overview: hasMeaningfulText(bundle.whatHappened),
    eventDate: Boolean(bundle.eventDate || /\b(19\d\d|20\d\d)\b/.test(bundle.dateRange || bundle.eventName)),
    location: bundle.location !== 'India',
    affectedAreas: hasMeaningfulText(bundle.affectedAreas),
    casualtyData,
    injuryData: /\binjur/i.test(`${bundle.reportedCasualties} ${bundle.humanImpact} ${sourceText}`),
    displacementData: /\bdisplaced|evacuat/i.test(`${bundle.humanImpact} ${sourceText}`),
    infrastructureDamage,
    economicImpact,
    governmentResponse,
    rescueRelief,
    recovery,
    meaningfulTimelineEntries,
    sourceRelevanceScore,
    evidenceDepthScore,
    overallQualityScore,
    qualifies,
  };
}

function evidenceStatusFromCoverage(coverage: EvidenceCoverage): EvidenceBundle['evidenceStatus'] {
  if (
    coverage.qualifies &&
    coverage.relevantSourceCount >= 4 &&
    coverage.distinctPublisherCount >= 3 &&
    coverage.meaningfulTimelineEntries >= 2 &&
    coverage.evidenceDepthScore >= 5
  ) return 'High Confidence';
  if (coverage.qualifies && coverage.relevantSourceCount >= 2 && coverage.distinctPublisherCount >= 2) return 'Moderate Evidence';
  return 'Limited Coverage';
}

function makeEvidenceTimeline(sources: CitedSource[], eventDate?: string): TimelineEvent[] {
  const datePattern = /\b(?:\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(?:19|20)\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+(?:19|20)\d{2}|\d{4}-\d{2}-\d{2})\b/gi;
  const steps: TimelineEvent[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    const text = cleanEvidenceText(`${source.title}. ${source.summary}`);
    const dates = Array.from(text.matchAll(datePattern)).map((match) => match[0]);
    const selectedDate = dates[0] || (eventDate ? formatDisasterDate(eventDate) : '');
    if (!selectedDate) continue;
    const sentence = text.split(/(?<=[.!?])\s+/).find((part) => part.includes(dates[0] || '')) || text;
    const title = sentence.slice(0, 72).replace(/\s+\S*$/, '').trim() || source.title;
    const key = `${selectedDate}|${title.toLowerCase()}`;
    if (seen.has(key) || /published|article/i.test(sentence)) continue;
    seen.add(key);
    steps.push({
      date: selectedDate,
      event: title,
      description: `${sentence} [${source.id}]`,
      citations: [source.id],
    });
  }
  if (!steps.length && eventDate && sources[0]) {
    steps.push({
      date: formatDisasterDate(eventDate),
      event: 'Documented disaster occurrence',
      description: `${cleanEvidenceText(sources[0].summary || sources[0].title)} [${sources[0].id}]`,
      citations: [sources[0].id],
    });
  }
  return steps.slice(0, 6);
}

export async function buildHistoricalEvidenceBundle(
  userQuery: string,
  categoryFilter?: string,
  stateFilter?: string,
): Promise<EvidenceBundle> {
  const baseQuery = userQuery.trim();
  let normalizedEvent = normalizeHistoricalEventQuery(baseQuery);
  const cacheKey = JSON.stringify({
    baseQuery: baseQuery.toLowerCase(),
    normalizedQuery: normalizedEvent.normalizedQuery.toLowerCase(),
    categoryFilter: categoryFilter || '',
    stateFilter: stateFilter || '',
  });

  const cached = evidenceBundleCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.bundle;
  }

  let searchQueries = buildHistoricalResearchQueries(normalizedEvent, categoryFilter, stateFilter);

  const allArticles: NewsArticle[] = [];
  for (const q of searchQueries) {
    const res = await searchGoogleNews(q, { isCurrentNews: false, maxResults: 6 });
    allArticles.push(...res);
  }
  let eventFilterQuery = normalizedEvent.normalizedQuery;

  if (allArticles.length < 2) {
    const normalizedQuery = await normalizeDisasterSearchQuery(baseQuery);
    if (normalizedQuery) {
      normalizedEvent = normalizeHistoricalEventQuery(normalizedQuery);
      eventFilterQuery = normalizedQuery;
      const expandedQueries = buildHistoricalResearchQueries(normalizedEvent, categoryFilter, stateFilter);
      searchQueries = Array.from(new Set([...searchQueries, ...expandedQueries]));
      for (const q of expandedQueries) {
        const res = await searchGoogleNews(q, { isCurrentNews: false, maxResults: 6 });
        allArticles.push(...res);
      }
    }
  }

  const incidentArticles = filterIncidentEvidenceArticles(deduplicateNewsArticles(allArticles));
  let sourcesList = filterSourcesForEvent(incidentArticles, {
    eventName: eventFilterQuery,
    disasterType: categoryFilter || normalizedEvent.disasterType || inferDisasterType(baseQuery),
    state: stateFilter || normalizedEvent.state || inferState(baseQuery),
    approxDate: normalizedEvent.eventDate || String(normalizedEvent.year || eventFilterQuery),
  })
    .sort((a, b) => scoreIncidentEvidence(b) - scoreIncidentEvidence(a))
    .slice(0, 10);
  if (!sourcesList.length) {
    const normalizedQuery = await normalizeDisasterSearchQuery(baseQuery);
    if (normalizedQuery) {
      normalizedEvent = normalizeHistoricalEventQuery(normalizedQuery);
      eventFilterQuery = normalizedEvent.normalizedQuery;
      const correctedArticles: NewsArticle[] = [];
      const correctedQueries = buildHistoricalResearchQueries(normalizedEvent, categoryFilter, stateFilter);
      for (const q of correctedQueries) {
        const res = await searchGoogleNews(q, { isCurrentNews: false, maxResults: 6 });
        correctedArticles.push(...res);
      }
      searchQueries = Array.from(new Set([...searchQueries, ...correctedQueries]));
      sourcesList = filterSourcesForEvent(filterIncidentEvidenceArticles(correctedArticles), {
        eventName: normalizedEvent.normalizedQuery,
        disasterType: categoryFilter || normalizedEvent.disasterType || inferDisasterType(normalizedQuery),
        state: stateFilter || normalizedEvent.state || inferState(normalizedQuery),
        approxDate: normalizedEvent.eventDate || String(normalizedEvent.year || normalizedQuery),
      }).slice(0, 10);
    }
  }
  if (!sourcesList.length) {
    throw new Error('No live Google News sources were found for this query.');
  }

  const citedSources: CitedSource[] = sourcesList.map((art, idx) => ({
    id: `S${idx + 1}`,
    title: cleanEvidenceText(art.title),
    publisher: art.publisher,
    publishedAt: art.publishedAt,
    url: art.url,
    summary: cleanEvidenceText(art.summary),
    qualityScore: Math.max(20, 95 - idx * 4),
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
3. If information is not provided in the sources, return an empty string for that field.
4. If sources conflict on numbers/facts, prefer a compact range when the values cluster closely (for example, 23-25). If one value is a clear outlier, do not merge it into the range; report it separately in conflictingReports and explain the likely reason for the spread.
5. Do not use article publication dates as incident chronology or event dates.
6. Timeline entries must describe disaster milestones, not source publication events.
7. Return JSON matching the requested schema.`;

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

  const depthInstruction = `Write substantive narrative only where the evidence supports it. Do not output one-line placeholders, generic response claims, or boilerplate when source material lacks facts for that section.`;

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
  const eventDate = normalizedEvent.eventDate
    || coerceIsoDate(synthesizedData.eventDate || synthesizedData.dateRange)
    || coerceIsoDate([eventFilterQuery, ...candidateFacts.dates].join(' '));
  const evidenceTimeline = makeEvidenceTimeline(citedSources, eventDate);

  const draftBundle: EvidenceBundle = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    eventName: synthesizedData.eventName || normalizedEvent.normalizedQuery || baseQuery,
    disasterType: (synthesizedData.disasterType as DisasterCategory) || normalizedEvent.disasterType || inferDisasterType(eventFilterQuery),
    location: synthesizedData.location || normalizedEvent.location || 'India',
    state: synthesizedData.state || normalizedEvent.state || 'India',
    country: 'India',
    eventDate,
    dateRange: eventDate ? formatDisasterDate(eventDate) : synthesizedData.dateRange || 'Documented Occurrence',
    numericCasualtiesRange: buildNumericRangeObject(casualtyReconciliation),
    reportedCasualties: reportedCasualties || '',
    reportedDamage: reportedDamage || extractBestFact(citedSources, 'damage'),
    sources: citedSources,
    timeline: cleanTimeline.length > 0 ? cleanTimeline : evidenceTimeline,
    whatHappened: whatHappened || `${citedSources[0].summary} [${citedSources[0].id}]`,
    affectedAreas: affectedAreas || extractBestFact(citedSources, 'location'),
    humanImpact: humanImpact || (casualtyRangeText ? `${casualtyRangeText} [${citedSources[0].id}]` : extractBestFact(citedSources, 'casualties')),
    infrastructureDamage: infrastructureDamage || extractBestFact(citedSources, 'damage'),
    economicImpact: economicImpact || '',
    governmentResponse: governmentResponse || '',
    rescueRelief: rescueRelief || '',
    recovery: recovery || '',
    sourceAssessment: synthesizedData.sourceAssessment || `Retrieved ${citedSources.length} relevant source${citedSources.length === 1 ? '' : 's'} from ${new Set(citedSources.map(publisherKey)).size} publisher${new Set(citedSources.map(publisherKey)).size === 1 ? '' : 's'}.`,
    conflictingReports: cleanConflicts,
    synthesizedAt: new Date().toISOString(),
    evidenceStatus: 'Limited Coverage',
    retrievalMetadata: {
      queriesExecuted: searchQueries,
      rawSourcesCount: allArticles.length,
      dedupedSourcesCount: citedSources.length,
    },
  };
  const coverage = buildEvidenceCoverage(draftBundle);
  if (!coverage.qualifies) {
    throw new Error('Insufficient relevant historical evidence was retrieved to build a reliable dossier for this event.');
  }
  const bundle: EvidenceBundle = {
    ...draftBundle,
    evidenceStatus: evidenceStatusFromCoverage(coverage),
    sourceAssessment: draftBundle.sourceAssessment
      ? `${draftBundle.sourceAssessment} Coverage: ${coverage.relevantSourceCount} relevant source(s), ${coverage.distinctPublisherCount} distinct publisher(s), ${coverage.meaningfulTimelineEntries} incident timeline milestone(s).`
      : '',
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
  try {
    const bundle = await buildHistoricalEvidenceBundle(
      seed ? `${seed.eventName} ${seed.approxDate}` : query,
      seed?.disasterType,
      seed?.state,
    );
    return bundleToArchiveItem(bundle, index);
  } catch (error) {
    const message = (error as Error).message;
    if (/no live google news sources|insufficient relevant historical evidence/i.test(message)) {
      return null;
    }
    console.warn('Archive evidence research failed:', message);
    return null;
  }
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
  else if (qLower.includes('earthquake') || qLower.includes('quake')) type = 'Earthquake';
  else if (qLower.includes('landslide')) type = 'Landslide';

  const facts = extractCandidateFacts(sources);
  const sourceSummary = sources.length
    ? sources.slice(0, 3).map((s) => `${cleanEvidenceText(s.summary || s.title)} [${s.id}]`).join(' ')
    : '';

  return {
    eventName: query,
    disasterType: type,
    location: inferLocation(query, inferState(query)),
    state: inferState(query),
    country: 'India',
    dateRange: coerceIsoDate(query) ? formatDisasterDate(coerceIsoDate(query)!) : 'Documented Occurrence',
    eventDate: coerceIsoDate(query),
    reportedCasualties: '',
    reportedDamage: facts.damage?.slice(0, 3).join('; ') || '',
    whatHappened: sourceSummary,
    affectedAreas: facts.location?.slice(0, 3).join('; ') || '',
    humanImpact: facts.casualties?.slice(0, 3).join('; ') || '',
    infrastructureDamage: facts.damage?.slice(0, 3).join('; ') || '',
    economicImpact: '',
    governmentResponse: facts.response?.slice(0, 3).join('; ') || '',
    rescueRelief: facts.response?.slice(0, 3).join('; ') || '',
    recovery: '',
    sourceAssessment: sources.length ? `Retrieved ${sources.length} source(s); automated synthesis was unavailable, so only extracted source fragments are shown.` : '',
    conflictingReports: [],
    timeline: makeEvidenceTimeline(sources, coerceIsoDate(query)),
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
    const associatedEvent = normalizeHistoricalEventQuery(`${associatedBundle.eventName} ${associatedBundle.eventDate || associatedBundle.dateRange}`);
    const targetedQueries = buildHistoricalResearchQueries(associatedEvent, associatedBundle.disasterType, associatedBundle.state)
      .filter((query) => {
        const q = query.toLowerCase();
        const msg = englishMessage.toLowerCase();
        if (/death|died|killed|casualt|injur|missing/.test(msg)) return /casualt|death|injur|missing/.test(q);
        if (/house|damage|loss|road|bridge|power|infrastructure|crop|economic/.test(msg)) return /damage|economic|houses|infrastructure/.test(q);
        if (/rescue|relief|evacuat|government|response|ndrf|sdrf/.test(msg)) return /rescue|relief|evacuat|government/.test(q);
        if (/timeline|when|chronolog|after|before/.test(msg)) return /timeline|aftermath|history/.test(q);
        return false;
      })
      .slice(0, 4);
    if (targetedQueries.length) {
      const extraArticles: NewsArticle[] = [];
      for (const q of targetedQueries) {
        extraArticles.push(...await searchGoogleNews(q, { isCurrentNews: false, maxResults: 4 }));
      }
      const extraSources = filterSourcesForEvent(filterIncidentEvidenceArticles(deduplicateNewsArticles(extraArticles)), {
        eventName: associatedEvent.normalizedQuery,
        disasterType: associatedBundle.disasterType,
        state: associatedBundle.state,
        approxDate: associatedBundle.eventDate || associatedBundle.dateRange,
      }).slice(0, 4).map((art, idx) => ({
        id: `S${evidenceSources.length + idx + 1}`,
        title: cleanEvidenceText(art.title),
        publisher: art.publisher,
        publishedAt: art.publishedAt,
        url: art.url,
        summary: cleanEvidenceText(art.summary),
      }));
      evidenceSources = deduplicateNewsArticles([...evidenceSources, ...extraSources] as any).map((source: any, idx) => ({
        ...source,
        id: `S${idx + 1}`,
      }));
    }
    contextText = `Associated Event: ${associatedBundle.eventName} (${associatedBundle.disasterType}, ${associatedBundle.location})\n` +
      `Summary: ${associatedBundle.whatHappened}\nImpact: ${associatedBundle.humanImpact}\nDamage: ${associatedBundle.infrastructureDamage}\n` +
      `Sources:\n` +
      evidenceSources.map((s: CitedSource) => `[${s.id}] ${s.title} (${s.publisher}): ${s.summary}`).join('\n');
  } else {
    const normalizedEvent = normalizeHistoricalEventQuery(englishMessage);
    const chatQueries = buildHistoricalResearchQueries(normalizedEvent).slice(0, 8);
    let articles: NewsArticle[] = [];
    for (const q of chatQueries) {
      articles.push(...await searchGoogleNews(q, { isCurrentNews: false, maxResults: 4 }));
    }
    articles = filterSourcesForEvent(filterIncidentEvidenceArticles(deduplicateNewsArticles(articles)), {
      eventName: normalizedEvent.normalizedQuery,
      disasterType: normalizedEvent.disasterType,
      state: normalizedEvent.state,
      approxDate: normalizedEvent.eventDate || String(normalizedEvent.year || ''),
    }).slice(0, 8);
    if (articles.length < 2) {
      const normalizedQuery = await normalizeDisasterSearchQuery(englishMessage);
      if (normalizedQuery) {
        const fallbackEvent = normalizeHistoricalEventQuery(normalizedQuery);
        const fallbackArticles: NewsArticle[] = [];
        for (const q of buildHistoricalResearchQueries(fallbackEvent).slice(0, 8)) {
          fallbackArticles.push(...await searchGoogleNews(q, { isCurrentNews: false, maxResults: 4 }));
        }
        articles = filterSourcesForEvent(filterIncidentEvidenceArticles(deduplicateNewsArticles([...articles, ...fallbackArticles])), {
          eventName: fallbackEvent.normalizedQuery,
          disasterType: fallbackEvent.disasterType,
          state: fallbackEvent.state,
          approxDate: fallbackEvent.eventDate || String(fallbackEvent.year || ''),
        }).slice(0, 8);
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
2. If facts are not in the sources after checking titles and summaries, say exactly which detail could not be established from the retrieved evidence.
3. Check spelling and grammar before responding. Output only clean professional text in the requested language.
4. Use concise Markdown: short paragraphs and bullet lists. Use tables only for truly tabular comparisons.
5. Do not emit raw HTML entities such as &nbsp;.
6. Avoid boilerplate disclaimers unless the evidence is genuinely missing.
7. Use ASCII citation brackets only, such as [S1], never fullwidth citation brackets.
8. ${langInstruction}`;

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
      ? `## Answer\n\nBased on retrieved historical records:\n\n` +
      evidenceSources.map((s) => `* **${s.title}** (${s.publisher}): ${s.summary} [${s.id}]`).join('\n\n')
      : `## Answer\n\nNo sufficiently relevant historical evidence was retrieved for this query after typo and alias normalization.`;
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

