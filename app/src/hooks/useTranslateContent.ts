import { useEffect, useState } from 'react';
import { translateText } from '../lib/googleTranslate';

export function useTranslateContent(source: string | null | undefined, language: string) {
  const original = source || '';
  const [translated, setTranslated] = useState(original);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    if (!original || language === 'en') {
      setTranslated(original);
      setIsTranslating(false);
      return;
    }

    let cancelled = false;
    setTranslated(original);
    setIsTranslating(true);
    void translateText(original, language).then((value) => {
      if (cancelled) return;
      setTranslated(value);
      setIsTranslating(false);
    });
    return () => { cancelled = true; };
  }, [original, language]);

  return { translated, isTranslating };
}
