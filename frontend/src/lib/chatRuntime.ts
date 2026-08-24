import type { ExternalStoreAdapter, AppendMessage, ThreadMessageLike } from '@assistant-ui/react';
import type { EvidenceBundle, CitedSource } from '../types/disaster';
import { translatePreservingCitations, translateText } from './googleTranslate';
import { apiUrl } from './api';

export interface ChatRuntimeOptions {
  messages?: ThreadMessageLike[];
  historyRef?: { current: Array<{ role: 'user' | 'assistant'; content: string }> };
  onMessagesChange?: (messages: ThreadMessageLike[]) => void;
  onRunningChange?: (isRunning: boolean) => void;
  inputLanguage?: string;
}

function messageText(message: AppendMessage): string {
  return message.content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
    .trim();
}

function sourceMetadata(sources: CitedSource[]) {
  return { custom: { sources, speechText: '' } };
}

export function createChatRuntime(
  language: string,
  associatedBundle: EvidenceBundle | null | undefined,
  options: ChatRuntimeOptions = {},
): ExternalStoreAdapter<ThreadMessageLike> {
  let messages = [...(options.messages || [])];
  const englishHistoryRef = options.historyRef || { current: [] };
  let isRunning = false;

  const publish = () => options.onMessagesChange?.([...messages]);
  const setRunning = (value: boolean) => {
    isRunning = value;
    options.onRunningChange?.(value);
  };

  const adapter: ExternalStoreAdapter<ThreadMessageLike> = {
    messages,
    isRunning,
    convertMessage: (message) => message,
    onNew: async (appendMessage) => {
      const userText = messageText(appendMessage);
      if (!userText) return;

      const userMessage: ThreadMessageLike = {
        role: 'user',
        id: `user-${Date.now()}`,
        createdAt: new Date(),
        content: userText,
      };
      messages = [...messages, userMessage];
      adapter.messages = messages;
      publish();
      setRunning(true);
      adapter.isRunning = true;

      try {
        const inputLanguage = options.inputLanguage || language;
        const responseLanguage = options.inputLanguage || language;
        const englishMessage = inputLanguage === 'en' ? userText : await translateText(userText, 'en', inputLanguage);
        const response = await fetch(apiUrl('/api/past/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: englishMessage,
            history: englishHistoryRef.current,
            targetLanguage: responseLanguage,
            associatedBundle,
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.details || data?.error || 'AI Assistant query failed');

        const englishReply = String(data?.reply || 'The assistant could not find a grounded answer.');
        englishHistoryRef.current = [...englishHistoryRef.current, { role: 'user', content: englishMessage }, { role: 'assistant', content: englishReply }];
        const reply = language === 'en' ? englishReply : await translatePreservingCitations(englishReply, language);
        const sources = Array.isArray(data?.sources) ? data.sources as CitedSource[] : [];
        messages = [...messages, {
          role: 'assistant',
          id: `assistant-${Date.now()}`,
          createdAt: new Date(),
          content: reply,
          status: { type: 'complete', reason: 'stop' },
          metadata: sourceMetadata(sources),
        }];
      } catch (error) {
        const reply = error instanceof Error ? error.message : 'The assistant could not complete that request.';
        englishHistoryRef.current = [...englishHistoryRef.current, { role: 'user', content: userText }, { role: 'assistant', content: reply }];
        messages = [...messages, {
          role: 'assistant',
          id: `assistant-error-${Date.now()}`,
          createdAt: new Date(),
          content: reply,
          status: { type: 'incomplete', reason: 'error' },
          metadata: sourceMetadata([]),
        }];
      } finally {
        adapter.messages = messages;
        adapter.isRunning = false;
        publish();
        setRunning(false);
      }
    },
  };

  return adapter;
}
