import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  SachetAlert,
  UserLocation,
  RelevanceResult,
} from '../../types/disaster';
import { evaluateAllAlertsRelevance } from '../../lib/relevanceEngine';
import { IndiaLiveMap } from './IndiaLiveMap';
import { resolveAlertMapPoint } from './IndiaLiveMap';
import { UserLocationMap } from './UserLocationMap';
import { LocationIntelligencePanel } from './LocationIntelligencePanel';
import { AlertDetailDrawer } from './AlertDetailDrawer';
import { RealtimeWarningToast } from './RealtimeWarningToast';
import { ShareModal } from './ShareModal';
import { IndiaMapSkeleton, UserMapSkeleton, LocationSkeleton } from '../common/Skeletons';
import { Radio, Layers, MapPin, RefreshCw, AlertTriangle } from 'lucide-react';
import { translate } from '../../types/language';
import { apiUrl } from '../../lib/api';

interface PresentWorkspaceProps {
  language: string;
  onFeedStatusChange?: (status: 'LIVE_FETCH' | 'ETAG_CACHED' | 'FALLBACK_SNAPSHOT' | 'ERROR', lastUpdated: string) => void;
}

export const PresentWorkspace: React.FC<PresentWorkspaceProps> = ({
  language,
  onFeedStatusChange,
}) => {
  const [alerts, setAlerts] = useState<SachetAlert[]>([]);
  const [etag, setEtag] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedAlert, setSelectedAlert] = useState<SachetAlert | null>(null);
  const [mobileTab, setMobileTab] = useState<'india' | 'nearme'>('india');

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

  const [relevanceResults, setRelevanceResults] = useState<RelevanceResult[]>([]);
  const [shareAlert, setShareAlert] = useState<SachetAlert | null>(null);
  const [shareRelevance, setShareRelevance] = useState<RelevanceResult | null>(null);
  const etagRef = useRef<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
          cityName: 'Current GPS Point',
          timestamp: Date.now(),
          isCustomLookup: false,
        });
      },
      (err) => {
        console.log('Geolocation unavailable or denied:', err.message);
      },
      { timeout: 5000 }
    );
  }, []);

  // Fetch SACHET alerts
  const fetchAlerts = async () => {
    try {
      const headers: Record<string, string> = {};
      if (etagRef.current) {
        headers['If-None-Match'] = etagRef.current;
      }

      // Locale changes presentation only; canonical official alert data is never refetched for translation.
      const res = await fetch(apiUrl('/api/alerts'), { headers });

      if (res.status === 304) {
        // Not modified, ETag cached
        if (onFeedStatusChange) onFeedStatusChange('ETAG_CACHED', new Date().toISOString());
        setIsLoading(false);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
        if (data.etag) {
          etagRef.current = data.etag;
          setEtag(data.etag);
        }
        if (onFeedStatusChange) {
          onFeedStatusChange(
            data.cacheStatus === 'FALLBACK_SNAPSHOT' ? 'FALLBACK_SNAPSHOT' : 'LIVE_FETCH',
            data.lastUpdated || new Date().toISOString()
          );
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      console.error('Failed to fetch SACHET alerts:', err);
      if (onFeedStatusChange) onFeedStatusChange('ERROR', new Date().toISOString());
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch and 30-sec polling
  useEffect(() => {
    void fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchAlerts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Run 5-Case Geospatial Relevance Engine whenever alerts or user location updates
  useEffect(() => {
    if (alerts.length > 0 && userLocation) {
      const results = evaluateAllAlertsRelevance(alerts, userLocation);
      setRelevanceResults(results);
    } else {
      setRelevanceResults([]);
    }
  }, [alerts, userLocation]);

  const displayAlerts = useMemo(
    () => alerts.filter((alert, index) => Boolean(resolveAlertMapPoint(alert, index))),
    [alerts]
  );

  // Nearby alerts for user location map
  const nearbyAlerts = relevanceResults
    .filter((r) => r.status !== 'NOT_RELEVANT')
    .map((r) => r.alert);

  const topRelevance =
    relevanceResults.find((r) => r.isInsideBoundary && r.status !== 'NOT_RELEVANT') || null;

  const handleSelectAlert = (alert: SachetAlert) => {
    setSelectedAlert(alert);
  };

  const handleCheckCustomLocation = (loc: UserLocation) => {
    setUserLocation(loc);
  };

  const handleResetToGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy,
            cityName: 'Current GPS Point',
            timestamp: Date.now(),
            isCustomLookup: false,
          });
        },
        () => {
          setUserLocation(null);
        }
      );
    }
  };

  const handleOpenShare = (alert: SachetAlert, rel?: RelevanceResult) => {
    setShareAlert(alert);
    setShareRelevance(rel || null);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* Mobile Tab Switcher */}
      <div className="flex sm:hidden bg-white p-1 rounded-xl border border-[#DDDDDD]">
        <button
          type="button"
          onClick={() => setMobileTab('india')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'india' ? 'bg-[#0F1B29] text-white shadow-sm' : 'text-[#747F8D]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{translate(language, 'present.allHazards', { count: displayAlerts.length })}</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('nearme')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'nearme' ? 'bg-[#0F1B29] text-white shadow-sm' : 'text-[#747F8D]'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>{translate(language, 'present.nearMe', { count: nearbyAlerts.length })}</span>
        </button>
      </div>

      {/* Top Map: India Live Disaster Map */}
      <div className={`${mobileTab === 'india' ? 'block' : 'hidden sm:block'} space-y-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#0F1B29] animate-pulse" />
            <h2 className="font-bold text-sm sm:text-base text-[#0F1B29]">
              {translate(language, 'present.mapTitle')}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#ECF8F8] text-[#0F1B29] font-mono font-medium border border-[#DDDDDD]">
              {translate(language, 'present.activeHazards', { count: displayAlerts.length })}
            </span>
          </div>
        </div>

        {isLoading ? (
          <IndiaMapSkeleton />
        ) : (
          <div className="space-y-3">
            <IndiaLiveMap
              alerts={displayAlerts}
              selectedAlertId={selectedAlert?.id || null}
              onSelectAlert={handleSelectAlert}
              userCoordinates={userLocation ? [userLocation.lat, userLocation.lng] : undefined}
              language={language}
            />

            {!userLocation && (
              <div className="rounded-2xl bg-white border border-dashed border-[#DDDDDD] px-4 py-3 shadow-sm flex items-center gap-3">
                <MapPin className="w-5 h-5 text-[#0F1B29] shrink-0" />
                <p className="text-xs text-[#747F8D] leading-relaxed">
                  {translate(language, 'present.locationOptional')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Dual-Panel Layout: Location Intelligence + User Location Map */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${mobileTab === 'nearme' ? 'block' : 'hidden sm:grid'}`}>
        {/* Bottom Left: Location Intelligence Panel */}
        <div className="lg:col-span-6 space-y-4">
          {isLoading ? (
            <LocationSkeleton />
          ) : (
            <LocationIntelligencePanel
              userLocation={userLocation}
              relevanceResults={relevanceResults}
              selectedAlert={selectedAlert}
              onSelectAlert={handleSelectAlert}
              onCheckCustomLocation={handleCheckCustomLocation}
              onResetToGPS={handleResetToGPS}
              onOpenShareModal={(a, r) => handleOpenShare(a, r)}
              language={language}
            />
          )}
        </div>

        {/* Bottom Right: User Proximity Map */}
        <div className="lg:col-span-6 space-y-4">
          {isLoading ? (
            <UserMapSkeleton />
          ) : (
            <UserLocationMap
              alerts={displayAlerts}
              nearbyAlerts={nearbyAlerts}
              userLocation={userLocation}
              selectedAlertId={selectedAlert?.id || null}
              onSelectAlert={handleSelectAlert}
              language={language}
            />
          )}
        </div>
      </div>

      {/* Non-blocking Realtime Warning Toast */}
      <RealtimeWarningToast
        topRelevance={topRelevance}
        onViewDetails={handleSelectAlert}
        onShare={(a, r) => handleOpenShare(a, r)}
        language={language}
      />

      {/* Slide-over Alert Details Drawer */}
      {selectedAlert && (
        <AlertDetailDrawer
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onShare={(a) => handleOpenShare(a)}
          language={language}
        />
      )}

      {/* Share Modal */}
      {shareAlert && (
        <ShareModal
          alert={shareAlert}
          relevanceResult={shareRelevance}
          onClose={() => {
            setShareAlert(null);
            setShareRelevance(null);
          }}
          language={language}
        />
      )}
    </div>
  );
};

