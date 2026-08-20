import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { PresentWorkspace } from './components/present/PresentWorkspace';
import { PastWorkspace } from './components/past/PastWorkspace';
import { AIAssistantDrawer } from './components/past/AIAssistantDrawer';

export function App() {
  const [currentTab, setCurrentTab] = useState<'present' | 'past'>('present');
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [feedStatus, setFeedStatus] = useState<'LIVE_FETCH' | 'ETAG_CACHED' | 'FALLBACK_SNAPSHOT' | 'ERROR'>('LIVE_FETCH');
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState<boolean>(false);

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
          <span className="font-medium">Official Data Sources: NDMA SACHET CAP Feed, IMD, State SDMAs, Press Information Bureau.</span>
          <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            Feed Status: {feedStatus} • 23 Indian Languages Supported
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
