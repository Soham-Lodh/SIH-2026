import React, { useEffect, useState } from 'react';
import { getLocale, translate } from './types/language';
import { Navbar } from './components/Navbar';
import { PresentWorkspace } from './components/present/PresentWorkspace';
import { PastWorkspace } from './components/past/PastWorkspace';
import { FuturePage } from './components/future/FuturePage';
import { TeamPage } from './components/TeamPage';
import { HeroPage } from './components/HeroPage';
import { AIAssistantDrawer } from './components/past/AIAssistantDrawer';
import { useAutoTranslatePage } from './hooks/useAutoTranslatePage';
import { prefetchPastArchive } from './lib/pastCache';

export function App() {
  const [currentRoute, setCurrentRoute] = useState<string>(() =>
    typeof window === 'undefined' ? '/' : window.location.pathname
  );
  const [currentLanguage, setCurrentLanguage] = useState<string>(() =>
    typeof window === 'undefined' ? 'en' : window.localStorage.getItem('disaster-intelligence.language') || 'en'
  );
  const [feedStatus, setFeedStatus] = useState<'LIVE_FETCH' | 'ETAG_CACHED' | 'FALLBACK_SNAPSHOT' | 'ERROR'>('LIVE_FETCH');
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState<boolean>(false);

  useAutoTranslatePage(currentLanguage);

  // Prefetch past disaster archives on app mount to prime local cache
  useEffect(() => {
    prefetchPastArchive();
  }, []);

  useEffect(() => {
    window.localStorage.setItem('disaster-intelligence.language', currentLanguage);
    document.documentElement.lang = getLocale(currentLanguage);
  }, [currentLanguage]);

  // Synchronize browser history and navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleRouteChange = (route: string) => {
    window.history.pushState({}, '', route);
    setCurrentRoute(route);
  };

  const isKnownRoute = ['/', '/present', '/past', '/future', '/team'].includes(currentRoute);

  if (!isKnownRoute) {
    return (
      <div className="min-h-screen bg-[#ECF8F8] text-[#0F1B29] flex flex-col justify-center items-center px-4 font-sans select-none">
        <div className="max-w-md w-full bg-white border border-[#DDDDDD] rounded-3xl shadow-sm p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#DDDDDD]/50 border border-[#DDDDDD] flex items-center justify-center text-[#0F1B29] font-bold text-xl">
            404
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-[#0F1B29]">{translate(currentLanguage, 'error.notFoundTitle')}</h1>
            <p className="text-xs text-[#747F8D]">
              {translate(currentLanguage, 'error.notFoundBody')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleRouteChange('/')}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-[#0F1B29] hover:bg-[#0f1b29]/90 text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
          >
            {translate(currentLanguage, 'error.returnDashboard')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#ECF8F8] text-[#0F1B29] flex flex-col selection:bg-[#747F8D] selection:text-white font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <Navbar
        currentRoute={currentRoute}
        onRouteChange={handleRouteChange}
        currentLanguage={currentLanguage}
        onLanguageChange={setCurrentLanguage}
        feedStatus={feedStatus}
        lastUpdated={lastUpdated}
        onOpenVoiceAssistant={() => setIsVoiceAssistantOpen(true)}
      />

      {/* Main Workspace based on selected Route */}
      <main className="flex-1 min-h-0 bg-[#ECF8F8] pt-16 overflow-y-auto">
        {currentRoute === '/' && (
          <HeroPage
            currentLanguage={currentLanguage}
            onExplore={() => handleRouteChange('/past')}
          />
        )}

        {currentRoute === '/present' && (
          <PresentWorkspace
            language={currentLanguage}
            onFeedStatusChange={(status, time) => {
              setFeedStatus(status);
              setLastUpdated(time);
            }}
          />
        )}

        {currentRoute === '/past' && (
          <PastWorkspace
            language={currentLanguage}
            isVoiceAssistantOpen={isVoiceAssistantOpen}
            onCloseVoiceAssistant={() => setIsVoiceAssistantOpen(false)}
            onOpenVoiceAssistant={() => setIsVoiceAssistantOpen(true)}
            onLanguageChange={setCurrentLanguage}
          />
        )}

        {currentRoute === '/future' && (
          <FuturePage currentLanguage={currentLanguage} />
        )}

        {currentRoute === '/team' && (
          <TeamPage />
        )}
      </main>

      {/* Floating Global Chatbot Drawer (accessible from navbar bot button) */}
      <AIAssistantDrawer
        isOpen={isVoiceAssistantOpen}
        onClose={() => setIsVoiceAssistantOpen(false)}
        language={currentLanguage}
        onLanguageChange={setCurrentLanguage}
      />

    </div>
  );
}

export default App;
