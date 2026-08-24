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

const TRANSLATE_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';
const MAX_CACHE_ENTRIES = 500;
const MAX_BATCH_SIZE = 100;
const cache = new Map<string, string>();

function getApiKey(): string {
  return String(import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY || '').trim();
}

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

async function requestTranslations(texts: string[], targetLang: string): Promise<string[]> {
  const key = getApiKey();
  if (!key || targetLang === 'en' || texts.length === 0) return texts;

  try {
    const response = await fetch(`${TRANSLATE_ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: texts, target: targetLang, source: 'en', format: 'text' }),
    });
    if (!response.ok) return texts;

    const payload = (await response.json()) as {
      data?: { translations?: Array<{ translatedText?: unknown }> };
    };
    const translated = payload.data?.translations || [];
    return texts.map((text, index) => {
      const value = translated[index]?.translatedText;
      return typeof value === 'string' && value.trim() ? value : text;
    });
  } catch {
    return texts;
  }
}

export async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || targetLang === 'en' || !getApiKey()) return text;
  const cacheKey = `${targetLang}:${text}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    cache.delete(cacheKey);
    cache.set(cacheKey, cached);
    return cached;
  }

  const [translated] = await requestTranslations([text], targetLang);
  return remember(cacheKey, translated || text);
}

export async function translateBatch(texts: string[], targetLang: string): Promise<string[]> {
  if (texts.length === 0 || targetLang === 'en' || !getApiKey()) return texts;

  const output = new Array<string>(texts.length);
  const missing: Array<{ index: number; text: string; key: string }> = [];

  texts.forEach((text, index) => {
    if (!text) {
      output[index] = text;
      return;
    }
    const key = `${targetLang}:${text}`;
    const cached = cache.get(key);
    if (cached !== undefined) {
      output[index] = cached;
      cache.delete(key);
      cache.set(key, cached);
    } else {
      missing.push({ index, text, key });
    }
  });

  for (let start = 0; start < missing.length; start += MAX_BATCH_SIZE) {
    const chunk = missing.slice(start, start + MAX_BATCH_SIZE);
    const translated = await requestTranslations(chunk.map((item) => item.text), targetLang);
    chunk.forEach((item, offset) => {
      output[item.index] = remember(item.key, translated[offset] || item.text);
    });
  }

  return output.map((text, index) => text ?? texts[index]);
}

export async function translatePreservingCitations(text: string, targetLang: string): Promise<string> {
  if (!text || targetLang === 'en') return text;
  const citations = Array.from(new Set(text.match(/\[S\d+\]/gi) || []));
  if (citations.length === 0) return translateText(text, targetLang);

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
  let translated = await translateText(protectedText, targetLang);
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
