import React, { useState } from 'react';
import { SachetAlert } from '../../types/disaster';
import {
  X,
  ShieldAlert,
  AlertOctagon,
  Clock,
  MapPin,
  ExternalLink,
  Share2,
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
  LifeBuoy,
  Check,
} from 'lucide-react';
import { getLocale, getTranslation, translate } from '../../types/language';
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
  const [hasCopiedInstruction, setHasCopiedInstruction] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'measures' | 'helplines'>('info');
  const t = getTranslation(language);

  const handleCopyInstruction = async () => {
    if (!alert) return;
    const text = `OFFICIAL DISASTER ADVISORY\nEvent: ${alert.event}\nArea: ${alert.areaDesc}\nSeverity: ${alert.severity}\n\nOFFICIAL INSTRUCTIONS:\n${alert.instruction}\n\nEmergency Helpline: ${alert.helpline || '1070 / 1077 / 112'}\nPortal: ${alert.webUrl || ''}`;
    try {
      await navigator.clipboard.writeText(text);
      setHasCopiedInstruction(true);
      setTimeout(() => setHasCopiedInstruction(false), 2500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  if (!alert) return null;

  const hazardCenter =
    alert.centroid ||
    alert.circle?.center ||
    alert.polygon?.coordinates?.[0] ||
    null;

  const guidance = hazardCenter
    ? generateEvacuationGuidance(
        {
          lat: hazardCenter[0],
          lng: hazardCenter[1],
          timestamp: Date.now(),
        },
        alert,
        0,
        true
    )
    : null;
  const portalUrl = alert.officialPortalUrl || alert.webUrl || null;

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
            title={translate(language, 'alerts.shareAlert')}
          >
            <Share2 className="w-4 h-4 text-indigo-600" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-xs"
            title={translate(language, 'alerts.closeDrawer')}
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
          {translate(language, 'alerts.overview')}
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
          {translate(language, 'alerts.protectiveMeasures')}
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
          <span>{translate(language, 'alerts.helplines')}</span>
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
                  <span>{translate(language, 'alerts.liveAdvisory')}</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200">
                  {alert.feedOrigin || 'LIVE_FEED'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-slate-500 block">{translate(language, 'alerts.issuingAuthority')}:</span>
                  <span className="font-semibold text-slate-800">{alert.sourceAgency || alert.sender}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">{translate(language, 'alerts.bulletinReference')}:</span>
                  <span className="font-mono font-semibold text-slate-800">{alert.bulletinNo || alert.identifier}</span>
                </div>
              </div>
            </div>

            {/* Verbatim Official Instructions (Top Priority) */}
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
                  <AlertOctagon className="w-4 h-4 text-rose-600" />
                  <span>{t.officialInstructionTitle}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyInstruction}
                  className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-rose-700 border border-rose-200 text-[11px] font-bold flex items-center gap-1 transition-all"
                >
                  <Copy className="w-3 h-3" />
                  <span>{hasCopiedInstruction ? translate(language, 'common.copied') : translate(language, 'alerts.copyAdvisory')}</span>
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
                <span className="text-slate-500 text-[10px] uppercase font-bold">{translate(language, 'alerts.severityUrgency')}</span>
                <div className="font-semibold text-slate-900 mt-0.5">{alert.severity} • {alert.urgency}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-bold">{translate(language, 'alerts.certainty')}</span>
                <div className="font-semibold text-slate-900 mt-0.5">{alert.certainty}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 col-span-2">
                <span className="text-slate-500 text-[10px] uppercase font-bold">{translate(language, 'alerts.affectedArea')}</span>
                <div className="font-semibold text-slate-900 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>{alert.areaDesc}</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-bold">{translate(language, 'alerts.effectiveTime')}</span>
                <div className="text-slate-700 font-mono text-[11px] mt-0.5">
                  {new Date(alert.effective).toLocaleTimeString(getLocale(language), { hour: '2-digit', minute: '2-digit' })},{' '}
                  {new Date(alert.effective).toLocaleDateString(getLocale(language), { month: 'short', day: 'numeric' })}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] uppercase font-bold">{translate(language, 'alerts.expiryTime')}</span>
                <div className="text-slate-700 font-mono text-[11px] mt-0.5">
                  {new Date(alert.expires).toLocaleTimeString(getLocale(language), { hour: '2-digit', minute: '2-digit' })},{' '}
                  {new Date(alert.expires).toLocaleDateString(getLocale(language), { month: 'short', day: 'numeric' })}
                </div>
              </div>
              {alert.polygon && alert.polygon.coordinates && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 col-span-2">
                  <span className="text-slate-500 text-[10px] uppercase font-bold">{translate(language, 'alerts.coordinates', { count: alert.polygon.coordinates.length })}</span>
                  <div className="font-mono text-xs text-slate-800 mt-0.5">
                    {alert.polygon.coordinates.length}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Measures & Evacuation Guidelines */}
        {activeTab === 'measures' && (
          <div className="space-y-4 animate-in fade-in">
            {guidance ? (
              <>
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                    <Navigation className="w-4 h-4 text-amber-600" />
                    <span>{translate(language, 'alerts.evacuationProtocol')}</span>
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium">
                    Recommendation: Move at least {guidance.safeDistanceKm} km towards {guidance.recommendedDirection} to reach safe designated relief shelters and high elevation.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                    {translate(language, 'alerts.protectiveActions')}
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
                      <span>{translate(language, 'alerts.dos')}</span>
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
                      <span>{translate(language, 'alerts.donts')}</span>
                    </div>
                    {guidance.donts.map((d, idx) => (
                      <div key={idx} className="text-[11px] text-slate-700 leading-snug flex items-start gap-1">
                        <XCircle className="w-3 h-3 text-rose-600 mt-0.5 shrink-0" />
                        <span>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                {translate(language, 'alerts.noGeometry')}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Helplines */}
        {activeTab === 'helplines' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900">
              <span className="flex items-center gap-1.5">
                <LifeBuoy className="w-4 h-4 text-rose-600" />
                <span>{translate(language, 'alerts.controlRooms')}</span>
              </span>
              <span className="text-[10px] text-slate-500">{translate(language, 'alerts.tapToCall')}</span>
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

      </div>

      {/* Drawer Footer Actions */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-2.5">
        {portalUrl ? (
          <a
            href={portalUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex-1 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
            <span>{translate(language, 'alerts.officialPortal')}</span>
          </a>
        ) : (
          <div className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{translate(language, 'alerts.portalUnavailable')}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => onShare(alert)}
          className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs shadow-rose-200 transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>{translate(language, 'alerts.forward')}</span>
        </button>
      </div>
    </div>
  );
};

