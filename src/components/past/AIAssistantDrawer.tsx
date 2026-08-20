import React, { useState, useEffect, useRef } from 'react';
import { EvidenceBundle, CitedSource } from '../../types/disaster';
import {
  X,
  Sparkles,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ExternalLink,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Globe,
} from 'lucide-react';
import { INDIAN_LANGUAGES, getTranslation } from '../../types/language';
import { ChatSkeleton } from '../common/Skeletons';
import { AudioRecorderButton } from '../common/AudioRecorderButton';
import ReactMarkdown from 'react-markdown';

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
  sources?: CitedSource[];
  timestamp: string;
  audioBase64?: string;
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  associatedBundle,
  language,
  onLanguageChange,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<string | null>(null);

  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Audio Playback
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = getTranslation(language);
  const activeLangObj = INDIAN_LANGUAGES.find((l) => l.code === language) || INDIAN_LANGUAGES[0];

  const markdownComponents = {
    h1: ({ children }: any) => <h1 className="text-base font-bold text-slate-900 mt-2">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-sm font-bold text-slate-900 mt-2">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-sm font-semibold text-slate-900 mt-1.5">{children}</h3>,
    p: ({ children }: any) => <p className="leading-relaxed text-slate-800">{children}</p>,
    ul: ({ children }: any) => <ul className="list-disc pl-5 space-y-1 text-slate-800">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal pl-5 space-y-1 text-slate-800">{children}</ol>,
    li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
    a: ({ href, children }: any) => (
      <a href={href} target="_blank" rel="noreferrer noopener" className="text-indigo-700 underline underline-offset-2">
        {children}
      </a>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-indigo-200 pl-3 py-1 text-slate-700 bg-indigo-50/50 rounded-r-lg">{children}</blockquote>
    ),
    code: ({ inline, children }: any) =>
      inline ? (
        <code className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-900 font-mono text-[11px]">{children}</code>
      ) : (
        <code className="block overflow-x-auto p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px]">{children}</code>
      ),
    pre: ({ children }: any) => <pre className="overflow-x-auto">{children}</pre>,
    table: ({ children }: any) => (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] border border-slate-200 rounded-xl overflow-hidden">{children}</table>
      </div>
    ),
    th: ({ children }: any) => <th className="px-2 py-1.5 bg-slate-100 border-b border-slate-200 font-bold text-slate-900">{children}</th>,
    td: ({ children }: any) => <td className="px-2 py-1.5 border-b border-slate-100 align-top">{children}</td>,
  } as const;

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechRecognitionSupported(true);
      const recognizer = new SpeechRecognition();
      recognizer.continuous = false;
      recognizer.interimResults = false;

      // Set language code (e.g. hi-IN, bn-IN, te-IN, ta-IN, en-IN)
      recognizer.lang = language === 'en' ? 'en-IN' : `${language}-IN`;

      recognizer.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputQuery(transcript);
        setIsListening(false);
      };

      recognizer.onerror = () => {
        setIsListening(false);
      };

      recognizer.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognizer;
    }
  }, [language]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'm-welcome',
          role: 'assistant',
          content: associatedBundle
            ? `Hello! I am your Multilingual Disaster Intelligence Assistant. I am grounded in evidence for **${associatedBundle.eventName}**. You can type or speak in **${activeLangObj.name} (${activeLangObj.nativeName})** or English.`
            : `Hello! I am your Multilingual Disaster Intelligence Research Assistant. Ask me anything about Indian historical cyclones, floods, earthquakes, evacuation logistics, or casualty statistics. You can speak in **${activeLangObj.name} (${activeLangObj.nativeName})** or English!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [associatedBundle, language]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pipelineStep]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.lang = language === 'en' ? 'en-IN' : `${language}-IN`;
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Speech recognition start error:', err);
      }
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputQuery.trim() || isProcessing) return;

    const userText = inputQuery.trim();
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsProcessing(true);

    // Dynamic pipeline step simulation
    setPipelineStep('Understanding query context & keywords...');
    setTimeout(() => setPipelineStep('Searching verified Indian news & official records...'), 400);
    setTimeout(() => setPipelineStep('Synthesizing evidence and validating citations...'), 900);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/past/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: historyPayload,
          targetLanguage: language,
          associatedBundle,
        }),
      });

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Information unavailable in the retrieved sources.',
        sources: data.sources || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-err-${Date.now()}`,
          role: 'assistant',
          content: 'Unable to complete AI query at this moment. Please check your connection.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsProcessing(false);
      setPipelineStep(null);
    }
  };

  const playTTS = async (text: string) => {
    try {
      setIsPlayingAudio(true);
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceName: 'Kore' }),
      });

      const data = await res.json();
      if (data.audioBase64) {
        const audioUrl = `data:audio/mp3;base64,${data.audioBase64}`;
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
          audioRef.current.onended = () => setIsPlayingAudio(false);
        }
      } else {
        // Fallback to browser SpeechSynthesis
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text.replace(/\[S\d+\]/g, ''));
          utterance.lang = language === 'en' ? 'en-IN' : `${language}-IN`;
          utterance.onend = () => setIsPlayingAudio(false);
          utterance.onerror = () => setIsPlayingAudio(false);
          window.speechSynthesis.speak(utterance);
        } else {
          setIsPlayingAudio(false);
        }
      }
    } catch (err) {
      console.error('TTS error:', err);
      setIsPlayingAudio(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] bg-white border-l border-slate-200 shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
      <audio ref={audioRef} className="hidden" />

      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <span>{t.voiceAssistantTitle}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold">
                {activeLangObj.name}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Grounded AI with Multilingual Speech Recognition
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Chat Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 items-start ${
              msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-indigo-600 font-bold border border-slate-200'
              }`}
            >
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className={`space-y-1.5 max-w-[85%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div
                className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-none'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="space-y-2">
                    <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="whitespace-pre-line">{msg.content}</span>
                )}
              </div>

              {/* Message Footer: Sources & TTS Audio Button */}
              {msg.role === 'assistant' && (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => playTTS(msg.content)}
                    disabled={isPlayingAudio}
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{isPlayingAudio ? 'Speaking...' : 'Listen'}</span>
                  </button>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                      <span>Sources:</span>
                      {msg.sources.map((s) => (
                        <a
                          key={s.id}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100"
                          title={s.title}
                        >
                          [{s.id}]
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Dynamic Pipeline Status Indicator */}
        {isProcessing && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 animate-pulse">
            <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>{pipelineStep || 'Grounded Intelligence synthesis in progress...'}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input & Voice Controls */}
      <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 space-y-2">
        {isListening && (
          <div className="flex items-center justify-center gap-2 py-1 px-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-600"></span>
            <span>Listening in {activeLangObj.name} ({activeLangObj.nativeName})... Speak now!</span>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* Groq AI Audio Voice Recorder */}
          <AudioRecorderButton
            language={language}
            onTranscribed={(transcript) => {
              setInputQuery(transcript);
            }}
            tooltip="Record and transcribe speech with Groq Whisper"
            className="p-2"
          />

          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={
              isListening
                ? 'Listening...'
                : `Ask in ${activeLangObj.name} or English...`
            }
            className="flex-1 px-3.5 py-2 text-xs sm:text-sm rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-sm"
          />

          <button
            type="submit"
            disabled={!inputQuery.trim() || isProcessing}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold transition-all shadow-sm shadow-indigo-100"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
