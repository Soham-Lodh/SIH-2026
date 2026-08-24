type TranslateResult = {
  text?: string;
};

const translationCache = new Map<string, string>();

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
  return code.split('-')[0];
}

async function getTranslator(): Promise<(text: string, to: string) => Promise<string>> {
  const mod = await import('@vitalets/google-translate-api');
  const translator = (mod as any).default || (mod as any).translate || mod;

  return async (text: string, to: string) => {
    const result = (await translator(text, { to })) as TranslateResult;
    return typeof result?.text === 'string' ? result.text : text;
  };
}

export async function translateText(text: string, targetLanguage?: string): Promise<string> {
  const lang = normalizeLanguageCode(targetLanguage);
  const cleanText = (text || '').toString();
  if (!cleanText.trim()) return cleanText;

  const cacheKey = `${lang}|${cleanText}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  try {
    const translator = await getTranslator();
    const translated = await translator(cleanText, lang);
    const finalText = translated || cleanText;
    translationCache.set(cacheKey, finalText);
    return finalText;
  } catch {
    return cleanText;
  }
}

export async function translateArray(items: string[], targetLanguage?: string): Promise<string[]> {
  const results: string[] = [];
  for (const item of items) {
    results.push(await translateText(item, targetLanguage));
  }
  return results;
}

export function normalizeLang(lang?: string): string {
  return normalizeLanguageCode(lang);
}
