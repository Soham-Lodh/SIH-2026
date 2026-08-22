import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldAlert,
  Globe,
  Radio,
  Clock,
  Search,
  Check,
  ChevronDown,
  Volume2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { INDIAN_LANGUAGES, getTranslation, translate } from '../types/language';

interface NavbarProps {
  currentTab: 'present' | 'past';
  onTabChange: (tab: 'present' | 'past') => void;
  currentLanguage: string;
  onLanguageChange: (langCode: string) => void;
  feedStatus: 'LIVE_FETCH' | 'ETAG_CACHED' | 'FALLBACK_SNAPSHOT' | 'ERROR';
  lastUpdated?: string;
  onRefreshFeed?: () => void;
  onOpenVoiceAssistant?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  currentLanguage,
  onLanguageChange,
  feedStatus,
  lastUpdated,
  onRefreshFeed,
  onOpenVoiceAssistant,
}) => {
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const t = getTranslation(currentLanguage);
  const activeLang = INDIAN_LANGUAGES.find((l) => l.code === currentLanguage) || INDIAN_LANGUAGES[0];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when language dropdown opens
  useEffect(() => {
    if (isLangOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isLangOpen]);

  // Filter languages by English name, native script, or code
  const filteredLanguages = INDIAN_LANGUAGES.filter((lang) => {
    const q = langSearch.toLowerCase().trim();
    return (
      lang.name.toLowerCase().includes(q) ||
      lang.nativeName.toLowerCase().includes(q) ||
      lang.code.toLowerCase().includes(q)
    );
  });

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
        {/* Brand & Layer Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-100 text-white font-bold">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>{t.appTitle}</span>
                <span className="text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  INDIA
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        {/* Top-Level Independent Layer Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => onTabChange('present')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
              currentTab === 'present'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>{t.presentTab.split(' ')[0]}</span>
            <span className="hidden md:inline text-[11px] opacity-90 font-normal">({translate(currentLanguage, 'nav.liveMap')})</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('past')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
              currentTab === 'past'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{t.pastTab.split(' ')[0]}</span>
            <span className="hidden md:inline text-[11px] opacity-90 font-normal">({translate(currentLanguage, 'nav.historical')})</span>
          </button>
        </div>

        {/* Right Actions: Multilingual Selector & Feed Status */}
        <div className="flex items-center gap-2">
          {/* Multilingual Searchable Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs sm:text-sm text-slate-800 transition-colors shadow-sm"
              title={translate(currentLanguage, 'nav.changeLanguage')}
              aria-label={translate(currentLanguage, 'nav.changeLanguage')}
            >
              <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="text-left hidden xs:block">
                <span className="font-semibold text-slate-900">{activeLang.name}</span>
                <span className="text-[11px] text-indigo-600 ml-1 font-medium font-sans">({activeLang.nativeName})</span>
              </div>
              <span className="xs:hidden font-mono uppercase font-bold text-xs">{activeLang.code}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            </button>

            {isLangOpen && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                {/* Search Input for Languages */}
                <div className="p-3 border-b border-slate-100 bg-slate-50">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={langSearch}
                      onChange={(e) => setLangSearch(e.target.value)}
                      placeholder={t.searchLanguagePlaceholder}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                {/* Languages List */}
                <div className="max-h-72 overflow-y-auto p-2 space-y-0.5">
                  {filteredLanguages.length > 0 ? (
                    filteredLanguages.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          onLanguageChange(lang.code);
                          setIsLangOpen(false);
                          setLangSearch('');
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left rounded-xl text-xs sm:text-sm transition-colors ${
                          currentLanguage === lang.code
                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium">{lang.name}</span>
                          <span className="text-slate-500 text-xs font-normal">({lang.nativeName})</span>
                        </div>
                        {currentLanguage === lang.code && (
                          <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                      {translate(currentLanguage, 'nav.noLanguage')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Voice Assistant Trigger */}
          {onOpenVoiceAssistant && (
            <button
              type="button"
              onClick={onOpenVoiceAssistant}
              className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 border border-slate-200 text-indigo-600 hover:border-indigo-200 transition-colors shadow-sm"
              title={translate(currentLanguage, 'nav.openAssistant')}
              aria-label={translate(currentLanguage, 'nav.openAssistant')}
            >
              <Volume2 className="w-4 h-4" />
            </button>
          )}

          {/* Refresh Feed */}
          {onRefreshFeed && (
            <button
              type="button"
              onClick={onRefreshFeed}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-sm"
              title={translate(currentLanguage, 'nav.refresh')}
              aria-label={translate(currentLanguage, 'nav.refresh')}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

