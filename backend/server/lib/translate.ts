type TranslateResult = {
  text?: string;
};

const translationCache = new Map<string, string>();

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
