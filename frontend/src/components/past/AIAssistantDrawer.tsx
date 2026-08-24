import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ThreadMessageLike } from '@assistant-ui/react';
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
  useExternalStoreRuntime,
} from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import {
  X,
  Sparkles,
  Volume2,
  VolumeX,
  Bot,
  User,
  Loader2,
  Send,
  Square,
} from 'lucide-react';
import type { CitedSource, EvidenceBundle } from '../../types/disaster';
import { INDIAN_LANGUAGES, getTranslation, translate } from '../../types/language';
import { AudioRecorderButton } from '../common/AudioRecorderButton';
import { apiUrl } from '../../lib/api';
import { createChatRuntime } from '../../lib/chatRuntime';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  associatedBundle?: EvidenceBundle | null;
  language: string;
  onLanguageChange?: (lang: string) => void;
}

type EnglishHistory = Array<{ role: 'user' | 'assistant'; content: string }>;

function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[S\d+\]/gi, ' ')
    .replace(/[*_`>#-]+/g, ' ')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MarkdownMessageText: React.FC = () => (
  <div className="prose prose-sm max-w-none text-slate-800 prose-headings:text-slate-900 prose-a:text-indigo-700 prose-code:text-slate-900">
    <MarkdownTextPrimitive />
  </div>
);

interface MessageBubbleProps {
  language: string;
  isPlayingAudio: boolean;
  onPlayTTS: (text: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ language, isPlayingAudio, onPlayTTS }) => {
  const message = useAuiState((state) => state.message);
  const role = useAuiState((state) => state.message.role);
  const custom = useAuiState((state) => state.message.metadata?.custom) as Record<string, unknown> | undefined;
  const sources = Array.isArray(custom?.sources) ? custom.sources as CitedSource[] : [];
  const speechText = typeof custom?.speechText === 'string' && custom.speechText ? custom.speechText : '';
  const messageSpeechText = typeof message.content === 'string'
    ? message.content
    : message.content.filter((part) => part.type === 'text').map((part) => part.text).join(' ');
  const isAssistant = role === 'assistant';

  return (
    <MessagePrimitive.Root className={`flex gap-3 items-start ${isAssistant ? '' : 'flex-row-reverse'}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isAssistant ? 'bg-slate-100 text-indigo-600 border border-slate-200' : 'bg-indigo-600 text-white'}`}>
        {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </div>
      <div className={`space-y-1.5 max-w-[86%] ${isAssistant ? 'text-left' : 'text-right'}`}>
        <div className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${isAssistant ? 'bg-slate-50 border border-slate-200 rounded-tl-none' : 'bg-indigo-600 text-white rounded-tr-none shadow-sm'}`}>
          <MessagePrimitive.Parts components={{ Text: isAssistant ? MarkdownMessageText : undefined }} />
        </div>
        {isAssistant && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => onPlayTTS(speechText || messageSpeechText)}
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-xl border transition-colors ${isPlayingAudio ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-indigo-600 bg-slate-100 border-slate-200 hover:bg-indigo-50'}`}
            >
              {isPlayingAudio ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{isPlayingAudio ? translate(language, 'common.stop') : translate(language, 'common.listen')}</span>
            </button>
            {sources.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                <span>{translate(language, 'common.sources')}:</span>
                {sources.map((source) => (
                  <a key={source.id} href={source.url} target="_blank" rel="noreferrer noopener" title={source.title} className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100">
                    [{source.id}]
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </MessagePrimitive.Root>
  );
};

const ComposerControls: React.FC<{ language: string; inputRef: React.RefObject<HTMLTextAreaElement | null>; onTranscribed: (text: string) => void }> = ({ language, inputRef, onTranscribed }) => {
  const aui = useAui();
  const isRunning = useAuiState((state) => state.thread.isRunning);
  const activeLangObj = INDIAN_LANGUAGES.find((item) => item.code === language) || INDIAN_LANGUAGES[0];

  return (
    <ComposerPrimitive.Root className="flex items-end gap-2">
      <AudioRecorderButton
        language={language}
        targetLanguage={language}
        onTranscribed={(text) => {
          onTranscribed(text);
          aui.composer.setText(text);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        tooltip={translate(language, 'assistant.record')}
        className="p-2"
      />
      <ComposerPrimitive.Input
        ref={inputRef}
        rows={1}
        placeholder={translate(language, 'assistant.placeholder', { language: activeLangObj.name })}
        className="min-h-10 max-h-28 flex-1 resize-none px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-sm"
      />
      {isRunning ? (
        <ComposerPrimitive.Cancel asChild>
          <button type="button" className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm" title="Stop processing">
            <Square className="w-4 h-4 fill-current" />
          </button>
        </ComposerPrimitive.Cancel>
      ) : (
        <ComposerPrimitive.Send asChild>
          <button type="submit" className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm" title="Send message">
            <Send className="w-4 h-4" />
          </button>
        </ComposerPrimitive.Send>
      )}
    </ComposerPrimitive.Root>
  );
};

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  associatedBundle,
  language,
}) => {
  const [messages, setMessages] = useState<ThreadMessageLike[]>([]);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [transcript, setTranscript] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackTokenRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const englishHistoryRef = useRef<EnglishHistory>([]);
  const t = getTranslation(language);
  const activeLangObj = INDIAN_LANGUAGES.find((item) => item.code === language) || INDIAN_LANGUAGES[0];

  const welcomeMessage = useMemo<ThreadMessageLike>(() => ({
    role: 'assistant',
    id: 'm-welcome',
    createdAt: new Date(),
    content: associatedBundle
      ? `Hello! I am your Multilingual Disaster Intelligence Assistant. I am grounded in evidence for **${associatedBundle.eventName}**. You can type or speak in **${activeLangObj.name} (${activeLangObj.nativeName})** or English.`
      : `Hello! I am your Multilingual Disaster Intelligence Research Assistant. Ask me about Indian historical cyclones, floods, earthquakes, evacuation logistics, or casualty statistics. You can speak in **${activeLangObj.name} (${activeLangObj.nativeName})** or English.`,
    status: { type: 'complete', reason: 'stop' },
    metadata: { custom: { sources: [], speechText: '' } },
  }), [associatedBundle, activeLangObj.name, activeLangObj.nativeName]);

  useEffect(() => {
    setMessages((current) => current.length === 0 || current.every((message) => message.id === 'm-welcome') ? [welcomeMessage] : current);
  }, [messages.length, welcomeMessage]);

  const adapter = useMemo(() => createChatRuntime(language, associatedBundle, {
    messages,
    historyRef: englishHistoryRef,
    onMessagesChange: setMessages,
  }), [language, associatedBundle, messages]);
  const runtime = useExternalStoreRuntime(adapter);

  const stopAudioPlayback = () => {
    playbackTokenRef.current += 1;
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsPlayingAudio(false);
  };

  const playTTS = async (text: string) => {
    const cleanText = stripMarkdownForSpeech(text);
    if (!cleanText) return;
    if (isPlayingAudio) {
      stopAudioPlayback();
      return;
    }
    const token = ++playbackTokenRef.current;
    setIsPlayingAudio(true);
    try {
      const response = await fetch(apiUrl('/api/tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voiceName: 'Kore' }),
      });
      const data = await response.json().catch(() => null);
      if (token !== playbackTokenRef.current) return;
      if (data?.audioBase64) {
        const audio = audioRef.current || new Audio();
        audioRef.current = audio;
        audio.src = `data:audio/mp3;base64,${data.audioBase64}`;
        audio.onended = () => token === playbackTokenRef.current && setIsPlayingAudio(false);
        audio.onerror = () => token === playbackTokenRef.current && setIsPlayingAudio(false);
        await audio.play();
      } else if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = language === 'en' ? 'en-IN' : `${language}-IN`;
        utterance.onend = () => token === playbackTokenRef.current && setIsPlayingAudio(false);
        utterance.onerror = () => token === playbackTokenRef.current && setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsPlayingAudio(false);
      }
    } catch {
      if (token === playbackTokenRef.current) setIsPlayingAudio(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] bg-white border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      <audio ref={audioRef} className="hidden" />
      <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm"><Sparkles className="w-4 h-4" /></div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <span>{t.voiceAssistantTitle}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold">{activeLangObj.name}</span>
            </h3>
            <p className="text-[11px] text-slate-500">{translate(language, 'assistant.grounded')}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" aria-label={translate(language, 'common.close')}><X className="w-4 h-4" /></button>
      </div>

      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
          <ThreadPrimitive.Viewport autoScroll className="flex-1 overflow-y-auto p-4 space-y-4">
            <ThreadPrimitive.Messages components={{ Message: () => <MessageBubble language={language} isPlayingAudio={isPlayingAudio} onPlayTTS={playTTS} /> }} />
            <ThreadPrimitive.If running>
              <div className="flex items-center gap-2 text-xs text-indigo-600 px-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />{translate(language, 'assistant.pipeline')}</div>
            </ThreadPrimitive.If>
          </ThreadPrimitive.Viewport>
          <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 space-y-2">
            {transcript && <div className="text-[11px] text-slate-600 px-2">Transcript ready: <span className="font-medium text-slate-900">{transcript}</span></div>}
            <ComposerControls language={language} inputRef={inputRef} onTranscribed={setTranscript} />
          </div>
        </ThreadPrimitive.Root>
      </AssistantRuntimeProvider>
    </div>
  );
};
