import React, { useEffect, useState } from 'react';
import { RelevanceResult, SachetAlert } from '../../types/disaster';
import { ShieldAlert, X, Share2, ArrowRight, BellRing } from 'lucide-react';
import { getTranslation } from '../../types/language';

interface RealtimeWarningToastProps {
  topRelevance: RelevanceResult | null;
  onViewDetails: (alert: SachetAlert) => void;
  onShare: (alert: SachetAlert, rel: RelevanceResult) => void;
  language: string;
}

export const RealtimeWarningToast: React.FC<RealtimeWarningToastProps> = ({
  topRelevance,
  onViewDetails,
  onShare,
  language,
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const t = getTranslation(language);

  // Re-open if a new critical alert appears
  useEffect(() => {
    if (topRelevance && topRelevance.alert.id !== dismissedId) {
      setIsDismissed(false);
    }
  }, [topRelevance?.alert.id, dismissedId]);

  if (!topRelevance || isDismissed) return null;
  if (!topRelevance.isInsideBoundary) return null;
  if (topRelevance.status !== 'CRITICAL' && topRelevance.status !== 'HIGH_PRIORITY') return null;

  const alert = topRelevance.alert;

  const handleDismiss = () => {
    setIsDismissed(true);
    setDismissedId(alert.id);
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 max-w-md w-[calc(100vw-40px)] sm:w-96 rounded-2xl bg-white border border-rose-200 shadow-2xl p-4 animate-in slide-in-from-bottom-5 duration-300 ring-1 ring-rose-100">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
            <BellRing className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block font-mono">
              OFFICIAL EMERGENCY WARNING
            </span>
            <h4 className="font-bold text-sm text-slate-900 leading-tight truncate max-w-[200px]">
              {alert.event}
            </h4>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Dismiss Toast"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Proximity & Why it matters */}
      <div className="my-2.5 space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-800">{alert.areaDesc}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            {topRelevance.distanceKm === 0 ? 'Inside Polygon' : `${topRelevance.distanceKm} km away`}
          </span>
        </div>
        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
          {topRelevance.plainSummary}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onViewDetails(alert)}
          className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
        >
          <span>{t.viewDetails}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onShare(alert, topRelevance)}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
          title="Share Warning"
        >
          <Share2 className="w-4 h-4 text-indigo-600" />
        </button>
      </div>
    </div>
  );
};

