import { useEffect } from 'react';
import { translateBatch } from '../lib/googleTranslate';

type TranslatedNode = { source: string; translated: string };

function isEnglishSource(value: string): boolean {
  const letters = value.match(/\p{L}/gu) || [];
  const latinLetters = value.match(/[A-Za-z]/g) || [];
  return value.trim().length >= 3 && latinLetters.length >= 2 && latinLetters.length / Math.max(letters.length, 1) > 0.75;
}

/**
 * Covers hardcoded labels and third-party/API text that is not rendered through
 * one of the typed presentation components. Canonical React state is unchanged.
 */
export function useAutoTranslatePage(language: string): void {
  useEffect(() => {
    const translatedNodes = new Map<Text, TranslatedNode>();
    let timer: number | null = null;
    let cancelled = false;

    const restoreEnglish = () => {
      translatedNodes.forEach((item, node) => {
        if (node.nodeValue === item.translated) node.nodeValue = item.source;
      });
      translatedNodes.clear();
    };

    if (language === 'en') {
      restoreEnglish();
      return undefined;
    }

    const collect = () => {
      const candidates: Text[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode() as Text | null;
      while (node) {
        const parent = node.parentElement;
        const current = node.nodeValue?.replace(/\s+/g, ' ').trim() || '';
        const previous = translatedNodes.get(node);
        if (previous && current === previous.translated) {
          node = walker.nextNode() as Text | null;
          continue;
        }
        if (parent && !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(parent.tagName) && isEnglishSource(current)) {
          translatedNodes.set(node, { source: current, translated: current });
          candidates.push(node);
        }
        node = walker.nextNode() as Text | null;
      }
      return candidates.slice(0, 20);
    };

    const translateVisibleText = () => {
      timer = null;
      const nodes = collect();
      if (!nodes.length || cancelled) return;
      void translateBatch(nodes.map((node) => translatedNodes.get(node)?.source || node.nodeValue || ''), language)
        .then((values) => {
          if (cancelled) return;
          nodes.forEach((node, index) => {
            const source = translatedNodes.get(node)?.source || node.nodeValue || '';
            const translated = values[index] || source;
            translatedNodes.set(node, { source, translated });
            if (node.nodeValue?.replace(/\s+/g, ' ').trim() === source) node.nodeValue = translated;
          });
          schedule();
        });
    };

    const schedule = () => {
      if (timer === null && !cancelled) timer = window.setTimeout(translateVisibleText, 500);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      observer.disconnect();
      restoreEnglish();
    };
  }, [language]);
}
