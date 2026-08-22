import React, { useEffect, useState } from 'react';
import { getLocale, translate } from './types/language';
import { Navbar } from './components/Navbar';
import { PresentWorkspace } from './components/present/PresentWorkspace';
import { PastWorkspace } from './components/past/PastWorkspace';
import { AIAssistantDrawer } from './components/past/AIAssistantDrawer';

export function App() {
  const [currentTab, setCurrentTab] = useState<'present' | 'past'>('present');
  const [currentLanguage, setCurrentLanguage] = useState<string>(() =>
    typeof window === 'undefined' ? 'en' : window.localStorage.getItem('disaster-intelligence.language') || 'en'
  );
  const [feedStatus, setFeedStatus] = useState<'LIVE_FETCH' | 'ETAG_CACHED' | 'FALLBACK_SNAPSHOT' | 'ERROR'>('LIVE_FETCH');
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState<boolean>(false);
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isKnownPath = currentPath === '/' || currentPath === '/present' || currentPath === '/past';

  useEffect(() => {
    window.localStorage.setItem('disaster-intelligence.language', currentLanguage);
    document.documentElement.lang = getLocale(currentLanguage);
  }, [currentLanguage]);

  if (!isKnownPath) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-xl w-full bg-white border border-slate-200 rounded-3xl shadow-sm p-8 sm:p-10 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
              404
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{translate(currentLanguage, 'error.notFoundTitle')}</h1>
              <p className="text-sm text-slate-600">
                {translate(currentLanguage, 'error.notFoundBody')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-colors"
            >
              {translate(currentLanguage, 'error.returnDashboard')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-indigo-500 selection:text-white font-sans">
      {/* Top Navigation Bar with Layer Switcher & Multilingual Dropdown */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        currentLanguage={currentLanguage}
        onLanguageChange={setCurrentLanguage}
        feedStatus={feedStatus}
        lastUpdated={lastUpdated}
        onOpenVoiceAssistant={() => setIsVoiceAssistantOpen(true)}
      />

      {/* Main Workspace based on selected Layer */}
      <main className="flex-1">
        {currentTab === 'present' ? (
          <PresentWorkspace
            language={currentLanguage}
            onFeedStatusChange={(status, time) => {
              setFeedStatus(status);
              setLastUpdated(time);
            }}
          />
        ) : (
          <PastWorkspace
            language={currentLanguage}
            isVoiceAssistantOpen={isVoiceAssistantOpen}
            onCloseVoiceAssistant={() => setIsVoiceAssistantOpen(false)}
            onOpenVoiceAssistant={() => setIsVoiceAssistantOpen(true)}
            onLanguageChange={setCurrentLanguage}
          />
        )}
      </main>

      {/* Floating Global Multilingual Voice Assistant (accessible anytime) */}
      <AIAssistantDrawer
        isOpen={isVoiceAssistantOpen && currentTab === 'present'}
        onClose={() => setIsVoiceAssistantOpen(false)}
        language={currentLanguage}
        onLanguageChange={setCurrentLanguage}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-between items-center gap-2">
          <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            Feed Status: {feedStatus} • Multilingual support enabled
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
