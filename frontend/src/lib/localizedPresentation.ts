import { useEffect, useMemo, useState } from 'react';
import { translateBatch } from './googleTranslate';

export interface PresentationEntry { id: string; text: string | null | undefined }
type CachedPresentation = { original: string; text: string; translated: boolean };

const cache = new Map<string, CachedPresentation>();

function cacheKey(language: string, entry: PresentationEntry) {
  return `${language}|${entry.id}|${entry.text || ''}`;
}

/**
 * A non-mutating display layer for API, source, and derived content. Canonical
 * objects remain in React state; only resolved strings are returned for render.
 */
export function useLocalizedPresentation(language: string, entries: PresentationEntry[]) {
  const signature = useMemo(() => entries.map((entry) => `${entry.id}:${entry.text || ''}`).join('\u001f'), [entries]);
  const [resolved, setResolved] = useState<Record<string, CachedPresentation>>({});

  useEffect(() => {
    const valid = entries.filter((entry) => Boolean(entry.text?.trim()));
    if (language === 'en' || valid.length === 0) {
      setResolved(Object.fromEntries(valid.map((entry) => [entry.id, { original: entry.text!.trim(), text: entry.text!.trim(), translated: false }])));
      return;
    }

    const missing = valid.filter((entry) => !cache.has(cacheKey(language, entry)));
    const cached = Object.fromEntries(valid.flatMap((entry) => {
      const item = cache.get(cacheKey(language, entry));
      return item ? [[entry.id, item]] : [];
    }));
    setResolved(cached);
    if (missing.length === 0) return;

    let cancelled = false;
    void translateBatch(missing.map((entry) => entry.text!.trim()), language)
      .then((values) => {
        if (cancelled) return;
        const incoming: Record<string, CachedPresentation> = {};
        missing.forEach((entry, index) => {
          const text = values[index] || entry.text || '';
          const value = { original: entry.text || '', text, translated: text !== entry.text };
          cache.set(cacheKey(language, entry), value);
          incoming[entry.id] = value;
        });
        setResolved((current) => ({ ...current, ...incoming }));
      })
      .catch(() => { /* Canonical source text remains visible on a translation failure. */ });
    return () => { cancelled = true; };
  }, [language, signature]);

  return (id: string, fallback: string | null | undefined) => resolved[id]?.text || fallback || '';
}
