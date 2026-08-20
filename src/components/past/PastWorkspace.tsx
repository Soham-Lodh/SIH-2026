import React, { useState, useMemo } from 'react';
import { EvidenceBundle, DisasterCategory } from '../../types/disaster';
import { HISTORICAL_DISASTERS_CATALOG, HistoricalDisasterItem } from '../../data/historicalDisasters';
import { EventDetailView } from './EventDetailView';
import { CompareModal } from './CompareModal';
import { AIAssistantDrawer } from './AIAssistantDrawer';
import { EventCardSkeleton } from '../common/Skeletons';
import { AudioRecorderButton } from '../common/AudioRecorderButton';
import {
  Search,
  Clock,
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
  Filter,
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
import { getTranslation } from '../../types/language';

interface PastWorkspaceProps {
  language: string;
  isVoiceAssistantOpen?: boolean;
  onCloseVoiceAssistant?: () => void;
  onOpenVoiceAssistant?: () => void;
  onLanguageChange?: (lang: string) => void;
}

export type SortOption = 'oldest' | 'recent' | 'casualties' | 'sources' | 'alphabetical';
export type DecadeFilter = 'all' | '1990s' | '2000s' | '2010s' | '2020s';

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
  'Telangana',
];

export const PastWorkspace: React.FC<PastWorkspaceProps> = ({
  language,
  isVoiceAssistantOpen = false,
  onCloseVoiceAssistant,
  onOpenVoiceAssistant,
  onLanguageChange,
}) => {
  const [evidenceBundles, setEvidenceBundles] = useState<HistoricalDisasterItem[]>(HISTORICAL_DISASTERS_CATALOG);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('All States');
  const [selectedDecade, setSelectedDecade] = useState<DecadeFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('oldest');
  const [isSearchingLive, setIsSearchingLive] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<EvidenceBundle | null>(null);

  // Compare selection (2 to 4 events)
  const [compareList, setCompareList] = useState<EvidenceBundle[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Local AI Drawer open state
  const [localVoiceOpen, setLocalVoiceOpen] = useState(false);
  const [activeChatBundle, setActiveChatBundle] = useState<EvidenceBundle | null>(null);

  const t = getTranslation(language);

  // Dynamic Live Query via Gemini + Google News for custom queries
  const handleLiveQuerySearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearchingLive(true);
    try {
      const res = await fetch('/api/past/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.bundle) {
          const matchYear = parseInt(data.bundle.dateRange?.match(/\b(19\d\d|20\d\d)\b/)?.[0] || '2024', 10);
          const decade: '1990s' | '2000s' | '2010s' | '2020s' =
            matchYear < 2000 ? '1990s' : matchYear < 2010 ? '2000s' : matchYear < 2020 ? '2010s' : '2020s';

          const newEnrichedItem: HistoricalDisasterItem = {
            ...data.bundle,
            year: matchYear,
            numericCasualties: 100,
            decade,
          };

          setEvidenceBundles((prev) => {
            const filtered = prev.filter((b) => b.eventName.toLowerCase() !== data.bundle.eventName.toLowerCase());
            return [newEnrichedItem, ...filtered];
          });
        }
      }
    } catch (err) {
      console.error('Historical dynamic search error:', err);
    } finally {
      setIsSearchingLive(false);
    }
  };

  // Filter and Sort Logic
  const filteredAndSortedEvents = useMemo(() => {
    let result = [...evidenceBundles];

    // 1. Text Search Filter (Fuzzy across name, state, location, year, description)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((event) => {
        return (
          event.eventName.toLowerCase().includes(q) ||
          event.state.toLowerCase().includes(q) ||
          event.location.toLowerCase().includes(q) ||
          event.disasterType.toLowerCase().includes(q) ||
          String(event.year).includes(q) ||
          event.whatHappened.toLowerCase().includes(q)
        );
      });
    }

    // 2. Category Filter
    if (selectedCategory !== 'all') {
      result = result.filter((event) => {
        if (selectedCategory === 'Landslide') {
          return event.disasterType === 'Landslide' || event.disasterType === 'Avalanche';
        }
        return event.disasterType.toLowerCase().includes(selectedCategory.toLowerCase());
      });
    }

    // 3. State Filter
    if (selectedState !== 'All States') {
      result = result.filter((event) => event.state.toLowerCase().includes(selectedState.toLowerCase()));
    }

    // 4. Decade Filter
    if (selectedDecade !== 'all') {
      result = result.filter((event) => event.decade === selectedDecade);
    }

    // 5. Sorting
    result.sort((a, b) => {
      if (sortOption === 'oldest') {
        // Chronological: Oldest (1999) to Recent (2024)
        return a.year - b.year;
      }
      if (sortOption === 'recent') {
        // Reverse Chronological: Recent (2024) to Oldest (1999)
        return b.year - a.year;
      }
      if (sortOption === 'casualties') {
        return (b.numericCasualties || 0) - (a.numericCasualties || 0);
      }
      if (sortOption === 'sources') {
        return (b.sources?.length || 0) - (a.sources?.length || 0);
      }
      if (sortOption === 'alphabetical') {
        return a.eventName.localeCompare(b.eventName);
      }
      return 0;
    });

    return result;
  }, [evidenceBundles, searchQuery, selectedCategory, selectedState, selectedDecade, sortOption]);

  const toggleCompare = (bundle: EvidenceBundle) => {
    const exists = compareList.some((b) => b.id === bundle.id);
    if (exists) {
      setCompareList(compareList.filter((b) => b.id !== bundle.id));
    } else {
      if (compareList.length >= 4) {
        alert('You can compare a maximum of 4 disaster events simultaneously.');
        return;
      }
      setCompareList([...compareList, bundle]);
    }
  };

  const handleOpenChatForEvent = (bundle: EvidenceBundle) => {
    setActiveChatBundle(bundle);
    if (onOpenVoiceAssistant) {
      onOpenVoiceAssistant();
    } else {
      setLocalVoiceOpen(true);
    }
  };

  const [isDownloadOpen, setIsDownloadOpen] = useState(false);

  const downloadCSVReport = () => {
    setIsDownloadOpen(false);
    const headers = [
      'Event Name',
      'Hazard Type',
      'Location',
      'State',
      'Date Range',
      'Reported Casualties',
      'Reported Infrastructure & Economic Damage',
      'What Happened Summary',
      'Grounded Sources Count',
      'Verified Sources List',
    ];

    const escapeCSV = (val: string | number) => {
      const str = String(val || '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filteredAndSortedEvents.map((event) => {
      const sourcesStr = event.sources
        .map((s) => `[${s.id}] ${s.title} (${s.publisher}) - ${s.url}`)
        .join(' | ');

      return [
        escapeCSV(event.eventName),
        escapeCSV(event.disasterType),
        escapeCSV(event.location),
        escapeCSV(event.state),
        escapeCSV(event.dateRange),
        escapeCSV(event.reportedCasualties),
        escapeCSV(event.reportedDamage),
        escapeCSV(event.whatHappened),
        escapeCSV(event.sources.length),
        escapeCSV(sourcesStr),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Indian_Disaster_Intelligence_Report_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPDFReport = () => {
    setIsDownloadOpen(false);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popups blocked. Please allow popups to generate print report.');
      return;
    }

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Indian Historical Disaster Intelligence Report - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #0f172a; line-height: 1.5; font-size: 13px; }
            h1 { font-size: 20px; margin-bottom: 4px; color: #1e1b4b; }
            .subhead { color: #64748b; font-size: 12px; margin-bottom: 20px; }
            .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 24px; display: flex; flex-wrap: wrap; gap: 20px; font-size: 12px; }
            .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
            .card-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 8px; }
            .title { font-weight: bold; font-size: 15px; color: #0f172a; }
            .badge { background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 10px 0; }
            .label { font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase; }
            .val { font-size: 12px; color: #1e293b; margin-top: 2px; }
            .sources { font-size: 11px; color: #64748b; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #e2e8f0; }
            @media print { body { padding: 0; } .no-print { display: none !important; } }
          </style>
        </head>
        <body>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div>
              <h1>Indian Historical Disaster Intelligence Archive Report</h1>
              <div class="subhead">National Disaster Intelligence Platform • Generated on ${new Date().toLocaleString()}</div>
            </div>
            <button class="no-print" onclick="window.print()" style="padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
          </div>
          <div class="meta-box">
            <div><strong>Total Documented Events:</strong> ${filteredAndSortedEvents.length}</div>
            <div><strong>Filters:</strong> Category: ${selectedCategory} | State: ${selectedState} | Decade: ${selectedDecade}</div>
            <div><strong>Evidence Engine:</strong> Grounded Multi-Source Citations (NDMA & Google News)</div>
          </div>
          ${filteredAndSortedEvents
            .map(
              (ev, i) => `
            <div class="card">
              <div class="card-header">
                <div class="title">${i + 1}. ${ev.eventName}</div>
                <span class="badge">${ev.disasterType} • ${ev.state}</span>
              </div>
              <div style="font-size: 12px; color: #334155; margin-bottom: 8px;"><strong>Timeline & Geography:</strong> ${ev.dateRange} | ${ev.location}, ${ev.state}</div>
              <div class="grid">
                <div>
                  <div class="label">Reported Casualties:</div>
                  <div class="val" style="color: #991b1b; font-weight: 600;">${ev.reportedCasualties}</div>
                </div>
                <div>
                  <div class="label">Infrastructure & Economic Damage:</div>
                  <div class="val" style="color: #92400e; font-weight: 600;">${ev.reportedDamage}</div>
                </div>
              </div>
              <div style="margin-top: 8px;">
                <div class="label">Summary & Grounded Assessment:</div>
                <div class="val" style="margin-top: 4px; line-height: 1.5;">${ev.whatHappened}</div>
              </div>
              <div class="sources">
                <strong>Retrieved Grounded Sources (${ev.sources.length}):</strong><br/>
                ${ev.sources.map((s) => `[${s.id}] <em>${s.title}</em> (${s.publisher}, ${new Date(s.publishedAt).toLocaleDateString()})`).join('<br/>')}
              </div>
            </div>
          `
            )
            .join('')}
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
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

  // If viewing detailed 12-section evidence view
  if (selectedBundle) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
        <EventDetailView
          bundle={selectedBundle}
          onBack={() => setSelectedBundle(null)}
          onOpenChatWithEvent={handleOpenChatForEvent}
          onPlayTTS={() => {}}
          language={language}
        />

        {/* Multilingual AI Voice Assistant Drawer */}
        <AIAssistantDrawer
          isOpen={isVoiceAssistantOpen || localVoiceOpen}
          onClose={() => {
            if (onCloseVoiceAssistant) onCloseVoiceAssistant();
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
      {/* Header Banner & Stats */}
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
                    1999 – 2024
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Comprehensive multi-decade historical records across India with grounded media citations, casualty reconciliations, and temporal analysis.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download Report Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                title="Download PDF or CSV intelligence report"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Report</span>
                <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
              </button>

              {isDownloadOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                  <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Export Filtered ({filteredAndSortedEvents.length})
                  </div>
                  <button
                    type="button"
                    onClick={downloadCSVReport}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left rounded-xl hover:bg-slate-50 text-slate-700 font-medium transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900">Download CSV (.csv)</div>
                      <div className="text-[10px] text-slate-500">Structured data spreadsheet</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={downloadPDFReport}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left rounded-xl hover:bg-slate-50 text-slate-700 font-medium transition-colors"
                  >
                    <Printer className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900">Print / PDF Report</div>
                      <div className="text-[10px] text-slate-500">High-resolution dossier document</div>
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

        {/* Search Bar with Audio Voice Recorder + Instant Filter + Live AI Search */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search historical events (e.g. 1999 Odisha Super Cyclone, 2001 Bhuj, 2004 Tsunami, 2013 Kedarnath, 2018 Kerala Floods, 2024 Wayanad)..."
              className="w-full pl-10 pr-20 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="absolute right-2 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {/* Multilingual Voice Audio Recorder with Gemini Transcription */}
              <AudioRecorderButton
                language={language}
                onTranscribed={(transcript) => {
                  setSearchQuery(transcript);
                  handleLiveQuerySearch(transcript);
                }}
                tooltip="Speak disaster query in Hindi, English, etc."
                className="scale-90"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={isSearchingLive || !searchQuery.trim()}
            onClick={() => handleLiveQuerySearch(searchQuery)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm shadow-indigo-100 shrink-0"
            title="Search Google News & Gemini Archives for Rare Disaster Queries"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSearchingLive ? 'Synthesizing Archive...' : 'Search Live Sources'}</span>
          </button>
        </div>

        {/* Controls Bar: Sort, State Filter, Decade Filter */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Sort By Dropdown */}
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
              <option value="oldest">📅 Oldest to Recent (1999 → 2024)</option>
              <option value="recent">🕒 Most Recent to Oldest (2024 → 1999)</option>
              <option value="casualties">🚨 Highest Casualties / Impact First</option>
              <option value="sources">📚 Most Grounded Sources First</option>
              <option value="alphabetical">🔤 Alphabetical (A to Z)</option>
            </select>
          </div>

          {/* Middle: State Selector */}
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
              {STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Right: Decade Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {(['all', '1990s', '2000s', '2010s', '2020s'] as DecadeFilter[]).map((dec) => (
              <button
                key={dec}
                type="button"
                onClick={() => setSelectedDecade(dec)}
                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors ${
                  selectedDecade === dec
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {dec === 'all' ? 'All Eras' : dec}
              </button>
            ))}
          </div>
        </div>

        {/* Hazard Category Filter Chips */}
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

      {/* Results Header Count & Active Filters Indicator */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2 font-medium">
          <span className="font-bold text-slate-900 text-sm">
            Showing {filteredAndSortedEvents.length} Disaster Records Across India
          </span>
          {sortOption === 'oldest' && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-[11px]">
              Chronological (1999 → 2024)
            </span>
          )}
          {sortOption === 'recent' && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-[11px]">
              Reverse Chronological (2024 → 1999)
            </span>
          )}
        </div>

        {(searchQuery || selectedCategory !== 'all' || selectedState !== 'All States' || selectedDecade !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
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

      {/* Loading Skeleton during dynamic AI search */}
      {isSearchingLive && <EventCardSkeleton />}

      {/* Event Cards Grid / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {filteredAndSortedEvents.map((bundle) => {
          const isSelectedForCompare = compareList.some((b) => b.id === bundle.id);

          return (
            <div
              key={bundle.id}
              onClick={() => setSelectedBundle(bundle)}
              className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md shadow-xs transition-all flex flex-col justify-between space-y-4 cursor-pointer group relative"
            >
              {/* Top Row: Year, Category Badge, State */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-mono font-bold">
                      {bundle.year}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono uppercase border ${
                      bundle.disasterType === 'Cyclone'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : bundle.disasterType === 'Flood'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : bundle.disasterType === 'Earthquake'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : bundle.disasterType === 'Landslide'
                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                        : bundle.disasterType === 'Tsunami'
                        ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {bundle.disasterType}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {bundle.state}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 shrink-0">
                    {bundle.sources?.length || 4} Sources
                  </span>
                </div>

                {/* Event Name & Location */}
                <div>
                  <h4 className="font-bold text-base sm:text-lg text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                    {bundle.eventName}
                  </h4>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>{bundle.location}, {bundle.state}</span>
                    <span className="text-slate-300">•</span>
                    <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>{bundle.dateRange}</span>
                  </div>
                </div>
              </div>

              {/* Impact Metric Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-100 space-y-0.5">
                  <span className="text-rose-700 font-bold text-[10px] uppercase flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-rose-600" />
                    <span>Reported Casualties</span>
                  </span>
                  <p className="text-slate-800 line-clamp-2 leading-relaxed text-xs font-medium">
                    {bundle.reportedCasualties}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 space-y-0.5">
                  <span className="text-amber-800 font-bold text-[10px] uppercase flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-amber-600" />
                    <span>Estimated Damage / Loss</span>
                  </span>
                  <p className="text-slate-800 line-clamp-2 leading-relaxed text-xs font-medium">
                    {bundle.reportedDamage}
                  </p>
                </div>
              </div>

              {/* Synthesis preview */}
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {bundle.whatHappened}
              </p>

              {/* Card Footer Actions */}
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
                    <span>{isSelectedForCompare ? 'In Compare' : 'Add to Compare'}</span>
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
                    <span>Ask AI</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => handleCopyCardSummary(bundle, e)}
                    className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                    title="Copy Evidence Summary"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:text-indigo-800">
                    <span>12-Section Dossier</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Compare Dock (when 1 or more events selected) */}
      {compareList.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-white border border-indigo-200 rounded-2xl p-3 sm:p-4 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-indigo-600" />
            <div className="text-xs">
              <span className="font-bold text-slate-900 block">
                {compareList.length} Disaster Events Selected
              </span>
              <span className="text-[11px] text-slate-500">
                {compareList.length < 2 ? 'Select 1 more event to launch comparison matrix' : 'Ready for cross-decade matrix analysis'}
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

      {/* Compare Modal */}
      {isCompareModalOpen && (
        <CompareModal
          bundles={compareList}
          onClose={() => setIsCompareModalOpen(false)}
          language={language}
        />
      )}

      {/* Multilingual Voice Assistant Drawer */}
      <AIAssistantDrawer
        isOpen={isVoiceAssistantOpen || localVoiceOpen}
        onClose={() => {
          if (onCloseVoiceAssistant) onCloseVoiceAssistant();
          setLocalVoiceOpen(false);
        }}
        associatedBundle={activeChatBundle}
        language={language}
        onLanguageChange={onLanguageChange}
      />
    </div>
  );
};
