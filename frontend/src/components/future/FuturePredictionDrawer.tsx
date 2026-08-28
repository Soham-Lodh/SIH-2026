import React, { useState } from 'react';
import {
  X,
  MapPin,
  Activity,
  AlertTriangle,
  TrendingUp,
  Info,
  Calendar,
  Compass,
} from 'lucide-react';
import { translate } from '../../types/language';

interface FloodPrediction {
  rank: number;
  month: number;
  latitude: number;
  longitude: number;
  flood_probability: number;
  flood_probability_percent: number;
  peak_flood_level_m: number;
  warning_level: number;
  danger_level: number;
  historical_observations?: number;
}

interface FuturePredictionDrawerProps {
  prediction: FloodPrediction | null;
  selectedMonthLabel: string;
  onClose: () => void;
  language: string;
}

export const FuturePredictionDrawer: React.FC<FuturePredictionDrawerProps> = ({
  prediction,
  selectedMonthLabel,
  onClose,
  language,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analysis'>('overview');

  if (!prediction) return null;

  const probability = prediction.flood_probability_percent;
  const isHighRisk = probability >= 80;
  const isMediumRisk = probability >= 50 && probability < 80;

  // Determine Risk Category Details
  const riskColorClass = isHighRisk
    ? 'text-rose-600 bg-rose-50 border-rose-100 ring-rose-200'
    : isMediumRisk
      ? 'text-amber-700 bg-amber-50 border-amber-100 ring-amber-200'
      : 'text-emerald-700 bg-emerald-50 border-emerald-100 ring-emerald-200';

  const riskLabelKey = isHighRisk
    ? 'future.highRisk'
    : isMediumRisk
      ? 'future.mediumRisk'
      : 'future.lowRisk';

  // Severity indicator logic
  const isAboveDanger = prediction.peak_flood_level_m > prediction.danger_level;
  const isAboveWarning = prediction.peak_flood_level_m > prediction.warning_level && !isAboveDanger;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white border-l border-slate-200 shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
      
      {/* Drawer Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${isHighRisk ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">
              {translate(language, 'future.rankTitle', { rank: prediction.rank })}
            </h3>
            <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-semibold">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>{selectedMonthLabel}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-xs cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 pb-1 border-b border-slate-200 bg-white flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {translate(language, 'future.tabOverview')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('analysis')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'analysis'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {translate(language, 'future.tabAnalysis')}
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
        
        {activeTab === 'overview' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            
            {/* Risk Indicator Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-800">
                    {translate(language, 'future.probability')}
                  </span>
                </div>
                <div className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ring-2 ring-offset-1 ${riskColorClass}`}>
                  {translate(language, riskLabelKey)}
                </div>
              </div>

              <div className="flex items-baseline gap-1 pt-1">
                <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {probability.toFixed(2)}%
                </span>
              </div>

              <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isHighRisk
                      ? 'bg-rose-600'
                      : isMediumRisk
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${probability}%` }}
                />
              </div>

              <p className="text-[10px] leading-relaxed text-slate-500">
                {translate(language, 'future.probabilityDesc')}
              </p>
            </div>

            {/* Coordinates Grid */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-slate-500" />
                <span>{translate(language, 'future.coordinates')}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">
                    {translate(language, 'future.latitude')}
                  </span>
                  <div className="text-sm font-mono font-bold text-slate-900 mt-1">
                    {prediction.latitude.toFixed(6)}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">
                    {translate(language, 'future.longitude')}
                  </span>
                  <div className="text-sm font-mono font-bold text-slate-900 mt-1">
                    {prediction.longitude.toFixed(6)}
                  </div>
                </div>
              </div>
            </div>

            {/* Historical Observations */}
            {typeof prediction.historical_observations === 'number' && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {translate(language, 'future.historicalTitle')}
                </div>
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-between">
                  <div className="text-[10px] text-slate-500 font-semibold pr-2">
                    {translate(language, 'future.historicalDesc')}
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-xs">
                    {prediction.historical_observations}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            
            {/* Level comparison cards */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                <span>{translate(language, 'future.severityTitle')}</span>
              </div>
              
              <div className="space-y-2.5">
                
                {/* Peak level card */}
                <div className="flex items-center justify-between border border-slate-200 rounded-xl p-3.5 bg-slate-50">
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      {translate(language, 'future.peakLevel')}
                    </span>
                    <div className="text-[9px] font-semibold text-slate-500 mt-0.5">
                      Estimated peak river water level
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-mono font-extrabold text-base text-slate-900">
                      {prediction.peak_flood_level_m.toFixed(2)} m
                    </span>
                    {isAboveDanger ? (
                      <span className="text-[8px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-full px-2 py-0.5 uppercase tracking-wide">
                        {translate(language, 'future.aboveDanger')}
                      </span>
                    ) : isAboveWarning ? (
                      <span className="text-[8px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5 uppercase tracking-wide">
                        {translate(language, 'future.aboveWarning')}
                      </span>
                    ) : (
                      <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5 uppercase tracking-wide">
                        {translate(language, 'future.belowWarning')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Danger level card */}
                <div className="flex items-center justify-between border border-slate-200 rounded-xl p-3 bg-white">
                  <div>
                    <span className="text-xs font-bold text-slate-700">
                      {translate(language, 'future.dangerLevel')}
                    </span>
                    <div className="text-[9px] text-slate-400 mt-0.5">
                      Critical danger threshold for structures
                    </div>
                  </div>
                  <span className="font-mono font-extrabold text-sm text-slate-800">
                    {prediction.danger_level.toFixed(2)} m
                  </span>
                </div>

                {/* Warning level card */}
                <div className="flex items-center justify-between border border-slate-200 rounded-xl p-3 bg-white">
                  <div>
                    <span className="text-xs font-bold text-slate-700">
                      {translate(language, 'future.warningLevel')}
                    </span>
                    <div className="text-[9px] text-slate-400 mt-0.5">
                      Warning threshold triggering evacuations
                    </div>
                  </div>
                  <span className="font-mono font-extrabold text-sm text-slate-800">
                    {prediction.warning_level.toFixed(2)} m
                  </span>
                </div>

              </div>
            </div>

            {/* Model Disclaimer */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-1.5">
              <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-[10px] uppercase tracking-wider">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>{translate(language, 'future.modelTitle')}</span>
              </div>
              <p className="text-[10px] leading-relaxed text-indigo-950 font-medium">
                {translate(language, 'future.modelDesc')}
              </p>
            </div>

          </div>
        )}

      </div>

      {/* Drawer Footer Actions */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-center">
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
        >
          {translate(language, 'common.close')}
        </button>
      </div>

    </div>
  );
};
