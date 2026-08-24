import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EvidenceBundle, DisasterCategory } from '../../types/disaster';
import { EventDetailView } from './EventDetailView';
import { CompareModal } from './CompareModal';
import { AIAssistantDrawer } from './AIAssistantDrawer';
import { EventCardSkeleton } from '../common/Skeletons';
import { AudioRecorderButton } from '../common/AudioRecorderButton';
import { HistoricalDisasterItem } from '../../data/historicalDisasters';
import { apiUrl } from '../../lib/api';
import { translateText } from '../../lib/googleTranslate';
import { useTranslateContent } from '../../hooks/useTranslateContent';
import {
  Search,
  Sparkles,
  Scale,
  X,
  Plus,
  Check,
  ArrowRight,
  ArrowUpDown,
  Calendar,
  Users,
  Building,
  Copy,
  MapPin,
  Layers,
  Flame,
  Waves,
  Mountain,
  Zap,
  Activity,
  History,
  ShieldCheck,
  ExternalLink,
  Download,
  FileSpreadsheet,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { getTranslation, hazardLabel, translate } from '../../types/language';

interface PastWorkspaceProps {
  language: string;
  isVoiceAssistantOpen?: boolean;
  onCloseVoiceAssistant?: () => void;
  onOpenVoiceAssistant?: () => void;
  onLanguageChange?: (lang: string) => void;
}

export type SortOption = 'oldest' | 'recent' | 'casualties' | 'sources' | 'alphabetical';
export type DecadeFilter = 'all' | '1990s' | '2000s' | '2010s' | '2020s';

const TranslatedText: React.FC<{ text: string; language: string }> = ({ text, language }) => {
  const { translated } = useTranslateContent(text, language);
  return <>{translated}</>;
};

const CATEGORIES: { label: string; value: string; icon: React.FC<{ className?: string }> }[] = [
  { label: 'All Hazards', value: 'all', icon: Layers },
  { label: 'Cyclones', value: 'Cyclone', icon: Activity },
  { label: 'Floods & Deluges', value: 'Flood', icon: Waves },
  { label: 'Earthquakes', value: 'Earthquake', icon: Zap },
  { label: 'Tsunamis', value: 'Tsunami', icon: Waves },
  { label: 'Landslides & Avalanches', value: 'Landslide', icon: Mountain },
  { label: 'Heat & Extreme Weather', value: 'Heat Wave', icon: Flame },
];

const STATES = [
  'All States',
  'Odisha',
  'Kerala',
  'Uttarakhand',
  'Gujarat',
  'West Bengal',
  'Tamil Nadu',
  'Maharashtra',
  'Himachal Pradesh',
  'Bihar',
  'Andhra Pradesh',
  'Assam',
  'Rajasthan',
  'Delhi',
  'Punjab',
];

export const PastWorkspace: React.FC<PastWorkspaceProps> = ({
  language,
  isVoiceAssistantOpen = false,
  onCloseVoiceAssistant,
  onOpenVoiceAssistant,
  onLanguageChange,
}) => {
  const [evidenceBundles, setEvidenceBundles] = useState<HistoricalDisasterItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('All States');
  const [selectedDecade, setSelectedDecade] = useState<DecadeFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [isArchiveLoading, setIsArchiveLoading] = useState(true);
  const [isSearchingLive, setIsSearchingLive] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<EvidenceBundle | null>(null);
  const [compareList, setCompareList] = useState<EvidenceBundle[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [localVoiceOpen, setLocalVoiceOpen] = useState(false);
  const [activeChatBundle, setActiveChatBundle] = useState<EvidenceBundle | null>(null);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeLiveQueryRef = useRef('');

  const t = getTranslation(language);

  const deriveYear = (bundle: EvidenceBundle) => {
    const match = bundle.dateRange?.match(/\b(19\d\d|20\d\d)\b/)?.[0];
    if (match) return parseInt(match, 10);
    return new Date(bundle.synthesizedAt).getFullYear();
  };

  const deriveCasualtyScore = (bundle: EvidenceBundle) => {
    const match = bundle.reportedCasualties?.match(/(\d[\d,]*)/);
    if (!match) return 0;
    return parseInt(match[1].replace(/,/g, ''), 10) || 0;
  };

  const isNoLiveSourcesMessage = (message: string | null) =>
    Boolean(message && /no live .*sources/i.test(message));

  useEffect(() => {
    let cancelled = false;

    const loadArchive = async () => {
      setIsArchiveLoading(true);
      setArchiveError(null);

      try {
        const params = new URLSearchParams();
        if (selectedCategory !== 'all') params.set('category', selectedCategory);
        if (selectedState !== 'All States') params.set('state', selectedState);
        if (selectedDecade !== 'all') params.set('decade', selectedDecade);

        const archiveUrl = params.toString() ? `/api/past/archive?${params.toString()}` : '/api/past/archive';
        const res = await fetch(apiUrl(archiveUrl));
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.details || data?.error || 'Failed to load recent archive');
        }

        const items = Array.isArray(data?.items) ? data.items : [];
        if (cancelled) return;

        setEvidenceBundles(items);
      } catch (error) {
        if (!cancelled) {
          setArchiveError((error as Error).message || 'Failed to load recent archive');
        }
      } finally {
        if (!cancelled) {
          setIsArchiveLoading(false);
        }
      }
    };

    void loadArchive();

    return () => {
      cancelled = true;
    };
  // Do not reload archive data for a UI-only locale switch.
  }, [selectedCategory, selectedState, selectedDecade]);

  useEffect(() => {
    if (selectedBundle) {
      setSelectedBundle(null);
    }
  }, [selectedCategory, selectedState, selectedDecade]);

  const handleLiveQuerySearch = async (query: string) => {
    const q = query.trim();
    if (!q) return;

    setIsSearchingLive(true);
    setSearchError(null);
    activeLiveQueryRef.current = q;

    try {
      const englishQuery = language === 'en' ? q : await translateText(q, 'en');
      const res = await fetch(apiUrl('/api/past/search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: englishQuery,
          category: selectedCategory === 'all' ? undefined : selectedCategory,
          state: selectedState === 'All States' ? undefined : selectedState,
          targetLanguage: 'en',
        }),
      });

        const data = await res.json();
        if (!res.ok) {
          const message = data?.details || data?.error || 'Failed to retrieve live dossier';
          if (/no live .*sources/i.test(message)) {
          setSearchError('No matching sources were found for this query. Try a broader disaster name, district, or state.');
            return;
          }
          throw new Error(message);
        }

        if (data?.noResults || !data?.bundle) {
          setSearchError('No matching sources were found for this query. Try a broader disaster name, district, or state.');
          return;
        }

      const year = deriveYear(data.bundle);
      const decade: DecadeFilter =
        year < 2000 ? '1990s' : year < 2010 ? '2000s' : year < 2020 ? '2010s' : '2020s';

      const enriched: HistoricalDisasterItem = {
        ...data.bundle,
        year,
        numericCasualties: deriveCasualtyScore(data.bundle),
        decade,
      };

      setEvidenceBundles((prev) => {
        const filtered = prev.filter((item) => item.eventName.toLowerCase() !== enriched.eventName.toLowerCase());
        return [enriched, ...filtered];
      });
      setSelectedBundle(enriched);
    } catch (error) {
      const message = (error as Error).message || 'Search failed';
      setSearchError(
        /no live .*sources/i.test(message)
          ? 'No matching sources were found for this query. Try a broader disaster name, district, or state.'
          : message
      );
    } finally {
      setIsSearchingLive(false);
    }
  };

  const handlePlayTTS = async (text: string) => {
    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\[(S\d+)\]/gi, ' ')
      .replace(/[*_`>#-]+/g, ' ')
      .replace(/\r?\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    try {
      const res = await fetch(apiUrl('/api/tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voiceName: 'Kore' }),
      });

      const data = await res.json().catch(() => null);
      if (data?.audioBase64) {
        const audio = audioRef.current || new Audio();
        audioRef.current = audio;
        audio.src = `data:audio/mp3;base64,${data.audioBase64}`;
        await audio.play();
        return;
      }

      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = language === 'en' ? 'en-IN' : `${language}-IN`;
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('TTS playback failed:', error);
    }
  };

  const filteredAndSortedEvents = useMemo(() => {
    let result = [...evidenceBundles];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((event) =>
        [
          event.eventName,
          event.state,
          event.location,
          event.disasterType,
          String(event.year),
          event.whatHappened,
          event.reportedCasualties,
          event.reportedDamage,
        ].some((value) => value.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'all') {
      result = result.filter((event) => {
        if (selectedCategory === 'Landslide') {
          return event.disasterType === 'Landslide' || event.disasterType === 'Avalanche';
        }
        return event.disasterType.toLowerCase().includes(selectedCategory.toLowerCase());
      });
    }

    if (selectedState !== 'All States') {
      result = result.filter((event) => event.state.toLowerCase().includes(selectedState.toLowerCase()));
    }

    if (selectedDecade !== 'all') {
      result = result.filter((event) => event.decade === selectedDecade);
    }

    result.sort((a, b) => {
      if (sortOption === 'oldest') return a.year - b.year;
      if (sortOption === 'recent') return b.year - a.year;
      if (sortOption === 'casualties') return (b.numericCasualties || 0) - (a.numericCasualties || 0);
      if (sortOption === 'sources') return (b.sources?.length || 0) - (a.sources?.length || 0);
      if (sortOption === 'alphabetical') return a.eventName.localeCompare(b.eventName);
      return 0;
    });

    return result;
  }, [evidenceBundles, searchQuery, selectedCategory, selectedState, selectedDecade, sortOption]);

  const toggleCompare = (bundle: EvidenceBundle) => {
    const exists = compareList.some((item) => item.id === bundle.id);
    if (exists) {
      setCompareList(compareList.filter((item) => item.id !== bundle.id));
      return;
    }

    if (compareList.length >= 4) {
      alert(translate(language, 'history.maxCompare'));
      return;
    }

    setCompareList([...compareList, bundle]);
  };

  const handleOpenChatForEvent = (bundle: EvidenceBundle) => {
    setActiveChatBundle(bundle);
    if (onOpenVoiceAssistant) {
      onOpenVoiceAssistant();
    } else {
      setLocalVoiceOpen(true);
    }
  };

  const handleCopyCardSummary = async (bundle: EvidenceBundle, e: React.MouseEvent) => {
    e.stopPropagation();
    const summary = `${bundle.eventName} (${bundle.dateRange})\nLocation: ${bundle.location}, ${bundle.state}\nCasualties: ${bundle.reportedCasualties}\nDamage: ${bundle.reportedDamage}\nOverview: ${bundle.whatHappened}\nSources: ${bundle.sources.map((s) => `[${s.id}] ${s.title} (${s.publisher})`).join(', ')}`;
    try {
      await navigator.clipboard.writeText(summary);
      alert('Disaster evidence summary copied to clipboard with source citations!');
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const renderCard = (bundle: HistoricalDisasterItem) => {
    const isSelectedForCompare = compareList.some((item) => item.id === bundle.id);

    return (
      <div
        key={bundle.id}
        onClick={() => setSelectedBundle(bundle)}
        className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md shadow-xs transition-all flex flex-col justify-between space-y-4 cursor-pointer group relative"
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-mono font-bold">
                {bundle.year}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono uppercase border bg-slate-100 text-slate-700 border-slate-200">
              {hazardLabel(language, bundle.disasterType)}
              </span>
              <span className="text-xs text-slate-500 font-medium"><TranslatedText text={bundle.state} language={language} /></span>
            </div>

            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 shrink-0">
              {translate(language, 'history.sourcesCount', { count: bundle.sources?.length || 0 })}
            </span>
          </div>

          <div>
            <h4 className="font-bold text-base sm:text-lg text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
              <TranslatedText text={bundle.eventName} language={language} />
            </h4>
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
              <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>
                <TranslatedText text={`${bundle.location}, ${bundle.state}`} language={language} />
              </span>
              <span className="text-slate-300">•</span>
              <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <TranslatedText text={bundle.dateRange} language={language} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-100 space-y-0.5">
            <span className="text-rose-700 font-bold text-[10px] uppercase flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-rose-600" />
              <span>{translate(language, 'history.casualties')}</span>
            </span>
            <p className="text-slate-800 line-clamp-2 leading-relaxed text-xs font-medium">
              <TranslatedText text={bundle.reportedCasualties} language={language} />
            </p>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 space-y-0.5">
            <span className="text-amber-800 font-bold text-[10px] uppercase flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-amber-600" />
              <span>{translate(language, 'history.damage')}</span>
            </span>
            <p className="text-slate-800 line-clamp-2 leading-relaxed text-xs font-medium">
              <TranslatedText text={bundle.reportedDamage} language={language} />
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
          <TranslatedText text={bundle.whatHappened} language={language} />
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCompare(bundle);
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isSelectedForCompare
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              }`}
            >
              {isSelectedForCompare ? <Check className="w-3.5 h-3.5 text-white" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{isSelectedForCompare ? translate(language, 'history.inCompare') : translate(language, 'history.addCompare')}</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenChatForEvent(bundle);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold text-indigo-700 flex items-center gap-1 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>{translate(language, 'history.askAi')}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => handleCopyCardSummary(bundle, e)}
              className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
              title={translate(language, 'history.copySummary')}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:text-indigo-800">
              <span>{translate(language, 'history.liveDossier')}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (selectedBundle) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
        <EventDetailView
          bundle={selectedBundle}
          onBack={() => setSelectedBundle(null)}
          onOpenChatWithEvent={handleOpenChatForEvent}
          onPlayTTS={handlePlayTTS}
          language={language}
        />

        <AIAssistantDrawer
          isOpen={isVoiceAssistantOpen || localVoiceOpen}
          onClose={() => {
            onCloseVoiceAssistant?.();
            setLocalVoiceOpen(false);
          }}
          associatedBundle={activeChatBundle || selectedBundle}
          language={language}
          onLanguageChange={onLanguageChange}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg sm:text-xl text-slate-900 flex items-center gap-2">
                  <span>Indian Historical Disaster Intelligence Archive</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono font-bold border border-indigo-100">
                    Current Evidence
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Build a sourced dossier from current evidence and AI synthesis, then compare events or open the evidence view.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                title="Download report"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Report</span>
                <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
              </button>

              {isDownloadOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                  <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Export Current Results ({filteredAndSortedEvents.length})
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDownloadOpen(false);
                      alert('CSV export can be wired back in if you want the live report file next.');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left rounded-xl hover:bg-slate-50 text-slate-700 font-medium transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900">CSV</div>
                      <div className="text-[10px] text-slate-500">Live dossier export</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDownloadOpen(false);
                      window.print();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left rounded-xl hover:bg-slate-50 text-slate-700 font-medium transition-colors"
                  >
                    <Printer className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900">Print / PDF</div>
                      <div className="text-[10px] text-slate-500">Browser print view</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Grounded Evidence Engine</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={translate(language, 'history.searchPlaceholder')}
              className="w-full pl-10 pr-20 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="absolute right-2 flex items-center gap-1">
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
              <AudioRecorderButton
                language={language}
                targetLanguage={language}
                onTranscribed={(transcript) => {
                  setSearchQuery(transcript);
                  void handleLiveQuerySearch(transcript);
                }}
                tooltip="Speak disaster query in your preferred language"
                className="scale-90"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={isSearchingLive || !searchQuery.trim()}
            onClick={() => void handleLiveQuerySearch(searchQuery)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm shadow-indigo-100 shrink-0"
            title="Search current evidence and synthesize a dossier"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSearchingLive ? 'Synthesizing Archive...' : 'Search Evidence'}</span>
          </button>
        </div>

        {searchError && (
          <div
            className={`p-3 rounded-xl text-xs font-medium ${
              isNoLiveSourcesMessage(searchError)
                ? 'border border-amber-200 bg-amber-50 text-amber-800'
                : 'border border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {searchError}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
              <span>Sort Order:</span>
            </span>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer text-xs"
            >
              <option value="oldest">Oldest to Recent</option>
              <option value="recent">Most Recent to Oldest</option>
              <option value="casualties">Highest Casualties / Impact</option>
              <option value="sources">Most Sources First</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>State:</span>
            </span>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer text-xs"
            >
              {STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {(['all', '1990s', '2000s', '2010s', '2020s'] as DecadeFilter[]).map((decade) => (
              <button
                key={decade}
                type="button"
                onClick={() => setSelectedDecade(decade)}
                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors ${
                  selectedDecade === decade
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {decade === 'all' ? 'All Eras' : decade}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {archiveError && !evidenceBundles.length && !isArchiveLoading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Recent archive could not be loaded right now. Current evidence search still works, and the page will recover when the service is reachable.
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2 font-medium">
          <span className="font-bold text-slate-900 text-sm">
            {filteredAndSortedEvents.length > 0
              ? `Showing ${filteredAndSortedEvents.length} live dossiers`
              : 'No dossiers loaded yet'}
          </span>
        </div>

        {(searchQuery || selectedCategory !== 'all' || selectedState !== 'All States' || selectedDecade !== 'all') && (
          <button
            type="button"
              onClick={() => {
                setSearchQuery('');
                activeLiveQueryRef.current = '';
                setSelectedCategory('all');
                setSelectedState('All States');
                setSelectedDecade('all');
                setSortOption('oldest');
              }}
            className="text-indigo-600 hover:text-indigo-800 font-semibold underline"
          >
            Reset All Filters
          </button>
        )}
      </div>

      {(isArchiveLoading || isSearchingLive) && <EventCardSkeleton />}

      {filteredAndSortedEvents.length === 0 && !isArchiveLoading && !isSearchingLive ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3 shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900">No dossier yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Search any disaster event, district, or state and we will synthesize a single cited dossier and add it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredAndSortedEvents.map(renderCard)}
        </div>
      )}

      {compareList.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-white border border-indigo-200 rounded-2xl p-3 sm:p-4 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-indigo-600" />
            <div className="text-xs">
              <span className="font-bold text-slate-900 block">
                {compareList.length} Disaster Events Selected
              </span>
              <span className="text-[11px] text-slate-500">
                {compareList.length < 2 ? 'Select 1 more event to launch comparison matrix' : 'Ready for cross-event matrix analysis'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={compareList.length < 2}
              onClick={() => setIsCompareModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>{t.compareNow}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setCompareList([])}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
              title="Clear Selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {isCompareModalOpen && (
        <CompareModal
          bundles={compareList}
          onClose={() => setIsCompareModalOpen(false)}
          language={language}
        />
      )}

      <AIAssistantDrawer
        isOpen={isVoiceAssistantOpen || localVoiceOpen}
        onClose={() => {
          onCloseVoiceAssistant?.();
          setLocalVoiceOpen(false);
        }}
        associatedBundle={activeChatBundle}
        language={language}
        onLanguageChange={onLanguageChange}
      />
    </div>
  );
};

