import React, { useEffect, useState } from 'react';
import { ComparisonMatrix, EvidenceBundle } from '../../types/disaster';
import { X, Scale, Sparkles, Check, ExternalLink, ShieldAlert, ArrowRight } from 'lucide-react';
import { getTranslation } from '../../types/language';
import { apiUrl } from '../../lib/api';
import { translateComparison } from '../../lib/googleTranslate';

interface CompareModalProps {
  bundles: EvidenceBundle[];
  onClose: () => void;
  language: string;
}

export const CompareModal: React.FC<CompareModalProps> = ({
  bundles,
  onClose,
  language,
}) => {
  const [comparisonData, setComparisonData] = useState<ComparisonMatrix | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const t = getTranslation(language);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetch(apiUrl('/api/past/compare'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bundles, targetLanguage: 'en' }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          void translateComparison(data as ComparisonMatrix, language).then((localized) => {
            if (!isMounted) return;
            setComparisonData(localized);
          });
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Comparison error:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [bundles, language]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-6xl max-h-[90vh] shadow-2xl flex flex-col justify-between overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900">
              Comparative Analysis: {bundles.map((b) => b.eventName).join(' vs ')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {isLoading ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-500">Reconciling comparative metrics across retrieved evidence...</p>
            </div>
          ) : comparisonData ? (
            <div className="space-y-6">
              {/* AI Comparative Insights */}
              <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-3">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>AI Comparative Intelligence Synthesis</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Citation tags like [S1] and [S2] correspond to the source references listed below each event.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <h5 className="font-bold text-slate-900">Scale of Impact:</h5>
                    <p className="text-slate-700 leading-relaxed">{comparisonData.aiSynthesis?.broaderImpact}</p>
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-bold text-slate-900">Response Disparities:</h5>
                    <p className="text-slate-700 leading-relaxed">{comparisonData.aiSynthesis?.responseDifferences}</p>
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-bold text-slate-900">Institutional Lessons:</h5>
                    <p className="text-slate-700 leading-relaxed">{comparisonData.aiSynthesis?.crossEventLessons}</p>
                  </div>
                </div>
              </div>

              {/* Side-by-side Table Matrix */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3.5 font-bold text-slate-500 uppercase tracking-wider w-1/4">Comparison Dimension</th>
                      {bundles.map((bundle) => (
                        <th key={bundle.id} className="p-3.5 font-bold text-slate-900">
                          <div>{bundle.eventName}</div>
                          <span className="text-[10px] text-slate-500 font-normal">{bundle.dateRange}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {comparisonData.comparisonPoints?.map((point, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="p-3.5 font-bold text-slate-800 bg-slate-50/50 align-top">
                          <div>{point.label}</div>
                          <span className="text-[10px] font-mono text-indigo-600 font-medium">{point.category}</span>
                        </td>
                        {point.values?.map((v, vIdx) => (
                          <td key={vIdx} className="p-3.5 text-slate-700 align-top leading-relaxed">
                            {v.value}
                            {v.citations?.length > 0 && (
                              <span className="ml-1 text-[10px] font-mono font-bold text-indigo-600">
                                [{v.citations.join(', ')}]
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {bundles.map((bundle) => (
                  <div key={`sources-${bundle.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{bundle.eventName}</h4>
                        <p className="text-[11px] text-slate-500">{bundle.dateRange}</p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold font-mono">
                        {bundle.sources.length} Sources
                      </span>
                    </div>

                    <div className="space-y-2">
                      {bundle.sources.map((source) => (
                        <a
                          key={source.id}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="block p-3 rounded-xl border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold border border-slate-200 shrink-0">
                                  [{source.id}]
                                </span>
                                <span className="font-semibold text-sm text-slate-900 truncate">{source.title}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1">
                                {source.publisher} • {new Date(source.publishedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500">
              Unable to load comparison data.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

