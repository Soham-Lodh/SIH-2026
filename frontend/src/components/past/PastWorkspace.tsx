import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EvidenceBundle, DisasterCategory } from '../../types/disaster';
import { EventDetailView } from './EventDetailView';
import { CompareModal } from './CompareModal';
import { AIAssistantDrawer } from './AIAssistantDrawer';
import { EventCardSkeleton } from '../common/Skeletons';
import { AudioRecorderButton } from '../common/AudioRecorderButton';
import { HistoricalDisasterItem } from '../../data/historicalDisasters';
import { apiUrl } from '../../lib/api';
import { formatDisasterDate } from '../../lib/dateFormat';
import { translateText } from '../../lib/googleTranslate';
import { useTranslateContent } from '../../hooks/useTranslateContent';
import { getPastArchive } from '../../lib/pastCache';
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
  Printer,
  ChevronDown,
  Filter,
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
  const [appliedFilters, setAppliedFilters] = useState({
    category: 'all',
    state: 'All States',
    decade: 'all' as DecadeFilter,
  });
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [isArchiveLoading, setIsArchiveLoading] = useState(true);
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);
  const [isSearchingLive, setIsSearchingLive] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<EvidenceBundle | null>(null);
  const [compareList, setCompareList] = useState<EvidenceBundle[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [localVoiceOpen, setLocalVoiceOpen] = useState(false);
  const [activeChatBundle, setActiveChatBundle] = useState<EvidenceBundle | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeLiveQueryRef = useRef('');

  const t = getTranslation(language);

  const deriveYear = (bundle: EvidenceBundle) => {
    if (bundle.eventDate) {
      const year = new Date(bundle.eventDate).getFullYear();
      if (Number.isFinite(year)) return year;
    }
    const match = bundle.dateRange?.match(/\b(19\d\d|20\d\d)\b/)?.[0];
    if (match) return parseInt(match, 10);
    return new Date(bundle.synthesizedAt).getFullYear();
  };

  const deriveCasualtyScore = (bundle: EvidenceBundle) => {
    if (bundle.numericCasualtiesRange) return bundle.numericCasualtiesRange.max;
    const match = bundle.reportedCasualties?.match(/(\d[\d,]*)/);
    if (!match) return 0;
    return parseInt(match[1].replace(/,/g, ''), 10) || 0;
  };

  const isNoLiveSourcesMessage = (message: string | null) =>
    Boolean(message && /no live .*sources/i.test(message));

  const isMeaningfulEvidenceText = (text?: string | null) => {
    if (!text) return false;
    const normalized = text.replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalized.length < 20) return false;
    return ![
      'information unavailable',
      'details were not clearly quantified',
      'details were referenced',
      'were referenced in the retrieved source coverage',
      'were summarized in the retrieved source coverage',
      'documented in source coverage',
      'documented in cited journalism',
      'not available',
    ].some((phrase) => normalized.includes(phrase));
  };

  useEffect(() => {
    let cancelled = false;

    const loadArchive = async () => {
      setIsArchiveLoading(true);
      setArchiveError(null);

      try {
        const data = await getPastArchive();
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
  }, []);

  const handleApplyFilters = async () => {
    setIsApplyingFilter(true);
    setIsArchiveLoading(true);
    setArchiveError(null);
    setSearchError(null);
    setSelectedBundle(null);
    setSearchQuery('');
    activeLiveQueryRef.current = '';

    const nextFilters = {
      category: selectedCategory,
      state: selectedState,
      decade: selectedDecade,
    };

    try {
      const res = await fetch(apiUrl('/api/past/filter-search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...nextFilters,
          language,
          limit: 100,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.details || data?.error || 'Failed to apply archive filters');
      }

      setEvidenceBundles(Array.isArray(data?.items) ? data.items : []);
      setAppliedFilters(nextFilters);
    } catch (error) {
      setArchiveError((error as Error).message || 'Failed to apply archive filters');
    } finally {
      setIsApplyingFilter(false);
      setIsArchiveLoading(false);
    }
  };

  const handleResetFilters = async () => {
    setSearchQuery('');
    activeLiveQueryRef.current = '';
    setSelectedCategory('all');
    setSelectedState('All States');
    setSelectedDecade('all');
    setAppliedFilters({ category: 'all', state: 'All States', decade: 'all' });
    setSortOption('recent');
    setSelectedBundle(null);
    setArchiveError(null);
    setIsArchiveLoading(true);

    try {
      const data = await getPastArchive();
      setEvidenceBundles(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      setArchiveError((error as Error).message || 'Failed to reset archive filters');
    } finally {
      setIsArchiveLoading(false);
    }
  };

  const handleLiveQuerySearch = async (query: string) => {
    const q = query.trim();
    if (!q) return;

    setIsSearchingLive(true);
    setSearchError(null);
    activeLiveQueryRef.current = q;

    try {
      const englishQuery = language === 'en' ? q : await translateText(q, 'en', language);
      const res = await fetch(apiUrl('/api/past/search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: englishQuery,
          category: appliedFilters.category === 'all' ? undefined : appliedFilters.category,
          state: appliedFilters.state === 'All States' ? undefined : appliedFilters.state,
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
        setSearchError(data?.details || 'No sufficiently relevant historical evidence was retrieved. Try a broader disaster name, district, or state.');
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

    result.sort((a, b) => {
      const aTime = a.eventDate ? new Date(a.eventDate).getTime() : NaN;
      const bTime = b.eventDate ? new Date(b.eventDate).getTime() : NaN;
      const chronological = Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime
        ? aTime - bTime
        : a.year - b.year;
      if (sortOption === 'oldest') return chronological;
      if (sortOption === 'recent') return -chronological;
      if (sortOption === 'casualties') return (b.numericCasualties || 0) - (a.numericCasualties || 0);
      if (sortOption === 'sources') return (b.sources?.length || 0) - (a.sources?.length || 0);
      if (sortOption === 'alphabetical') return a.eventName.localeCompare(b.eventName);
      return 0;
    });

    return result;
  }, [evidenceBundles, searchQuery, sortOption]);

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
    const hasCasualties = isMeaningfulEvidenceText(bundle.reportedCasualties);
    const hasDamage = isMeaningfulEvidenceText(bundle.reportedDamage);
    const hasImpactSummary = hasCasualties || hasDamage;

    return (
      <div
        key={bundle.id}
        onClick={() => setSelectedBundle(bundle)}
        className="p-5 sm:p-6 rounded-2xl bg-white border border-[#DDDDDD] hover:border-[#747F8D] hover:shadow-md transition-all flex flex-col justify-between space-y-4 cursor-pointer group relative"
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-[#ECF8F8] text-[#0F1B29] border border-[#DDDDDD] text-xs font-mono font-bold">
                {bundle.year}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono uppercase border bg-white text-[#0F1B29] border-[#DDDDDD]">
                {hazardLabel(language, bundle.disasterType)}
              </span>
              <span className="text-xs text-[#747F8D] font-medium">
                <TranslatedText text={bundle.state} language={language} />
              </span>
            </div>

            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#ECF8F8]/50 text-[#0F1B29] border border-[#DDDDDD] shrink-0">
              {translate(language, 'history.sourcesCount', { count: bundle.sources?.length || 0 })}
            </span>
          </div>

          <div>
            <h4 className="font-bold text-base sm:text-lg text-[#0F1B29] group-hover:text-[#747F8D] transition-colors leading-snug">
              <TranslatedText text={bundle.eventName} language={language} />
            </h4>
            <div className="flex items-center gap-1 text-xs text-[#747F8D] mt-1">
              <MapPin className="w-3.5 h-3.5 text-[#747F8D] shrink-0" />
              <span>
                <TranslatedText text={`${bundle.location}, ${bundle.state}`} language={language} />
              </span>
              <span className="text-[#DDDDDD]">•</span>
              <Calendar className="w-3.5 h-3.5 text-[#747F8D] shrink-0" />
              <TranslatedText text={bundle.eventDate ? formatDisasterDate(bundle.eventDate) : bundle.dateRange} language={language} />
            </div>
          </div>
        </div>

        {hasImpactSummary ? (
          <div className={`grid grid-cols-1 ${hasCasualties && hasDamage ? 'sm:grid-cols-2' : ''} gap-2.5 text-xs`}>
            {hasCasualties && (
              <div className="p-3 rounded-xl bg-white border border-[#DDDDDD] space-y-0.5">
                <span className="text-[#0F1B29] font-bold text-[10px] uppercase flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-[#747F8D]" />
                  <span>{translate(language, 'history.casualties')}</span>
                </span>
                <p className="text-[#0F1B29] line-clamp-2 leading-relaxed text-xs font-medium">
                  <TranslatedText text={bundle.reportedCasualties} language={language} />
                </p>
              </div>
            )}

            {hasDamage && (
              <div className="p-3 rounded-xl bg-white border border-[#DDDDDD] space-y-0.5">
                <span className="text-[#0F1B29] font-bold text-[10px] uppercase flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-[#747F8D]" />
                  <span>{translate(language, 'history.damage')}</span>
                </span>
                <p className="text-[#0F1B29] line-clamp-2 leading-relaxed text-xs font-medium">
                  <TranslatedText text={bundle.reportedDamage} language={language} />
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#747F8D]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#747F8D]" />
            <span>{bundle.evidenceStatus}</span>
          </div>
        )}

        <p className="text-xs text-[#747F8D] line-clamp-2 leading-relaxed">
          <TranslatedText text={bundle.whatHappened} language={language} />
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#DDDDDD]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCompare(bundle);
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${isSelectedForCompare
                ? 'bg-[#0F1B29] border-[#0F1B29] text-white'
                : 'bg-white hover:bg-[#ECF8F8] border-[#DDDDDD] text-[#0F1B29]'
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
              className="px-2.5 py-1.5 rounded-xl bg-[#ECF8F8] hover:bg-[#DDDDDD]/60 border border-[#DDDDDD] text-xs font-semibold text-[#0F1B29] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#747F8D]" />
              <span>{translate(language, 'history.askAi')}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => handleCopyCardSummary(bundle, e)}
              className="p-1.5 rounded-xl bg-white hover:bg-[#ECF8F8] border border-[#DDDDDD] text-[#747F8D] hover:text-[#0F1B29] transition-colors"
              title={translate(language, 'history.copySummary')}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1 text-xs font-bold text-[#0F1B29] group-hover:text-[#747F8D]">
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
      <div className="bg-white border border-[#DDDDDD] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#ECF8F8] border border-[#DDDDDD] flex items-center justify-center text-[#0F1B29]">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg sm:text-xl text-[#0F1B29] flex items-center gap-2">
                  <span>Indian Historical Disaster Intelligence Archive</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#ECF8F8] text-[#0F1B29] font-mono font-bold border border-[#DDDDDD]">
                    Current Evidence
                  </span>
                </h2>
                <p className="text-xs text-[#747F8D]">
                  Build a sourced dossier from current evidence and AI synthesis, then compare events or open the evidence view.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Grounded Evidence Engine</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-[#747F8D] absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void handleLiveQuerySearch(searchQuery);
                }
              }}
              placeholder={translate(language, 'history.searchPlaceholder')}
              className="w-full pl-10 pr-20 py-2.5 text-xs sm:text-sm rounded-xl bg-white border border-[#DDDDDD] text-[#0F1B29] placeholder:text-[#747F8D]/60 focus:outline-none focus:border-[#747F8D] focus:ring-2 focus:ring-[#DDDDDD]/40"
            />
            <div className="absolute right-2 flex items-center gap-1">
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="p-1 text-[#747F8D] hover:text-[#0F1B29]">
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
            className="px-4 py-2.5 rounded-xl bg-[#0F1B29] hover:bg-[#0f1b29]/90 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm shrink-0"
            title="Search current evidence and synthesize a dossier"
          >
            <span>{isSearchingLive ? 'Synthesizing Archive...' : 'Search Evidence'}</span>
          </button>
        </div>

        {searchError && (
          <div
            className={`p-3 rounded-xl text-xs font-medium ${isNoLiveSourcesMessage(searchError)
              ? 'border border-amber-200 bg-amber-50 text-amber-800'
              : 'border border-rose-200 bg-rose-50 text-rose-700'
              }`}
          >
            {searchError}
          </div>
        )}

        <div className="pt-2 border-t border-[#DDDDDD] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#747F8D] flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#0F1B29]" />
              <span>Sort Order:</span>
            </span>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="px-3 py-1.5 rounded-xl bg-white border border-[#DDDDDD] font-semibold text-[#0F1B29] focus:outline-none focus:border-[#747F8D] cursor-pointer text-xs"
            >
              <option value="oldest">Oldest to Recent</option>
              <option value="recent">Most Recent to Oldest</option>
              <option value="casualties">Highest Casualties / Impact</option>
              <option value="sources">Most Sources First</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-[#747F8D] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#0F1B29]" />
              <span>State:</span>
            </span>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white border border-[#DDDDDD] font-semibold text-[#0F1B29] focus:outline-none focus:border-[#747F8D] cursor-pointer text-xs"
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
                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors ${selectedDecade === decade
                  ? 'bg-[#0F1B29] text-white shadow-xs'
                  : 'text-[#747F8D] hover:text-[#0F1B29]'
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
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${isSelected
                  ? 'bg-[#0F1B29] text-white border-[#0F1B29] shadow-xs'
                  : 'bg-white hover:bg-[#ECF8F8] text-[#0F1B29] border-[#DDDDDD]'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#DDDDDD] pt-3">
          <div className="text-xs text-[#747F8D]">
            {selectedCategory !== appliedFilters.category ||
              selectedState !== appliedFilters.state ||
              selectedDecade !== appliedFilters.decade ? (
              <span>Filter selections are ready. Apply them to run a fresh evidence search.</span>
            ) : (
              <span>Results reflect the last applied filter set.</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleApplyFilters()}
            disabled={isApplyingFilter || isArchiveLoading}
            className="px-4 py-2 rounded-xl bg-[#0F1B29] hover:bg-[#0f1b29]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-colors"
            aria-label="Apply Filter"
          >
            <Filter className={`w-4 h-4 ${isApplyingFilter ? 'animate-pulse' : ''}`} />
            <span>{isApplyingFilter ? 'Applying Filter...' : 'Apply Filter'}</span>
          </button>
        </div>
      </div>

      {archiveError && !evidenceBundles.length && !isArchiveLoading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Recent archive could not be loaded right now. Current evidence search still works, and the page will recover when the service is reachable.
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2 font-medium">
          <span className="font-bold text-[#0F1B29] text-sm">
            {filteredAndSortedEvents.length > 0
              ? `Showing ${filteredAndSortedEvents.length} live dossiers`
              : 'No dossiers loaded yet'}
          </span>
        </div>

        {(searchQuery || selectedCategory !== 'all' || selectedState !== 'All States' || selectedDecade !== 'all' ||
          appliedFilters.category !== 'all' || appliedFilters.state !== 'All States' || appliedFilters.decade !== 'all') && (
            <button
              type="button"
              onClick={() => void handleResetFilters()}
              className="text-[#0F1B29] hover:text-[#747F8D] font-semibold underline"
            >
              Reset All Filters
            </button>
          )}
      </div>

      {(isArchiveLoading || isSearchingLive) && <EventCardSkeleton />}

      {filteredAndSortedEvents.length === 0 && !isArchiveLoading && !isSearchingLive ? (
        <div className="rounded-2xl border border-dashed border-[#DDDDDD] bg-white p-8 text-center space-y-3 shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[#ECF8F8] border border-[#DDDDDD] flex items-center justify-center text-[#0F1B29]">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-[#0F1B29]">
            {archiveError
              ? 'Live archive is temporarily unavailable'
              : appliedFilters.category !== 'all' || appliedFilters.state !== 'All States' || appliedFilters.decade !== 'all'
                ? 'No matching live records were found'
                : 'No dossier yet'}
          </h3>
          <p className="text-xs text-[#747F8D] max-w-md mx-auto leading-relaxed">
            {archiveError
              ? 'The live source did not respond. Try Apply Filter again or use Search Evidence; no placeholder records were inserted.'
              : appliedFilters.category !== 'all' || appliedFilters.state !== 'All States' || appliedFilters.decade !== 'all'
                ? 'The live search returned no records for this combination. Broaden one filter and apply it again.'
                : 'Search any disaster event, district, or state and we will synthesize a single cited dossier and add it here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredAndSortedEvents.map(renderCard)}
        </div>
      )}

      {compareList.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-white border border-[#DDDDDD] rounded-2xl p-3 sm:p-4 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#747F8D]" />
            <div className="text-xs">
              <span className="font-bold text-[#0F1B29] block">
                {compareList.length} Disaster Events Selected
              </span>
              <span className="text-[11px] text-[#747F8D]">
                {compareList.length < 2 ? 'Select 1 more event to launch comparison matrix' : 'Ready for cross-event matrix analysis'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={compareList.length < 2}
              onClick={() => setIsCompareModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#0F1B29] hover:bg-[#0f1b29]/90 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>{t.compareNow}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setCompareList([])}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#747F8D] hover:text-[#0F1B29] transition-colors"
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

