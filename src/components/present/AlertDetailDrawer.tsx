import React, { useEffect, useState } from 'react';
import { SachetAlert, NewsArticle } from '../../types/disaster';
import {
  X,
  ShieldAlert,
  AlertOctagon,
  Clock,
  MapPin,
  ExternalLink,
  Share2,
  Newspaper,
  Calendar,
  Building,
  PhoneCall,
  ShieldCheck,
  FileCheck2,
  Copy,
  Info,
  Navigation,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  LifeBuoy,
  Check,
} from 'lucide-react';
import { getTranslation } from '../../types/language';
import { NewsSkeleton } from '../common/Skeletons';
import { generateEvacuationGuidance } from '../../lib/relevanceEngine';

interface AlertDetailDrawerProps {
  alert: SachetAlert | null;
  onClose: () => void;
  onShare: (alert: SachetAlert) => void;
  language: string;
}

export const AlertDetailDrawer: React.FC<AlertDetailDrawerProps> = ({
  alert,
  onClose,
  onShare,
  language,
}) => {
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState<boolean>(false);
  const [hasCopiedInstruction, setHasCopiedInstruction] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'measures' | 'helplines' | 'news'>('info');
  const t = getTranslation(language);

  // Fetch verified 72h current news for this alert
  useEffect(() => {
    if (!alert) {
      setNewsArticles([]);
      return;
    }

    let isMounted = true;
    setIsLoadingNews(true);

    const query = alert.liveNewsQuery || `${alert.event} ${alert.areaDesc || alert.category}`;
    fetch(`/api/alerts/${encodeURIComponent(alert.id)}/news?q=${encodeURIComponent(query)}&window=72`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setNewsArticles(data.articles || []);
          setIsLoadingNews(false);
        }
      })
      .catch((err) => {
        console.error('Error fetching current news for alert:', err);
        if (isMounted) setIsLoadingNews(false);
      });

    return () => {
      isMounted = false;
    };
  }, [alert?.id]);

  const handleCopyInstruction = async () => {
    if (!alert) return;
    const text = `🚨 OFFICIAL DISASTER ADVISORY (NDMA / SACHET)\nEvent: ${alert.event}\nArea: ${alert.areaDesc}\nSeverity: ${alert.severity}\n\nOFFICIAL INSTRUCTIONS:\n${alert.instruction}\n\nEmergency Helpline: ${alert.helpline || '1070 / 1077 / 112'}\nPortal: ${alert.webUrl || 'https://sachet.ndma.gov.in'}`;
    try {
      await navigator.clipboard.writeText(text);
      setHasCopiedInstruction(true);
      setTimeout(() => setHasCopiedInstruction(false), 2500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  if (!alert) return null;

  // Calculate default guidance for this alert
  const guidance = generateEvacuationGuidance(
    {
      lat: alert.centroid?.[0] || 20.2961,
      lng: alert.centroid?.[1] || 85.8245,
      timestamp: Date.now(),
    },
    alert,
    0,
    true
  );

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[540px] bg-white border-l border-slate-200 shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">
              {alert.event}
            </h3>
            <span className="text-[11px] text-slate-500 font-mono block truncate">
              ID: {alert.identifier || alert.id}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onShare(alert)}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-xs"
            title="Share Alert"
          >
            <Share2 className="w-4 h-4 text-indigo-600" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-xs"
            title="Close Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-4 pt-3 pb-1 border-b border-slate-200 bg-white flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('info')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'info'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Overview &amp; CAP Info
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('measures')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'measures'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Protective Measures
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('helplines')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
            activeTab === 'helplines'
              ? 'bg-rose-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <PhoneCall className="w-3 h-3" />
          <span>Helplines</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('news')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
            activeTab === 'news'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Newspaper className="w-3 h-3" />
          <span>News</span>
        </button>
      </div>

      {/* Drawer Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {/* Tab 1: Overview & CAP Info */}
        {activeTab === 'info' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Telemetry Header */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>NDMA SACHET Live CAP Feed</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200">
                  {alert.feedOrigin || 'NDMA_SACHET_LIVE'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-slate-500 block">Issuing Authority:</span>
                  <span className="font-semibold text-slate-800">{alert.sourceAgency || alert.sender}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Bulletin Reference:</span>
                  <span className="font-mono font-semibold text-slate-800">{alert.bulletinNo || alert.identifier}</span>
                </div>
              </div>
            </div>

            {/* Verbatim Official Instructions (Top Priority) */}
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
                  <AlertOctagon className="w-4 h-4 text-rose-600" />
                  <span>{t.officialInstructionTitle} (SACHET / NDMA)</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyInstruction}
                  className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-rose-700 border border-rose-200 text-[11px] font-bold flex items-center gap-1 transition-all"
                >
                  <Copy className="w-3 h-3" />
                  <span>{hasCopiedInstruction ? 'Copied!' : 'Copy Advisory'}</span>
                </button>
              </div>
              <p className="text-xs sm:text-sm text-slate-900 font-medium whitespace-pre-line leading-relaxed">
                {alert.instruction}
              </p>
            </div>

            {/* Headline & Overview */}
            <div className="space-y-1.5">
              <h4 className="font-bold text-sm sm:text-base text-slate-900">{alert.headline}</h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{alert.description}</p>
            </div>

            {/* Official CAP Metadata Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Severity / Urgency</span>
                <div className="font-semibold text-slate-900 mt-0.5">{alert.severity} • {alert.urgency}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Certainty</span>
                <div className="font-semibold text-slate-900 mt-0.5">{alert.certainty}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 col-span-2">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Affected Area Description</span>
                <div className="font-semibold text-slate-900 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>{alert.areaDesc}</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Effective Time</span>
                <div className="text-slate-700 font-mono text-[11px] mt-0.5">
                  {new Date(alert.effective).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{' '}
                  {new Date(alert.effective).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Expiry Time</span>
                <div className="text-slate-700 font-mono text-[11px] mt-0.5">
                  {new Date(alert.expires).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{' '}
                  {new Date(alert.expires).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </div>
              </div>
              {alert.polygon && alert.polygon.coordinates && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 col-span-2">
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Geographic Polygon Vertex Count</span>
                  <div className="font-mono text-xs text-slate-800 mt-0.5">
                    {alert.polygon.coordinates.length} Vector Coordinates Defined
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Measures & Evacuation Guidelines */}
        {activeTab === 'measures' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                <Navigation className="w-4 h-4 text-amber-600" />
                <span>Standard Evacuation Protocol</span>
              </div>
              <p className="text-xs text-slate-800 leading-relaxed font-medium">
                Recommendation: Move at least {guidance.safeDistanceKm} km towards {guidance.recommendedDirection} to reach safe designated relief shelters and high elevation.
              </p>
            </div>

            <div className="space-y-2">
              <div className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                Actionable Protective Measures
              </div>
              <div className="space-y-2">
                {guidance.actionableMeasures.map((measure, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed flex items-start gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-indigo-600 mt-1 shrink-0" />
                    <span>{measure}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <div className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Do&apos;s</span>
                </div>
                {guidance.dos.map((d, idx) => (
                  <div key={idx} className="text-[11px] text-slate-700 leading-snug flex items-start gap-1">
                    <Check className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{d}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-1.5">
                <div className="text-xs font-bold text-rose-900 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Don&apos;ts</span>
                </div>
                {guidance.donts.map((d, idx) => (
                  <div key={idx} className="text-[11px] text-slate-700 leading-snug flex items-start gap-1">
                    <XCircle className="w-3 h-3 text-rose-600 mt-0.5 shrink-0" />
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Helplines */}
        {activeTab === 'helplines' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900">
              <span className="flex items-center gap-1.5">
                <LifeBuoy className="w-4 h-4 text-rose-600" />
                <span>Emergency Control Rooms &amp; Helplines</span>
              </span>
              <span className="text-[10px] text-slate-500">Tap to call</span>
            </div>

            <div className="space-y-2">
              {guidance.emergencyContacts.map((c, idx) => (
                <a
                  key={idx}
                  href={`tel:${c.number.replace(/[^0-9]/g, '')}`}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-rose-300 hover:bg-white transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">{c.label}</div>
                    <div className="text-[11px] text-slate-500">{c.description}</div>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-rose-50 group-hover:bg-rose-600 text-rose-700 group-hover:text-white font-mono font-bold text-xs shrink-0 transition-colors flex items-center gap-1.5">
                    <PhoneCall className="w-3 h-3" />
                    <span>{c.number}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: News Articles */}
        {activeTab === 'news' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Newspaper className="w-4 h-4 text-indigo-600" />
                <span>{t.currentNewsTitle}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`https://news.google.com/search?q=${encodeURIComponent(alert.liveNewsQuery || `${alert.district || ''} ${alert.state || ''} ${alert.category} alert`)}&hl=en-IN&gl=IN&ceid=IN:en`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold border border-blue-200 flex items-center gap-1 transition-colors"
                >
                  <span>Google News</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono border border-indigo-100 font-semibold">
                  72h Filter
                </span>
              </div>
            </div>

            {isLoadingNews ? (
              <NewsSkeleton />
            ) : newsArticles.length > 0 ? (
              <div className="space-y-2.5">
                {newsArticles.map((article) => (
                  <div
                    key={article.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 space-y-1.5 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-indigo-600">{article.publisher}</span>
                      <span className="text-slate-400 font-mono">{article.relativeTime}</span>
                    </div>
                    <h5 className="font-semibold text-xs text-slate-900 leading-snug">{article.title}</h5>
                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      {article.summary}
                    </p>
                    <a
                      href={
                        article.url.startsWith('http')
                          ? article.url
                          : `https://news.google.com/search?q=${encodeURIComponent(article.title)}&hl=en-IN&gl=IN&ceid=IN:en`
                      }
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 pt-0.5 font-medium"
                    >
                      <span>Read Verified Source</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 space-y-2">
                <p>No direct wire matches within the last 72 hours.</p>
                <a
                  href={`https://news.google.com/search?q=${encodeURIComponent(alert.liveNewsQuery || `${alert.district || ''} ${alert.state || ''} ${alert.category} alert`)}&hl=en-IN&gl=IN&ceid=IN:en`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline"
                >
                  <span>Check Live Google News Coverage</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer Footer Actions */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-2.5">
        <a
          href={alert.officialPortalUrl || alert.webUrl || 'https://sachet.ndma.gov.in'}
          target="_blank"
          rel="noreferrer noopener"
          className="flex-1 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
          <span>Official Portal</span>
        </a>

        <a
          href={`https://news.google.com/search?q=${encodeURIComponent(alert.liveNewsQuery || `${alert.district || ''} ${alert.state || ''} ${alert.category} alert`)}&hl=en-IN&gl=IN&ceid=IN:en`}
          target="_blank"
          rel="noreferrer noopener"
          className="py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
          title="Search Google News"
        >
          <Newspaper className="w-3.5 h-3.5 text-blue-600" />
          <span>Live News</span>
        </a>

        <button
          type="button"
          onClick={() => onShare(alert)}
          className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs shadow-rose-200 transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Forward Alert</span>
        </button>
      </div>
    </div>
  );
};
