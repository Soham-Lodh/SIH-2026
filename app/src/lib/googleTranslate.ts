import type {
  AlertSeverity,
  AlertUrgency,
  CitedSource,
  ComparisonMatrix,
  ConflictingReport,
  EvidenceBundle,
  SachetAlert,
  TimelineEvent,
} from '../types/disaster';

// MyMemory is a public, keyless translation service. Keep this URL configurable
// so deployments can move to another compatible free provider without a build change.
const TRANSLATE_ENDPOINT = String(import.meta.env.VITE_TRANSLATION_API_URL || 'https://api.mymemory.translated.net/get').trim();
const MAX_CACHE_ENTRIES = 500;
const MAX_BATCH_SIZE = 12;
const cache = new Map<string, string>();

function remember(key: string, value: string): string {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
  return value;
}

const MAX_QUERY_BYTES = 480;

function splitForProvider(text: string): string[] {
  if (new TextEncoder().encode(text).length <= MAX_QUERY_BYTES) return [text];
  const chunks: string[] = [];
  let current = '';
  for (const word of text.split(/(\s+)/)) {
    const candidate = current + word;
    if (current && new TextEncoder().encode(candidate).length > MAX_QUERY_BYTES) {
      chunks.push(current);
      current = word.trimStart();
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text];
}

async function requestSingleTranslation(text: string, targetLang: string, sourceLang: string): Promise<string> {
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceLang || 'en'}|${targetLang}`,
    mt: '1',
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
    const response = await fetch(`${TRANSLATE_ENDPOINT}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (response.status === 429 && attempt < 2) {
      await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
      continue;
    }
    if (!response.ok) return text;
    const payload = (await response.json()) as {
      responseStatus?: number;
      responseData?: { translatedText?: unknown };
    };
    const translated = payload.responseData?.translatedText;
    return payload.responseStatus === 200 && typeof translated === 'string' && translated.trim()
      ? translated
      : text;
    } catch {
      if (attempt === 2) return text;
    }
  }
  return text;
}

async function requestTranslations(texts: string[], targetLang: string, sourceLang = 'en'): Promise<string[]> {
  if (texts.length === 0 || targetLang === sourceLang) return texts;
  const output: string[] = [];
  for (let index = 0; index < texts.length; index += 2) {
    const pair = texts.slice(index, index + 2);
    const translatedPair = await Promise.all(pair.map(async (text) => {
      const parts = splitForProvider(text);
      const translated = await Promise.all(parts.map((part) => requestSingleTranslation(part, targetLang, sourceLang)));
      return translated.join('');
    }));
    output.push(...translatedPair);
  }
  return output;
}

const PROTECTED_BRANDS = [
  'AapdaDrishti',
  'Aapda Drishti',
  'AAPDA DRISHTI',
  'Aapada Drishti',
  'AapadaDrishti',
  'AAPDADRISHTI',
];

function protectBrandNames(text: string): { protectedText: string; tokens: Map<string, string> } {
  let result = text;
  const tokens = new Map<string, string>();
  PROTECTED_BRANDS.forEach((brand, idx) => {
    if (result.includes(brand)) {
      const token = `__BRAND_TOKEN_${idx}__`;
      tokens.set(token, brand);
      result = result.replaceAll(brand, token);
    }
  });
  return { protectedText: result, tokens };
}

function restoreBrandNames(text: string, tokens: Map<string, string>): string {
  let result = text;
  tokens.forEach((brand, token) => {
    result = result.replaceAll(token, brand);
  });
  return result;
}

