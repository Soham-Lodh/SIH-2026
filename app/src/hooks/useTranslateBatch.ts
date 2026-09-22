import { useEffect, useState } from 'react';
import { translateBatch } from '../lib/googleTranslate';

export function useTranslateBatch<T extends Record<string, string>>(fields: T | null, language: string) {
  const [result, setResult] = useState<T | null>(fields);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    if (!fields || language === 'en') {
      setResult(fields);
      setIsTranslating(false);
      return;
    }

    let cancelled = false;
    const keys = Object.keys(fields) as Array<keyof T>;
    setResult(null);
    setIsTranslating(true);
    void translateBatch(keys.map((key) => fields[key]), language).then((values) => {
      if (cancelled) return;
      setResult(Object.fromEntries(keys.map((key, index) => [key, values[index]])) as T);
      setIsTranslating(false);
    });
    return () => { cancelled = true; };
  }, [fields, language]);

  return { result, isTranslating };
}
