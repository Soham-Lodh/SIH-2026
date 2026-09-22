import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  X,
  Sparkles,
  Volume2,
  VolumeX,
  Bot,
  User,
  Loader2,
  Send,
  Activity,
  AlertCircle,
} from 'lucide-react';
import type { CitedSource, EvidenceBundle } from '../../types/disaster';
import { INDIAN_LANGUAGES, getTranslation, translate } from '../../types/language';
import { AudioRecorderButton } from '../common/AudioRecorderButton';
import { ChatSkeleton } from '../common/Skeletons';
import { apiUrl } from '../../lib/api';
import { translateText, translatePreservingCitations } from '../../lib/googleTranslate';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  associatedBundle?: EvidenceBundle | null;
  language: string;
  onLanguageChange?: (lang: string) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  metadata?: {
    custom?: {
      sources?: CitedSource[];
      speechText?: string;
    };
  };
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

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  associatedBundle,
  language,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [inputLanguage, setInputLanguage] = useState(language);
  const [isAssistantRunning, setIsAssistantRunning] = useState(false);
  const [runningStageIndex, setRunningStageIndex] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackTokenRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatViewportRef = useRef<HTMLDivElement | null>(null);
  const englishHistoryRef = useRef<EnglishHistory>([]);

  const t = getTranslation(language);
  const activeLangObj = INDIAN_LANGUAGES.find((item) => item.code === language) || INDIAN_LANGUAGES[0];

  const welcomeMessage = useMemo<ChatMessage>(() => ({
    role: 'assistant',
    id: 'm-welcome',
    createdAt: new Date(),
    content: associatedBundle
      ? `Hello! I am your Multilingual Disaster Intelligence Assistant. I am grounded in evidence for **${associatedBundle.eventName}**. You can type or speak in **${activeLangObj.name} (${activeLangObj.nativeName})** or English.`
      : `Hello! I am your Multilingual Disaster Intelligence Research Assistant. Ask me about Indian historical cyclones, floods, earthquakes, evacuation logistics, or casualty statistics. You can speak in **${activeLangObj.name} (${activeLangObj.nativeName})** or English.`,
    metadata: { custom: { sources: [], speechText: '' } },
  }), [associatedBundle, activeLangObj.name, activeLangObj.nativeName]);

  // Set welcome message on initialization
  useEffect(() => {
    setMessages((current) => current.length === 0 || current.every((message) => message.id === 'm-welcome') ? [welcomeMessage] : current);
  }, [messages.length, welcomeMessage]);

  // Auto-scroll chat history viewport to the bottom on new message or when generating status is running
  useEffect(() => {
    if (chatViewportRef.current) {
      chatViewportRef.current.scrollTop = chatViewportRef.current.scrollHeight;
    }
  }, [messages, isAssistantRunning]);

  const runningStages = ['Understanding question...', 'Searching evidence...', 'Reconciling sources...', 'Generating answer...'];

  // Rotate pipeline stages
  useEffect(() => {
    if (!isAssistantRunning) {
      setRunningStageIndex(0);
      return;
    }
    const interval = window.setInterval(() => {
      setRunningStageIndex((idx) => Math.min(idx + 1, runningStages.length - 1));
    }, 1400);
    return () => window.clearInterval(interval);
  }, [isAssistantRunning, runningStages.length]);

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

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isAssistantRunning) return;

    const userMessage: ChatMessage = {
      role: 'user',
      id: `user-${Date.now()}`,
      createdAt: new Date(),
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setTranscript('');
    setIsAssistantRunning(true);
    setRunningStageIndex(0);

    try {
      const activeInputLang = inputLanguage || language;
      const englishMessage = activeInputLang === 'en' ? text : await translateText(text, 'en', activeInputLang);

      const response = await fetch(apiUrl('/api/past/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: englishMessage,
          history: englishHistoryRef.current,
          targetLanguage: activeInputLang,
          associatedBundle,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.details || data?.error || 'AI Assistant query failed');

      const englishReply = String(data?.reply || 'The assistant could not find a grounded answer.');
      englishHistoryRef.current = [...englishHistoryRef.current, { role: 'user', content: englishMessage }, { role: 'assistant', content: englishReply }];

      const reply = language === 'en' ? englishReply : await translatePreservingCitations(englishReply, language);
      const sources = Array.isArray(data?.sources) ? data.sources as CitedSource[] : [];

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          id: `assistant-${Date.now()}`,
          createdAt: new Date(),
          content: reply,
          metadata: { custom: { sources, speechText: '' } },
        },
      ]);
    } catch (error) {
      const reply = error instanceof Error ? error.message : 'The assistant could not complete that request.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          id: `assistant-error-${Date.now()}`,
          createdAt: new Date(),
          content: reply,
          metadata: { custom: { sources: [], speechText: '' } },
        },
      ]);
    } finally {
      setIsAssistantRunning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] bg-white border-l border-[#DDDDDD] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      <audio ref={audioRef} className="hidden" />
      
      {/* Header Panel */}
      <div className="p-4 sm:p-5 border-b border-[#DDDDDD] flex items-center justify-between bg-[#ECF8F8]/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#0F1B29] flex items-center justify-center text-white font-bold shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#0F1B29] flex items-center gap-1.5">
              <span>{t.voiceAssistantTitle}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#ECF8F8] text-[#0F1B29] border border-[#DDDDDD] font-semibold notranslate" translate="no">{activeLangObj.name}</span>
            </h3>
            <p className="text-[11px] text-[#747F8D]">{translate(language, 'assistant.grounded')}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-xl text-[#747F8D] hover:text-[#0F1B29] hover:bg-[#ECF8F8] transition-colors cursor-pointer" aria-label={translate(language, 'common.close')}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Chat Messages Log Viewport */}
      <div ref={chatViewportRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        {messages.map((message) => {
          const isAssistant = message.role === 'assistant';
          const sources = Array.isArray(message.metadata?.custom?.sources) ? message.metadata.custom.sources as CitedSource[] : [];
          const messageSpeechText = message.content;
          const speechText = message.metadata?.custom?.speechText || '';

          return (
            <div key={message.id} className={`flex gap-3 items-start ${isAssistant ? '' : 'flex-row-reverse'}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isAssistant ? 'bg-[#ECF8F8] text-[#0F1B29] border border-[#DDDDDD]' : 'bg-[#0F1B29] text-white'}`}>
                {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className={`space-y-1.5 max-w-[86%] ${isAssistant ? 'text-left' : 'text-right'}`}>
                <div className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${isAssistant ? 'bg-white border border-[#DDDDDD] rounded-tl-none text-[#0F1B29]' : 'bg-[#0F1B29] text-white rounded-tr-none shadow-sm'}`}>
                  {isAssistant ? (
                    <div className="prose prose-sm max-w-none text-slate-800 prose-headings:text-slate-900 prose-a:text-indigo-700 prose-code:text-slate-900 prose-table:text-xs prose-th:bg-slate-100 prose-th:p-2 prose-td:p-2 prose-td:border prose-th:border prose-table:border-collapse">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{messageSpeechText}</ReactMarkdown>
                    </div>
                  ) : (
                    <div>{messageSpeechText}</div>
                  )}
                </div>
                {isAssistant && (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => playTTS(speechText || messageSpeechText)}
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-xl border transition-colors ${isPlayingAudio ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-[#0F1B29] bg-white border-[#DDDDDD] hover:bg-[#ECF8F8] cursor-pointer'}`}
                    >
                      {isPlayingAudio ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      <span>{isPlayingAudio ? translate(language, 'common.stop') : translate(language, 'common.listen')}</span>
                    </button>
                    {sources.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                        <span>{translate(language, 'common.sources')}:</span>
                        {sources.map((source) => (
                          <a key={source.id} href={source.url} target="_blank" rel="noreferrer noopener" title={source.title} className="px-1.5 py-0.5 rounded bg-[#ECF8F8] text-[#0F1B29] border border-[#DDDDDD] hover:bg-[#DDDDDD]/60">
                            [{source.id}]
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loader: Thinking indicator rendering dynamically while request is in flight */}
        {isAssistantRunning && (
          <div className="flex gap-3 items-start animate-in fade-in duration-300">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-[#ECF8F8] text-[#0F1B29] border border-[#DDDDDD] animate-pulse">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="space-y-2 max-w-[86%] text-left">
              <div className="space-y-2 rounded-2xl border border-[#DDDDDD] bg-[#ECF8F8]/60 p-3.5 w-72 sm:w-80 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0F1B29] px-1 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#747F8D]" />
                  <span>{runningStages[runningStageIndex] || translate(language, 'assistant.pipeline')}</span>
                </div>
                <ChatSkeleton />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Composer Input Controls */}
      <div className="p-3 sm:p-4 border-t border-[#DDDDDD] bg-[#ECF8F8]/40 space-y-2">
        {transcript && <div className="text-[11px] text-[#747F8D] px-2">Transcript ready: <span className="font-medium text-[#0F1B29]">{transcript}</span></div>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputValue);
          }}
          className="flex items-end gap-2"
        >
          <AudioRecorderButton
            language={language}
            targetLanguage={language}
            onTranscribed={(text, metadata) => {
              setTranscript(text);
              setInputLanguage(metadata?.detectedLanguage || language);
              setInputValue(text);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            tooltip={translate(language, 'assistant.record')}
            className="p-2 shrink-0 bg-white border border-[#DDDDDD] hover:bg-[#ECF8F8] rounded-xl cursor-pointer"
          />
          <textarea
            ref={inputRef}
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(inputValue);
              }
            }}
            placeholder={translate(language, 'assistant.placeholder', { language: activeLangObj.name })}
            className="min-h-10 max-h-28 flex-1 resize-none px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-white border border-[#DDDDDD] text-[#0F1B29] placeholder:text-slate-400 focus:outline-none focus:border-[#747F8D] focus:ring-2 focus:ring-[#DDDDDD]/40 shadow-sm"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isAssistantRunning}
            className="p-2.5 rounded-xl bg-[#0F1B29] hover:bg-[#0f1b29]/90 disabled:opacity-50 text-white shadow-sm cursor-pointer shrink-0"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIAssistantDrawer;