export async function translateText(text: string, targetLang: string, sourceLang = 'en'): Promise<string> {
  if (!text || targetLang === sourceLang) return text;
  const { protectedText, tokens } = protectBrandNames(text);
  const cacheKey = `${sourceLang}:${targetLang}:${protectedText}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    cache.delete(cacheKey);
    cache.set(cacheKey, cached);
    return restoreBrandNames(cached, tokens);
  }

  const [translated] = await requestTranslations([protectedText], targetLang, sourceLang);
  const finalResult = restoreBrandNames(translated || protectedText, tokens);
  return remember(cacheKey, finalResult);
}

export async function translateBatch(texts: string[], targetLang: string, sourceLang = 'en'): Promise<string[]> {
  if (texts.length === 0 || targetLang === sourceLang) return texts;

  const protectedEntries = texts.map((t) => protectBrandNames(t));
  const output = new Array<string>(texts.length);
  const missing: Array<{ index: number; text: string; key: string }> = [];

  protectedEntries.forEach(({ protectedText }, index) => {
    if (!protectedText) {
      output[index] = protectedText;
      return;
    }
    const key = `${sourceLang}:${targetLang}:${protectedText}`;
    const cached = cache.get(key);
    if (cached !== undefined) {
      output[index] = cached;
      cache.delete(key);
      cache.set(key, cached);
    } else {
      missing.push({ index, text: protectedText, key });
    }
  });

  for (let start = 0; start < missing.length; start += MAX_BATCH_SIZE) {
    const chunk = missing.slice(start, start + MAX_BATCH_SIZE);
    const translated = await requestTranslations(chunk.map((item) => item.text), targetLang, sourceLang);
    chunk.forEach((item, offset) => {
      output[item.index] = remember(item.key, translated[offset] || item.text);
    });
  }

  return output.map((res, index) => {
    const textRes = res ?? protectedEntries[index].protectedText;
    return restoreBrandNames(textRes, protectedEntries[index].tokens);
  });
}

export async function translatePreservingCitations(text: string, targetLang: string, sourceLang = 'en'): Promise<string> {
  if (!text || targetLang === sourceLang) return text;
  const citations = Array.from(new Set(text.match(/\[S\d+\]/gi) || []));
  if (citations.length === 0) return translateText(text, targetLang, sourceLang);

  const placeholders = citations.map((citation, index) => ({
    citation,
    token: `__CITE_${index}__`,
  }));
  let protectedText = text;
  placeholders.forEach(({ citation, token }) => {
    protectedText = protectedText.replace(
      new RegExp(citation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
      token,
    );
  });
  let translated = await translateText(protectedText, targetLang, sourceLang);
  placeholders.forEach(({ citation, token }) => {
    translated = translated.replace(new RegExp(token, 'g'), citation.toUpperCase());
  });
  return translated;
}

async function translateSource(source: CitedSource, language: string): Promise<CitedSource> {
  const [title, summary] = await Promise.all([
    translateText(source.title, language),
    translatePreservingCitations(source.summary, language),
  ]);
  return { ...source, title, summary };
}

async function translateTimelineItem(item: TimelineEvent, language: string): Promise<TimelineEvent> {
  const [event, description] = await Promise.all([
    translateText(item.event, language),
    translatePreservingCitations(item.description, language),
  ]);
  return { ...item, event, description };
}

async function translateConflict(item: ConflictingReport, language: string): Promise<ConflictingReport> {
  return {
    ...item,
    topic: await translateText(item.topic, language),
    details: await translatePreservingCitations(item.details, language),
  };
}

export async function translateEvidenceBundle(bundle: EvidenceBundle, language: string): Promise<EvidenceBundle> {
  if (language === 'en') return bundle;
  const fields = [
    bundle.eventName,
    bundle.location,
    bundle.state,
    bundle.whatHappened,
    bundle.affectedAreas,
    bundle.humanImpact,
    bundle.infrastructureDamage,
    bundle.economicImpact,
    bundle.governmentResponse,
    bundle.rescueRelief,
    bundle.recovery,
    bundle.sourceAssessment,
    bundle.reportedCasualties,
    bundle.reportedDamage,
  ];
  const translatedFields = await Promise.all(fields.map((field) => translatePreservingCitations(field, language)));
  const [eventName, location, state, whatHappened, affectedAreas, humanImpact, infrastructureDamage,
    economicImpact, governmentResponse, rescueRelief, recovery, sourceAssessment, reportedCasualties, reportedDamage] = translatedFields;

  return {
    ...bundle,
    eventName,
    location,
    state,
    whatHappened,
    affectedAreas,
    humanImpact,
    infrastructureDamage,
    economicImpact,
    governmentResponse,
    rescueRelief,
    recovery,
    sourceAssessment,
    reportedCasualties,
    reportedDamage,
    sources: await Promise.all(bundle.sources.map((source) => translateSource(source, language))),
    timeline: await Promise.all(bundle.timeline.map((item) => translateTimelineItem(item, language))),
    conflictingReports: await Promise.all(bundle.conflictingReports.map((item) => translateConflict(item, language))),
  };
}

export async function translateAlert(alert: SachetAlert, language: string): Promise<SachetAlert> {
  if (language === 'en') return alert;
  const [event, headline, description, instruction, areaDesc] = await Promise.all([
    translateText(alert.event, language),
    translateText(alert.headline, language),
    translateText(alert.description, language),
    translateText(alert.instruction, language),
    translateText(alert.areaDesc, language),
  ]);
  return { ...alert, event, headline, description, instruction, areaDesc };
}

export async function translateComparison(comparison: ComparisonMatrix, language: string): Promise<ComparisonMatrix> {
  if (language === 'en') return comparison;
  const comparisonPoints = await Promise.all(comparison.comparisonPoints.map(async (point) => ({
    ...point,
    label: await translateText(point.label, language),
    values: await Promise.all(point.values.map(async (value) => ({
      ...value,
      value: await translatePreservingCitations(value.value, language),
    }))),
  })));
  return {
    ...comparison,
    comparisonPoints,
    aiSynthesis: {
      ...comparison.aiSynthesis,
      broaderImpact: await translatePreservingCitations(comparison.aiSynthesis.broaderImpact, language),
      responseDifferences: await translatePreservingCitations(comparison.aiSynthesis.responseDifferences, language),
      crossEventLessons: await translatePreservingCitations(comparison.aiSynthesis.crossEventLessons, language),
    },
  };
}

export function translateAlertEnums<T extends AlertSeverity | AlertUrgency>(value: T): T {
  return value;
}
