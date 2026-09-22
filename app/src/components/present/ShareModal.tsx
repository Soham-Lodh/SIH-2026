import React, { useState } from 'react';
import { SachetAlert, RelevanceResult } from '../../types/disaster';
import { X, Check, Copy, Share2, MessageCircle, AlertTriangle } from 'lucide-react';
import { getTranslation } from '../../types/language';

interface ShareModalProps {
  alert: SachetAlert | null;
  relevanceResult?: RelevanceResult | null;
  onClose: () => void;
  language: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  alert,
  relevanceResult,
  onClose,
  language,
}) => {
  const [copied, setCopied] = useState(false);
  const t = getTranslation(language);

  if (!alert) return null;

  const shareText = `OFFICIAL DISASTER ALERT (${alert.severity.toUpperCase()})
Event: ${alert.event}
Area: ${alert.areaDesc}
${relevanceResult && relevanceResult.distanceKm !== undefined ? `Proximity: ${relevanceResult.distanceKm === 0 ? 'INSIDE ZONE' : `${relevanceResult.distanceKm} km away`}\n` : ''}
OFFICIAL INSTRUCTIONS:
${alert.instruction}

Valid Until: ${new Date(alert.expires).toLocaleString()}
Issued by: ${alert.sender}
Verified via Disaster Intelligence Platform India`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `ALERT: ${alert.event}`,
          text: shareText,
        });
      } catch (err) {
        // Share cancelled or unavailable
      }
    } else {
      handleCopy();
    }
  };

  const handleWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-900">{t.share} Official Alert</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Share Body Preview */}
        <div className="p-5 space-y-4">
          <div className="text-xs text-slate-500">
            Share this official verification with family, community groups, or emergency contacts:
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 whitespace-pre-line max-h-56 overflow-y-auto leading-relaxed select-all">
            {shareText}
          </div>

          {/* Quick Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleWhatsApp}
              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Share to WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleNativeShare}
              className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Share2 className="w-4 h-4" />
              <span>Native Share</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className={`w-full py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              copied
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Text to Clipboard'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

