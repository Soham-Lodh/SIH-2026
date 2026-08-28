const translationCache = new Map<string, string>();
const TRANSLATION_ENDPOINT = String(process.env.TRANSLATION_API_URL || 'https://api.mymemory.translated.net/get').trim();
const MAX_QUERY_BYTES = 480;

export interface LocalizedPresentationText {
  original: string;
  text: string;
  language: string;
  translated: boolean;
}

/** Converts RSS/HTML fragments into safe display text before translation. */
export function normalizePresentationText(value: string): string {
  return (value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function protectNonTranslatableTokens(value: string) {
  const tokens = Array.from(new Set(value.match(/\[S\d+\]|https?:\/\/[^\s)]+|\b(?:CAP|SACHET)-[A-Za-z0-9_-]+\b/g) || []));
  let protectedValue = value;
  tokens.forEach((token, index) => {
    protectedValue = protectedValue.split(token).join(`__KEEP_${index}__`);
  });
  return { protectedValue, tokens };
}

/**
 * Localizes a display copy without changing canonical alert/evidence objects.
 * The cache fingerprint includes normalized source content, so changes naturally
 * produce a new cache entry.
 */
export async function resolveLocalizedPresentation(value: string, targetLanguage?: string): Promise<LocalizedPresentationText> {
  const original = normalizePresentationText(value);
  const language = normalizeLanguageCode(targetLanguage);
  if (!original || language === 'en') return { original, text: original, language, translated: false };

  const cacheKey = `presentation|${language}|${fingerprint(original)}|${original.length}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return { original, text: cached, language, translated: true };

  const { protectedValue, tokens } = protectNonTranslatableTokens(original);
  const translated = await translateText(protectedValue, language);
  let text = translated;
  tokens.forEach((token, index) => {
    text = text.split(`__KEEP_${index}__`).join(token);
  });
  const normalized = normalizePresentationText(text) || original;
  const wasTranslated = normalized !== original;
  if (wasTranslated) translationCache.set(cacheKey, normalized);
  return { original, text: normalized, language, translated: wasTranslated };
}

function normalizeLanguageCode(lang?: string): string {
  const code = (lang || 'en').trim().toLowerCase();
  if (!code || code === 'en') return 'en';
  const aliases: Record<string, string> = {
    english: 'en', hindi: 'hi', bengali: 'bn', bangla: 'bn', telugu: 'te', marathi: 'mr',
    tamil: 'ta', urdu: 'ur', gujarati: 'gu', kannada: 'kn', odia: 'or', oriya: 'or',
    malayalam: 'ml', punjabi: 'pa', assamese: 'as', maithili: 'mai', nepali: 'ne',
    konkani: 'kok', sindhi: 'sd', dogri: 'doi', manipuri: 'mni', bodo: 'brx',
  };
  return aliases[code] || code.split('-')[0];
}

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

async function translateChunk(text: string, targetLanguage: string, sourceLanguage: string): Promise<string> {
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceLanguage || 'en'}|${targetLanguage}`,
    mt: '1',
  });
  try {
    const response = await fetch(`${TRANSLATION_ENDPOINT}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return text;
    const payload = await response.json() as {
      responseStatus?: number;
      responseData?: { translatedText?: unknown };
    };
    const translated = payload.responseData?.translatedText;
    return payload.responseStatus === 200 && typeof translated === 'string' && translated.trim()
      ? translated
      : text;
  } catch {
    return text;
  }
}

export async function translateText(text: string, targetLanguage?: string, sourceLanguage = 'en'): Promise<string> {
  const lang = normalizeLanguageCode(targetLanguage);
  const source = normalizeLanguageCode(sourceLanguage);
  const cleanText = (text || '').toString();
  if (!cleanText.trim()) return cleanText;
  if (lang === source) return cleanText;

  const cacheKey = `${source}|${lang}|${cleanText}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  try {
    const chunks = splitForProvider(cleanText);
    const translated = await Promise.all(chunks.map((chunk) => translateChunk(chunk, lang, source)));
    const finalText = translated.join('') || cleanText;
    translationCache.set(cacheKey, finalText);
    return finalText;
  } catch {
    return cleanText;
  }
}

export async function translateArray(items: string[], targetLanguage?: string, sourceLanguage = 'en'): Promise<string[]> {
  const results: string[] = [];
  for (const item of items) {
    results.push(await translateText(item, targetLanguage, sourceLanguage));
  }
  return results;
}

export function normalizeLang(lang?: string): string {
  return normalizeLanguageCode(lang);
}
