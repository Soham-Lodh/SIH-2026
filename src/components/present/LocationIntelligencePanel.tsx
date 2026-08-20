import React, { useState } from 'react';
import {
  RelevanceResult,
  UserLocation,
  SachetAlert,
} from '../../types/disaster';
import {
  ShieldAlert,
  MapPin,
  Clock,
  Compass,
  Share2,
  Search,
  AlertOctagon,
  CheckCircle2,
  PhoneCall,
  Navigation,
  ArrowRight,
  AlertTriangle,
  LifeBuoy,
  XCircle,
  Check,
  Building,
  Volume2,
} from 'lucide-react';
import { getTranslation } from '../../types/language';

interface LocationIntelligencePanelProps {
  userLocation: UserLocation;
  relevanceResults: RelevanceResult[];
  selectedAlert: SachetAlert | null;
  onSelectAlert: (alert: SachetAlert) => void;
  onCheckCustomLocation: (location: UserLocation) => void;
  onResetToGPS: () => void;
  onOpenShareModal: (alert: SachetAlert, result: RelevanceResult) => void;
  language: string;
}

// Preset Indian locations for quick checking
const PRESET_INDIAN_LOCATIONS: { name: string; state: string; lat: number; lng: number }[] = [
  { name: 'Bhubaneswar', state: 'Odisha', lat: 20.2961, lng: 85.8245 },
  { name: 'Puri', state: 'Odisha', lat: 19.8135, lng: 85.8312 },
  { name: 'Cuttack', state: 'Odisha', lat: 20.4625, lng: 85.8828 },
  { name: 'Balasore', state: 'Odisha', lat: 21.4934, lng: 86.9135 },
  { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
  { name: 'Digha', state: 'West Bengal', lat: 21.6266, lng: 87.5074 },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lng: 83.2185 },
  { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  { name: 'Ernakulam / Kochi', state: 'Kerala', lat: 9.9816, lng: 76.2999 },
  { name: 'Wayanad', state: 'Kerala', lat: 11.6854, lng: 76.1320 },
  { name: 'Shimla', state: 'Himachal Pradesh', lat: 31.1048, lng: 77.1734 },
  { name: 'Dehradun', state: 'Uttarakhand', lat: 30.3165, lng: 78.0322 },
  { name: 'Guwahati', state: 'Assam', lat: 26.1445, lng: 91.7362 },
  { name: 'Patna', state: 'Bihar', lat: 25.5941, lng: 85.1376 },
  { name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777 },
  { name: 'Bikaner', state: 'Rajasthan', lat: 28.0229, lng: 73.3119 },
];

export const LocationIntelligencePanel: React.FC<LocationIntelligencePanelProps> = ({
  userLocation,
  relevanceResults,
  selectedAlert,
  onSelectAlert,
  onCheckCustomLocation,
  onResetToGPS,
  onOpenShareModal,
  language,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [activeTab, setActiveTab] = useState<'measures' | 'helplines' | 'dos_donts'>('measures');
  const t = getTranslation(language);

  // Highest priority relevant alert
  const topResult = relevanceResults.find(
    (r) =>
      r.status === 'CRITICAL' ||
      r.status === 'HIGH_PRIORITY' ||
      r.status === 'WARNING' ||
      r.status === 'NEARBY' ||
      r.status === 'AWARENESS_ONLY'
  );

  const activeAlert = selectedAlert || (topResult ? topResult.alert : null);
  const activeRelevance = activeAlert
    ? relevanceResults.find((r) => r.alert.id === activeAlert.id) || topResult
    : null;

  const guidance = activeRelevance?.evacuationGuidance;

  const handleLocationSelect = (loc: typeof PRESET_INDIAN_LOCATIONS[0]) => {
    onCheckCustomLocation({
      lat: loc.lat,
      lng: loc.lng,
      cityName: loc.name,
      state: loc.state,
      timestamp: Date.now(),
      isCustomLookup: true,
    });
    setSearchQuery('');
    setShowPresets(false);
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const matched = PRESET_INDIAN_LOCATIONS.find(
      (l) =>
        l.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        l.state.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );

    if (matched) {
      handleLocationSelect(matched);
    } else {
      onCheckCustomLocation({
        lat: 20.2961,
        lng: 85.8245,
        cityName: searchQuery,
        timestamp: Date.now(),
        isCustomLookup: true,
      });
      setShowPresets(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header & Location Switcher */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <span>{userLocation.isCustomLookup ? 'Queried Location' : 'Your Current Location'}</span>
                {userLocation.isCustomLookup && (
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold border border-indigo-100">
                    Custom Pin
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {userLocation.cityName
                  ? `${userLocation.cityName}, ${userLocation.state || 'India'}`
                  : `${userLocation.lat.toFixed(4)}° N, ${userLocation.lng.toFixed(4)}° E`}
              </p>
            </div>
          </div>

          {userLocation.isCustomLookup && (
            <button
              type="button"
              onClick={onResetToGPS}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline transition-colors"
            >
              Reset to GPS
            </button>
          )}
        </div>

        {/* Check Another Location Search Bar */}
        <div className="relative">
          <form onSubmit={handleManualSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowPresets(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search city/district (e.g. Bhubaneswar, Puri, Kolkata, Shimla)..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-colors"
            >
              Query
            </button>
          </form>

          {/* Location presets dropdown */}
          {showPresets && (
            <div className="absolute top-11 left-0 right-0 z-30 bg-white border border-slate-200 rounded-2xl p-2 shadow-xl space-y-0.5 max-h-52 overflow-y-auto">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5 flex justify-between">
                <span>Select Target Indian Region</span>
                <button
                  type="button"
                  onClick={() => setShowPresets(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  Close
                </button>
              </div>
              {PRESET_INDIAN_LOCATIONS.map((loc) => (
                <button
                  key={loc.name}
                  type="button"
                  onClick={() => handleLocationSelect(loc)}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-slate-50 flex justify-between items-center text-slate-700 hover:text-slate-900 transition-colors"
                >
                  <span className="font-semibold">{loc.name}</span>
                  <span className="text-[11px] text-slate-500">{loc.state}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Intelligence Block */}
      {activeAlert && activeRelevance && activeRelevance.status !== 'NOT_RELEVANT' ? (
        <div className="space-y-4">
          {/* SOS Real-time Threat & Evacuation Banner */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              activeRelevance.status === 'CRITICAL' || activeRelevance.status === 'HIGH_PRIORITY'
                ? 'bg-rose-50/80 border-rose-200 text-rose-950 shadow-sm'
                : activeRelevance.status === 'WARNING' || activeRelevance.status === 'NEARBY'
                ? 'bg-amber-50/80 border-amber-200 text-amber-950 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  className={`w-5 h-5 ${
                    activeRelevance.status === 'CRITICAL'
                      ? 'text-rose-600 animate-pulse'
                      : 'text-amber-600'
                  }`}
                />
                <span className="font-bold text-xs uppercase tracking-wider">
                  {activeAlert.severity} Hazard: {activeAlert.event}
                </span>
              </div>
              <span
                className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                  activeRelevance.status === 'CRITICAL'
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                {activeRelevance.distanceKm === 0
                  ? 'Inside Danger Zone'
                  : `~${activeRelevance.distanceKm} km away`}
              </span>
            </div>

            {/* Approach Description & Vector */}
            {guidance && (
              <div className="p-3 rounded-xl bg-white/90 border border-rose-200/70 text-slate-900 space-y-2 mb-3 shadow-xs">
                <div className="flex items-start gap-2">
                  <Navigation className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {guidance.approachDescription}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      Hazard Origin: <span className="font-semibold text-slate-800">{guidance.hazardOriginName}</span> • Bearing: <span className="font-semibold text-slate-800">{guidance.bearingCardinal} ({guidance.bearingDegrees}°)</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-rose-700 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    Recommended Evacuation:
                  </span>
                  <span className="font-bold text-slate-900">
                    Move ~{guidance.safeDistanceKm} km towards {guidance.recommendedDirection}
                  </span>
                </div>
              </div>
            )}

            {/* Plain Summary */}
            <p className="text-xs sm:text-sm font-semibold leading-snug">
              {activeRelevance.plainSummary}
            </p>

            <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>{activeRelevance.confidenceLabel}</span>
            </div>
          </div>

          {/* Verbatim Official Instructions Box */}
          <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
              <AlertOctagon className="w-4 h-4 text-amber-600" />
              <span>{t.officialInstructionTitle} (NDMA / SACHET)</span>
            </div>
            <p className="text-xs text-slate-800 font-medium whitespace-pre-line leading-relaxed">
              {activeAlert.instruction}
            </p>
          </div>

          {/* Dynamic Tabs: Measures | Helplines & SOS | Do's & Don'ts */}
          <div className="space-y-2.5">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('measures')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'measures'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Protective Measures
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('helplines')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'helplines'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PhoneCall className="w-3 h-3" />
                <span>Emergency Helplines</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('dos_donts')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'dos_donts'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Do&apos;s &amp; Don&apos;ts
              </button>
            </div>

            {/* Tab 1: Measures Content */}
            {activeTab === 'measures' && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 animate-in fade-in">
                <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                  <span>Actionable Safety Protocol</span>
                  <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full font-mono">
                    Category: {activeAlert.category}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {guidance?.actionableMeasures.map((measure, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-slate-700 leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200/70 flex items-start gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                      <span>{measure}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 2: Emergency Helplines & SOS Quick-Dial */}
            {activeTab === 'helplines' && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <span className="flex items-center gap-1.5">
                    <LifeBuoy className="w-4 h-4 text-rose-600" />
                    <span>24x7 Verified Disaster Helplines</span>
                  </span>
                  <span className="text-[10px] text-slate-500">Tap to Call Directly</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {guidance?.emergencyContacts.map((contact, idx) => (
                    <a
                      key={idx}
                      href={`tel:${contact.number.replace(/[^0-9]/g, '')}`}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-rose-300 hover:shadow-xs transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-[11px] font-bold text-slate-900 truncate">
                          {contact.label}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {contact.description}
                        </div>
                      </div>
                      <div className="px-2.5 py-1 rounded-lg bg-rose-50 group-hover:bg-rose-600 text-rose-700 group-hover:text-white font-mono font-bold text-xs shrink-0 transition-colors flex items-center gap-1">
                        <PhoneCall className="w-3 h-3" />
                        <span>{contact.number}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Do's and Don'ts */}
            {activeTab === 'dos_donts' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in">
                {/* Do's */}
                <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Essential Do&apos;s</span>
                  </div>
                  <div className="space-y-1.5">
                    {guidance?.dos.map((item, idx) => (
                      <div
                        key={idx}
                        className="text-[11px] text-slate-800 leading-snug flex items-start gap-1.5"
                      >
                        <Check className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Don'ts */}
                <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2">
                  <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Critical Don&apos;ts</span>
                  </div>
                  <div className="space-y-1.5">
                    {guidance?.donts.map((item, idx) => (
                      <div
                        key={idx}
                        className="text-[11px] text-slate-800 leading-snug flex items-start gap-1.5"
                      >
                        <XCircle className="w-3 h-3 text-rose-600 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Row: Share, View Full Alert Details */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenShareModal(activeAlert, activeRelevance)}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>{t.share}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectAlert(activeAlert)}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs shadow-rose-200"
            >
              <span>{t.viewDetails}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Safe Status State */
        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 shadow-xs">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900">{t.noAlertsNearby}</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              No active extreme hazard warnings directly intersect your selected coordinates ({userLocation.cityName || 'Current Point'}).
            </p>
          </div>

          {/* Always provide quick helpline reference */}
          <div className="pt-3 border-t border-slate-200 text-left">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
              National Emergency Helplines
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <a
                href="tel:112"
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-bold hover:bg-slate-50"
              >
                112 (SOS)
              </a>
              <a
                href="tel:1070"
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-bold hover:bg-slate-50"
              >
                1070 (SEOC)
              </a>
              <a
                href="tel:1078"
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-bold hover:bg-slate-50"
              >
                1078 (NDRF)
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
