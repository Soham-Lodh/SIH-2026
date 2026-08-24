import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EvidenceBundle, CitedSource } from '../../types/disaster';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  ShieldAlert,
  Users,
  Building,
  Coins,
  Truck,
  HeartHandshake,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Volume2,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  FileCheck,
  VolumeX,
} from 'lucide-react';
import { getTranslation } from '../../types/language';
import { useTranslateBatch } from '../../hooks/useTranslateBatch';
import { translateEvidenceBundle } from '../../lib/googleTranslate';

interface EventDetailViewProps {
  bundle: EvidenceBundle;
  onBack: () => void;
  onOpenChatWithEvent: (bundle: EvidenceBundle) => void;
  onPlayTTS: (text: string) => void;
  language: string;
}

export const EventDetailView: React.FC<EventDetailViewProps> = ({
  bundle: sourceBundle,
  onBack,
  onOpenChatWithEvent,
  onPlayTTS,
  language,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const t = getTranslation(language);
  const translatableFields = useMemo(() => ({
    eventName: sourceBundle.eventName,
    location: sourceBundle.location,
    state: sourceBundle.state,
    whatHappened: sourceBundle.whatHappened,
    affectedAreas: sourceBundle.affectedAreas,
    humanImpact: sourceBundle.humanImpact,
    infrastructureDamage: sourceBundle.infrastructureDamage,
    economicImpact: sourceBundle.economicImpact,
    governmentResponse: sourceBundle.governmentResponse,
    rescueRelief: sourceBundle.rescueRelief,
    recovery: sourceBundle.recovery,
    sourceAssessment: sourceBundle.sourceAssessment,
    reportedCasualties: sourceBundle.reportedCasualties,
    reportedDamage: sourceBundle.reportedDamage,
  }), [sourceBundle]);
  const { result: translatedFields } = useTranslateBatch(translatableFields, language);
  const [translatedBundle, setTranslatedBundle] = useState<EvidenceBundle | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (language === 'en') {
      setTranslatedBundle(sourceBundle);
      return () => { cancelled = true; };
    }
    void translateEvidenceBundle(sourceBundle, language).then((value) => {
      if (!cancelled) setTranslatedBundle(value);
    });
    return () => { cancelled = true; };
  }, [sourceBundle, language]);

  const bundle: EvidenceBundle = translatedBundle
    ? { ...translatedBundle, ...(translatedFields || {}) }
    : { ...sourceBundle, ...(translatedFields || {}) };

  const isMeaningfulText = (text?: string | null) => {
    if (!text) return false;
    const normalized = text.trim().toLowerCase();
    if (!normalized) return false;
    const placeholders = [
      'information unavailable',
      'no information available',
      'details were not clearly quantified',
      'details were referenced',
      'were referenced in the retrieved source coverage',
      'were summarized in the retrieved source coverage',
      'no clear casualty details',
      'no casualty details',
      'no damage details',
      'no recovery details',
      'were not clearly quantified',
      'coverage indicates',
      'not available',
    ];
    return !placeholders.some((phrase) => normalized.includes(phrase));
  };

  const handleCopySummary = async () => {
    const text = `${bundle.eventName} (${bundle.disasterType})\nLocation: ${bundle.location}, ${bundle.state}\nPeriod: ${bundle.dateRange}\n\nSUMMARY:\n${bundle.whatHappened}\n\nHUMAN IMPACT:\n${bundle.humanImpact}\n\nDAMAGE:\n${bundle.infrastructureDamage}\n\nGOVERNMENT RESPONSE:\n${bundle.governmentResponse}\n\nSOURCES:\n${bundle.sources.map((s) => `[${s.id}] ${s.title} (${s.publisher})`).join('\n')}\n\nSynthesized by Disaster Intelligence Platform India`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  const buildSpeechText = () =>
    [
      bundle.eventName,
      bundle.dateRange,
      isMeaningfulText(bundle.whatHappened) ? bundle.whatHappened : '',
      isMeaningfulText(bundle.affectedAreas) ? bundle.affectedAreas : '',
      isMeaningfulText(bundle.humanImpact) ? bundle.humanImpact : '',
      isMeaningfulText(bundle.infrastructureDamage) ? bundle.infrastructureDamage : '',
      isMeaningfulText(bundle.economicImpact) ? bundle.economicImpact : '',
      isMeaningfulText(bundle.governmentResponse) ? bundle.governmentResponse : '',
      isMeaningfulText(bundle.rescueRelief) ? bundle.rescueRelief : '',
      isMeaningfulText(bundle.recovery) ? bundle.recovery : '',
    ]
      .filter(Boolean)
      .join('. ')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\[(S\d+)\]/gi, ' ')
      .replace(/[*_`>#-]+/g, ' ')
      .replace(/\r?\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const toggleSpeech = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking || window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        utteranceRef.current = null;
        setIsSpeaking(false);
        return;
      }

      const speechText = buildSpeechText();
      if (!speechText) return;

      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = language === 'en' ? 'en-IN' : `${language}-IN`;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      utteranceRef.current = utterance;
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
      return;
    }

    onPlayTTS(buildSpeechText());
  };

  const hasSourceAssessment = isMeaningfulText(bundle.sourceAssessment);
  const meaningfulConflicts = (bundle.conflictingReports || []).filter((conflict) =>
    isMeaningfulText(conflict.topic) && isMeaningfulText(conflict.details),
  );
  const hasConflicts = meaningfulConflicts.length > 0;

  // Render text with clickable citation badges [S1], [S2]
  const renderWithCitations = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\[S\d+\])/g);

    return (
      <span>
        {parts.map((part, idx) => {
          const match = part.match(/\[(S\d+)\]/);
          if (match) {
            const sourceId = match[1];
            const source = bundle.sources.find((s) => s.id === sourceId);
            return (
              <a
                key={idx}
                href={source?.url || `#source-${sourceId}`}
                target={source?.url ? '_blank' : '_self'}
                rel="noreferrer noopener"
                className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
                title={source ? `${source.title} (${source.publisher})` : `Source ${sourceId}`}
              >
                {part}
              </a>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Historical Research</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSpeech}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:border-indigo-200 border border-slate-200 text-xs font-semibold text-indigo-600 transition-colors"
            title={isSpeaking ? 'Stop reading' : 'Listen to synthesized speech'}
          >
            {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{isSpeaking ? 'Stop' : 'Listen Audio'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopySummary}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              copied
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
          </button>

          <button
            type="button"
          onClick={() => onOpenChatWithEvent(sourceBundle)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t.askAIAssistant}</span>
          </button>
        </div>
      </div>

      {/* Hero Event Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold font-mono uppercase">
            {bundle.disasterType}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-mono font-medium">
            {bundle.evidenceStatus}
          </span>
          <span className="text-xs text-slate-500 flex items-center gap-1 ml-auto">
            <Clock className="w-3.5 h-3.5" />
            <span>Synthesized: {new Date(bundle.synthesizedAt).toLocaleDateString()}</span>
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          {bundle.eventName}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-indigo-600" />
            <span>{bundle.location}, {bundle.state}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>{bundle.dateRange}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <span>{bundle.sources.length} Grounded Media Sources</span>
          </div>
        </div>
      </div>

      {/* 12 Detailed Evidence Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {isMeaningfulText(bundle.whatHappened) && (
          <div className="md:col-span-2 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
              <span>Event Synthesis & What Happened</span>
            </h3>
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {renderWithCitations(bundle.whatHappened)}
            </div>
          </div>
        )}

        <div className="md:col-span-2 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>Chronological Incident Timeline</span>
          </h3>
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {bundle.timeline.map((step, idx) => (
              <div key={idx} className="relative space-y-1">
                <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white"></span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-600">{step.date}</span>
                  <h5 className="font-bold text-xs text-slate-900">{step.event}</h5>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {renderWithCitations(step.description)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {isMeaningfulText(bundle.affectedAreas) && (
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600" />
              <span>Affected Geographic Areas</span>
            </h3>
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {renderWithCitations(bundle.affectedAreas)}
            </div>
          </div>
        )}

        {isMeaningfulText(bundle.humanImpact) && (
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-rose-600" />
              <span>Human Impact & Casualties</span>
            </h3>
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {renderWithCitations(bundle.humanImpact)}
            </div>
          </div>
        )}

        {isMeaningfulText(bundle.infrastructureDamage) && (
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-amber-600" />
              <span>Infrastructure Damage</span>
            </h3>
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {renderWithCitations(bundle.infrastructureDamage)}
            </div>
          </div>
        )}

        {isMeaningfulText(bundle.economicImpact) && (
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-600" />
              <span>Economic Impact</span>
            </h3>
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {renderWithCitations(bundle.economicImpact)}
            </div>
          </div>
        )}

        {isMeaningfulText(bundle.governmentResponse) && (
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-600" />
              <span>Government & NDRF Response</span>
            </h3>
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {renderWithCitations(bundle.governmentResponse)}
            </div>
          </div>
        )}

        {isMeaningfulText(bundle.rescueRelief) && (
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-pink-600" />
              <span>Rescue & Relief Operations</span>
            </h3>
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {renderWithCitations(bundle.rescueRelief)}
            </div>
          </div>
        )}

        {isMeaningfulText(bundle.recovery) && (
          <div className="md:col-span-2 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Rehabilitation & Long-Term Recovery</span>
            </h3>
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {renderWithCitations(bundle.recovery)}
            </div>
          </div>
        )}

        {(hasSourceAssessment || hasConflicts) && (
          <div className="md:col-span-2 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-indigo-600" />
              <span>Source Assessment & Evidence Verification</span>
            </h3>
            {hasSourceAssessment && (
              <p className="text-xs text-slate-600 leading-relaxed">
                {bundle.sourceAssessment}
              </p>
            )}

            {hasConflicts && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h5 className="font-bold text-xs text-amber-800">Reconciled Conflicting Dispatches:</h5>
                {meaningfulConflicts.map((conflict, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                    <span className="font-bold text-slate-900">{conflict.topic}</span>
                    <p className="text-slate-600">{renderWithCitations(conflict.details)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section 12: Grounded Citations Reference Table */}
        <div className="md:col-span-2 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>Retrieved Sources & Attributions ({bundle.sources.length})</span>
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Citation markers such as [S1] and [S2] refer to the source entries below. Each entry links directly to the original article.
          </p>
          <div className="divide-y divide-slate-100">
            {bundle.sources.map((source) => (
              <div key={source.id} id={`source-${source.id}`} className="py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-bold text-xs border border-indigo-100">
                      [{source.id}]
                    </span>
                    <h5 className="font-bold text-xs sm:text-sm text-slate-900">{source.title}</h5>
                  </div>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 shrink-0 font-medium transition-colors"
                  >
                    <span>Original Article</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-3">
                  <span className="font-semibold text-slate-700">{source.publisher}</span>
                  <span>Published: {new Date(source.publishedAt).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {source.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

