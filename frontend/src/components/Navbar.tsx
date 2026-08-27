import React, { useState, useRef, useEffect } from 'react';
import {
  Globe,
  Search,
  Check,
  ChevronDown,
  RefreshCw,
  Bot,
  Menu,
  X
} from 'lucide-react';
import { INDIAN_LANGUAGES, getTranslation, translate } from '../types/language';

interface NavbarProps {
  currentRoute: string;
  onRouteChange: (route: string) => void;
  currentLanguage: string;
  onLanguageChange: (langCode: string) => void;
  feedStatus: 'LIVE_FETCH' | 'ETAG_CACHED' | 'FALLBACK_SNAPSHOT' | 'ERROR';
  lastUpdated?: string;
  onRefreshFeed?: () => void;
  onOpenVoiceAssistant?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onRouteChange,
  currentLanguage,
  onLanguageChange,
  feedStatus,
  lastUpdated,
  onRefreshFeed,
  onOpenVoiceAssistant,
}) => {
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  const navItems = [
    { label: translate(currentLanguage, 'HOME') || 'Home', path: '/' },
    { label: translate(currentLanguage, 'FUTURE') || 'Future', path: '/future' },
    { label: translate(currentLanguage, 'PRESENT') || 'Present', path: '/present' },
    { label: translate(currentLanguage, 'PAST') || 'Past', path: '/past' },
    { label: translate(currentLanguage, 'TEAM') || 'Team', path: '/team' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#ECF8F8]/70 backdrop-blur-md border-b border-[#DDDDDD]/60 shadow-sm font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Logo and Application Name */}
        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => onRouteChange('/')}>
          <img src="/favicon.svg" className="w-8 h-8 rounded-lg border border-[#DDDDDD]/40" alt="Logo" />
          <span className="font-bold text-sm text-[#0F1B29] tracking-wider leading-none flex flex-col uppercase font-sans">
            <span>Aapda</span>
            <span>Drishti</span>
          </span>
        </div>

        {/* Center Desktop Navigation links */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = currentRoute === item.path;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  onRouteChange(item.path);
                  setIsMobileMenuOpen(false);
                }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive
                    ? 'text-[#0F1B29] bg-[#DDDDDD]/60 font-bold'
                    : 'text-[#747F8D] hover:text-[#0F1B29] hover:bg-[#DDDDDD]/40'
                  }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right side controls */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* Language Selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-[#ECF8F8] border border-[#DDDDDD] text-xs sm:text-sm text-[#0F1B29] transition-all duration-200 shadow-sm cursor-pointer"
              title={translate(currentLanguage, 'nav.changeLanguage')}
            >
              <Globe className="w-4 h-4 text-[#747F8D] shrink-0" />
              <span className="font-semibold">{activeLang.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#747F8D] shrink-0" />
            </button>

            {isLangOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-[#DDDDDD] shadow-xl z-50 overflow-hidden">
                <div className="p-3 border-b border-[#DDDDDD]/40 bg-[#ECF8F8]/40">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#747F8D] absolute left-2.5 top-2.5" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={langSearch}
                      onChange={(e) => setLangSearch(e.target.value)}
                      placeholder={t.searchLanguagePlaceholder}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white border border-[#DDDDDD] text-[#0F1B29] placeholder-[#747F8D]/60 focus:outline-none focus:border-[#747F8D]"
                    />
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto p-2 space-y-0.5">
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
                        className={`w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-xs sm:text-sm transition-colors ${currentLanguage === lang.code
                            ? 'bg-[#DDDDDD]/60 text-[#0F1B29] font-semibold'
                            : 'text-[#747F8D] hover:bg-[#ECF8F8]/90 hover:text-[#0F1B29]'
                          }`}
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium">{lang.name}</span>
                          <span className="text-[#747F8D] text-xs font-normal">({lang.nativeName})</span>
                        </div>
                        {currentLanguage === lang.code && (
                          <Check className="w-4 h-4 text-[#0F1B29] shrink-0" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-[#747F8D]">
                      {translate(currentLanguage, 'nav.noLanguage')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* AI Chatbot button */}
          {onOpenVoiceAssistant && (
            <button
              type="button"
              onClick={onOpenVoiceAssistant}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0F1B29] hover:bg-[#0f1b29]/90 text-white text-xs sm:text-sm font-semibold transition-all duration-200 shadow-sm cursor-pointer"
              title="Open AI Chatbot"
            >
              <Bot className="w-4 h-4 shrink-0" />
              <span>AI Chatbot</span>
            </button>
          )}

          {/* Refresh Feed */}
          {onRefreshFeed && currentRoute === '/present' && (
            <button
              type="button"
              onClick={onRefreshFeed}
              className="p-2 rounded-xl bg-white hover:bg-[#ECF8F8] border border-[#DDDDDD] text-[#747F8D] hover:text-[#0F1B29] transition-colors shadow-sm cursor-pointer"
              title={translate(currentLanguage, 'nav.refresh')}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Mobile Menu Controls */}
        <div className="flex md:hidden items-center gap-2">
          {/* AI Chatbot button on Mobile */}
          {onOpenVoiceAssistant && (
            <button
              type="button"
              onClick={onOpenVoiceAssistant}
              className="p-2 rounded-lg bg-[#0F1B29] text-white hover:bg-[#0f1b29]/90 shadow-sm transition-all duration-200 cursor-pointer"
              title="Open AI Chatbot"
            >
              <Bot className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg border border-[#DDDDDD] text-[#0F1B29] hover:bg-[#DDDDDD]/40 cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer/Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-[#ECF8F8] border-b border-[#DDDDDD] px-4 pt-2 pb-4 space-y-2 animate-in slide-in-from-top-4 duration-200">
          <nav className="flex flex-col space-y-1">
            {navItems.map((item) => {
              const isActive = currentRoute === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => {
                    onRouteChange(item.path);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isActive
                      ? 'text-[#0F1B29] bg-[#DDDDDD] font-bold'
                      : 'text-[#747F8D] hover:text-[#0F1B29] hover:bg-[#DDDDDD]/40'
                    }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="pt-2 border-t border-[#DDDDDD]/60 flex items-center justify-between">
            {/* Mobile Language Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#DDDDDD] text-xs text-[#0F1B29]"
              >
                <Globe className="w-3.5 h-3.5 text-[#747F8D]" />
                <span>{activeLang.name}</span>
                <ChevronDown className="w-3 h-3 text-[#747F8D]" />
              </button>

              {isLangOpen && (
                <div className="absolute left-0 mt-2 w-64 rounded-xl bg-white border border-[#DDDDDD] shadow-lg z-50 overflow-hidden">
                  <div className="p-2 border-b border-[#DDDDDD]/20 bg-[#ECF8F8]/40">
                    <input
                      type="text"
                      value={langSearch}
                      onChange={(e) => setLangSearch(e.target.value)}
                      placeholder={t.searchLanguagePlaceholder}
                      className="w-full px-2.5 py-1 text-xs rounded border border-[#DDDDDD] focus:outline-none focus:border-[#747F8D]"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1">
                    {filteredLanguages.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          onLanguageChange(lang.code);
                          setIsLangOpen(false);
                          setLangSearch('');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded text-xs ${currentLanguage === lang.code ? 'bg-[#DDDDDD] text-[#0F1B29]' : 'text-[#747F8D]'
                          }`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Refresh */}
            {onRefreshFeed && currentRoute === '/present' && (
              <button
                type="button"
                onClick={onRefreshFeed}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-[#DDDDDD] text-xs text-[#747F8D]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
export default Navbar;
