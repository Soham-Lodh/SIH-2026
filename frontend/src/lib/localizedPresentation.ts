import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from './api';

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
    void fetch(apiUrl('/api/localize/presentation'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, entries: missing }),
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Presentation translation unavailable')))
      .then((payload) => {
        if (cancelled) return;
        const incoming: Record<string, CachedPresentation> = {};
        for (const item of payload.items || []) {
          if (!item?.id || typeof item.text !== 'string') continue;
          const entry = missing.find((candidate) => candidate.id === item.id);
          if (!entry) continue;
          const value = { original: item.original || entry.text || '', text: item.text, translated: Boolean(item.translated) };
          cache.set(cacheKey(language, entry), value);
          incoming[item.id] = value;
        }
        setResolved((current) => ({ ...current, ...incoming }));
      })
      .catch(() => { /* Canonical source text remains visible on a translation failure. */ });
    return () => { cancelled = true; };
  }, [language, signature]);

  return (id: string, fallback: string | null | undefined) => resolved[id]?.text || fallback || '';
}
