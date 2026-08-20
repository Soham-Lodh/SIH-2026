import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { SachetAlert, UserLocation } from '../../types/disaster';
import { getCategoryIconSvg, resolveAlertMapPoint } from './IndiaLiveMap';
import { Locate } from 'lucide-react';

interface UserLocationMapProps {
  alerts: SachetAlert[];
  nearbyAlerts: SachetAlert[];
  userLocation: UserLocation | null;
  selectedAlertId: string | null;
  onSelectAlert: (alert: SachetAlert) => void;
}

export const UserLocationMap: React.FC<UserLocationMapProps> = ({
  alerts,
  nearbyAlerts,
  userLocation,
  selectedAlertId,
  onSelectAlert,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: userLocation ? [userLocation.lat, userLocation.lng] : [21.5, 82.0],
        zoom: userLocation ? 11 : 5,
        zoomControl: false,
      });

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; CARTO &copy; OSM',
          subdomains: 'abcd',
          maxZoom: 19,
        }
      ).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;
      mapInstanceRef.current = map;

      window.setTimeout(() => {
        map.invalidateSize();
        if (userLocation) {
          map.setView([userLocation.lat, userLocation.lng], 11, { animate: false });
        }
      }, 0);
    } else {
      if (userLocation) {
        mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 11, { animate: false });
      }
    }

    if (mapContainerRef.current && !resizeObserverRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        window.requestAnimationFrame(() => {
          mapInstanceRef.current?.invalidateSize();
        });
      });
      resizeObserverRef.current.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [userLocation]);

  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    const allAlerts = alerts.length > 0 ? alerts : nearbyAlerts;
    const fitPoints: [number, number][] = [];
    const selectedAlert = selectedAlertId ? allAlerts.find((alert) => alert.id === selectedAlertId) : null;

    if (userLocation) {
      const userIconHtml = `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-7 h-7 rounded-full bg-indigo-500/20 animate-ping"></div>
          <div class="w-4 h-4 rounded-full bg-indigo-600 ring-4 ring-indigo-200 shadow-xl"></div>
        </div>
      `;
      const userIcon = L.divIcon({
        html: userIconHtml,
        className: 'user-pin-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 2000 })
        .bindPopup(`<strong>Your Location</strong><br/>${userLocation.cityName || 'Coordinates'}<br/>${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`)
        .addTo(layerGroup);
      fitPoints.push([userLocation.lat, userLocation.lng]);
    }

    // 2. Nearby alert polygons and markers
    allAlerts.forEach((alert, index) => {
      const isSelected = alert.id === selectedAlertId;
      const isNearby = nearbyAlerts.some((item) => item.id === alert.id);
      const strokeColor = isSelected ? '#4f46e5' : isNearby ? '#e11d48' : '#f59e0b';

      if (alert.polygon && alert.polygon.coordinates && alert.polygon.coordinates.length >= 3) {
        const polygon = L.polygon(alert.polygon.coordinates, {
          color: strokeColor,
          weight: 3,
          fillColor: '#f43f5e',
          fillOpacity: 0.25,
          smoothFactor: 1,
        });
        polygon.on('click', () => onSelectAlert(alert));
        polygon.addTo(layerGroup);
      }

      if (alert.circle && alert.circle.center) {
        L.circle(alert.circle.center, {
          radius: (alert.circle.radiusKm || 25) * 1000,
          color: strokeColor,
          fillColor: '#f43f5e',
          fillOpacity: 0.2,
        }).addTo(layerGroup);
      }

      const markerPos = resolveAlertMapPoint(alert, index);

      if (markerPos) {
        fitPoints.push(markerPos);
        const iconHtml = `
          <div class="cursor-pointer flex flex-col items-center">
            <div class="w-7 h-7 rounded-2xl bg-white border border-slate-200 ring-2 ${isNearby ? 'ring-rose-200' : 'ring-amber-200'} flex items-center justify-center shadow-md">
              ${getCategoryIconSvg(alert.category, alert.severity)}
            </div>
          </div>
        `;
        const marker = L.marker(markerPos, {
          icon: L.divIcon({ html: iconHtml, className: 'near-disaster-marker', iconSize: [30, 30], iconAnchor: [15, 15] }),
        });
        marker.on('click', () => onSelectAlert(alert));
        marker.addTo(layerGroup);

        if (userLocation && isNearby) {
          // Draw dotted proximity line to user for nearby hazards only
          L.polyline([[userLocation.lat, userLocation.lng], markerPos], {
            color: '#6366f1',
            weight: 2,
            dashArray: '5, 8',
            opacity: 0.8,
          }).addTo(layerGroup);
        }
      }
    });

    const selectedPoint = selectedAlert ? resolveAlertMapPoint(selectedAlert, allAlerts.indexOf(selectedAlert)) : null;

    if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 11, { animate: false });
    } else if (selectedPoint) {
      map.setView(selectedPoint, 10, { animate: false });
    } else if (fitPoints.length > 0) {
      const bounds = L.latLngBounds(fitPoints.map((pos) => L.latLng(pos[0], pos[1])));
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.12), { padding: [28, 28], maxZoom: 10, animate: false });
      }
    }
  }, [alerts, nearbyAlerts, userLocation, selectedAlertId, onSelectAlert]);

  const handleRecenter = () => {
    if (mapInstanceRef.current && userLocation) {
      mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 10, { animate: true });
    }
  };

  return (
    <div className="relative w-full h-[320px] sm:h-[360px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Actions */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleRecenter}
          disabled={!userLocation}
          className="p-2 rounded-xl bg-white/95 text-indigo-600 hover:text-indigo-800 border border-slate-200 shadow-md backdrop-blur-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Center on My Location"
        >
          <Locate className="w-4 h-4" />
        </button>
      </div>

      <div className="absolute bottom-3 left-3 z-10 px-3 py-1.5 rounded-full bg-white/95 border border-slate-200 text-[11px] text-slate-700 backdrop-blur-md flex items-center gap-2 shadow-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 ring-2 ring-indigo-200"></span>
        <span className="font-medium">
          {userLocation
            ? `${userLocation.isCustomLookup ? 'Monitored Location' : 'Live GPS Point'} (${userLocation.cityName || `${userLocation.lat.toFixed(2)}, ${userLocation.lng.toFixed(2)}`})`
            : `India overview with ${alerts.length || nearbyAlerts.length} hazards`}
        </span>
      </div>
    </div>
  );
};

