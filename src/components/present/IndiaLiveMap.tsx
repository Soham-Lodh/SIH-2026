import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  SachetAlert,
  DisasterCategory,
} from '../../types/disaster';
import {
  AlertTriangle,
  Wind,
  Droplets,
  Activity,
  Mountain,
  SunMedium,
  CloudLightning,
  CloudRain,
  Flame,
  Snowflake,
  Waves,
  Layers,
  MapPin,
  RefreshCw,
} from 'lucide-react';

interface IndiaLiveMapProps {
  alerts: SachetAlert[];
  selectedAlertId: string | null;
  onSelectAlert: (alert: SachetAlert) => void;
  userCoordinates?: [number, number] | null;
  language: string;
}

// Icon mappings for categories
export function getCategoryIconSvg(category: DisasterCategory | string, severity?: string): string {
  let color = '#ef4444'; // Red default
  if (severity === 'Moderate') color = '#f59e0b';
  if (severity === 'Minor') color = '#3b82f6';

  let iconInner = `<path d="M12 2L2 22h20L12 2z"/><path d="M12 9v4"/><circle cx="12" cy="17" r="1"/>`; // Alert default

  const catLower = (category || '').toLowerCase();

  if (catLower.includes('cyclon') || catLower.includes('storm')) {
    iconInner = `<path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M12 6a6 6 0 0 0-6 6c0 2 1.5 3.5 3 4s3 2 3 4"/><path d="M12 18a6 6 0 0 0 6-6c0-2-1.5-3.5-3-4s-3-2-3-4"/>`;
  } else if (catLower.includes('flood') || catLower.includes('inundat')) {
    iconInner = `<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.9 4.9"/>`;
  } else if (catLower.includes('earthquake') || catLower.includes('seismic')) {
    iconInner = `<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>`;
  } else if (catLower.includes('landslide')) {
    iconInner = `<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>`;
  } else if (catLower.includes('heat')) {
    iconInner = `<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>`;
  } else if (catLower.includes('lightning')) {
    iconInner = `<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>`;
  } else if (catLower.includes('rain')) {
    iconInner = `<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>`;
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="filter drop-shadow-sm">
      ${iconInner}
    </svg>
  `;
}

export const IndiaLiveMap: React.FC<IndiaLiveMapProps> = ({
  alerts,
  selectedAlertId,
  onSelectAlert,
  userCoordinates,
  language,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [mapError, setMapError] = useState<boolean>(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  // Active categories present in alerts
  const activeCategories = Array.from(new Set(alerts.map((a) => a.category)));

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      if (!mapInstanceRef.current) {
        // Center of India (20.5937 N, 78.9629 E)
        const map = L.map(mapContainerRef.current, {
          center: [21.5, 82.0],
          zoom: 5,
          minZoom: 4,
          maxZoom: 14,
          zoomControl: false,
        });

        // Crisp Voyager tiles for clean cartography
        L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO | SACHET/NDMA',
            subdomains: 'abcd',
            maxZoom: 19,
          }
        ).addTo(map);

        L.control.zoom({ position: 'topright' }).addTo(map);

        const layerGroup = L.layerGroup().addTo(map);
        layerGroupRef.current = layerGroup;
        mapInstanceRef.current = map;
      }
    } catch (e) {
      console.error('Leaflet initialization error:', e);
      setMapError(true);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Alert Layers, Polygons, and Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    const filteredAlerts = activeCategoryFilter
      ? alerts.filter((a) => a.category === activeCategoryFilter)
      : alerts;

    filteredAlerts.forEach((alert) => {
      const isSelected = alert.id === selectedAlertId;
      const isExtreme = alert.severity === 'Extreme';
      const isSevere = alert.severity === 'Severe';

      const strokeColor = isSelected ? '#4f46e5' : isExtreme ? '#e11d48' : isSevere ? '#ea580c' : '#d97706';
      const fillColor = isSelected ? '#6366f1' : isExtreme ? '#f43f5e' : isSevere ? '#f97316' : '#f59e0b';

      // 1. Draw Vector Polygon if present
      if (alert.polygon && alert.polygon.coordinates && alert.polygon.coordinates.length >= 3) {
        const latLngs: L.LatLngExpression[] = alert.polygon.coordinates.map((c) => [c[0], c[1]]);

        const polygon = L.polygon(latLngs, {
          color: strokeColor,
          weight: isSelected ? 3.5 : 2,
          opacity: 0.9,
          fillColor: fillColor,
          fillOpacity: isSelected ? 0.35 : 0.2,
          smoothFactor: 1.2,
          lineJoin: 'round',
          lineCap: 'round',
        });

        polygon.on('click', () => {
          onSelectAlert(alert);
        });

        polygon.bindTooltip(
          `<strong>${alert.event}</strong><br/>${alert.areaDesc}<br/><span style="color:#e11d48;font-weight:bold;">${alert.severity} Warning</span>`,
          { sticky: true, className: 'leaflet-disaster-tooltip' }
        );

        polygon.addTo(layerGroup);
      }

      // 2. Draw Circle if present
      if (alert.circle && alert.circle.center) {
        const circle = L.circle([alert.circle.center[0], alert.circle.center[1]], {
          radius: (alert.circle.radiusKm || 30) * 1000,
          color: strokeColor,
          weight: isSelected ? 3 : 2,
          fillColor: fillColor,
          fillOpacity: 0.2,
        });
        circle.on('click', () => onSelectAlert(alert));
        circle.addTo(layerGroup);
      }

      // 3. Place Hazard Marker at Centroid
      const markerPos: [number, number] | null =
        alert.centroid ||
        (alert.polygon && alert.polygon.coordinates.length > 0 ? alert.polygon.coordinates[0] : null) ||
        (alert.circle ? alert.circle.center : null);

      if (markerPos) {
        const iconHtml = `
          <div class="relative group cursor-pointer flex flex-col items-center">
            <div class="w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-md flex items-center justify-center ${
              isSelected
                ? 'ring-4 ring-indigo-300 ring-offset-2'
                : isExtreme
                ? 'ring-2 ring-rose-300'
                : 'ring-1 ring-amber-200'
            } transition-transform hover:scale-110">
              ${getCategoryIconSvg(alert.category, alert.severity)}
            </div>
            <div class="mt-1 px-2.5 py-0.5 rounded-full bg-slate-900 text-[10px] font-bold text-white tracking-tight whitespace-nowrap shadow-sm">
              ${alert.category}
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-disaster-marker',
          iconSize: [40, 50],
          iconAnchor: [20, 25],
        });

        const marker = L.marker(markerPos, { icon: customIcon });
        marker.on('click', () => {
          onSelectAlert(alert);
        });

        marker.addTo(layerGroup);
      }
    });

    // 4. User Location Marker if available
    if (userCoordinates) {
      const userIconHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-5 h-5 rounded-full bg-indigo-600 ring-4 ring-indigo-200 shadow-lg animate-pulse"></div>
          <div class="absolute -top-6 px-2.5 py-0.5 rounded-full bg-indigo-600 text-white font-bold text-[10px] shadow whitespace-nowrap">
            Your Location
          </div>
        </div>
      `;
      const userIcon = L.divIcon({
        html: userIconHtml,
        className: 'custom-user-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      L.marker(userCoordinates, { icon: userIcon, zIndexOffset: 1000 }).addTo(layerGroup);
    }
  }, [alerts, selectedAlertId, activeCategoryFilter, userCoordinates, onSelectAlert]);

  if (mapError) {
    return (
      <div className="w-full h-[420px] rounded-2xl bg-white border border-slate-200 p-6 flex flex-col justify-between shadow-sm">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
            <AlertTriangle className="w-5 h-5" />
            <span>Map Tile Rendering Offline - Text Alert Fallback Active</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {alerts.map((a) => (
              <div
                key={a.id}
                onClick={() => onSelectAlert(a)}
                className="py-2.5 cursor-pointer hover:bg-slate-50 px-2 rounded-xl flex justify-between items-center"
              >
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{a.event}</h4>
                  <p className="text-xs text-slate-500">{a.areaDesc} • {a.category}</p>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200">
                  {a.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMapError(false)}
          className="self-start px-4 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Map Layer</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] sm:h-[460px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Floating Active Categories Filter Bar */}
      <div className="absolute top-3 left-3 right-14 z-10 flex items-center gap-1.5 overflow-x-auto py-1 px-1.5 scrollbar-none pointer-events-auto">
        <button
          type="button"
          onClick={() => setActiveCategoryFilter(null)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md transition-all shadow-sm shrink-0 flex items-center gap-1.5 ${
            activeCategoryFilter === null
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white/95 text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>All Hazards ({alerts.length})</span>
        </button>

        {activeCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategoryFilter(activeCategoryFilter === cat ? null : cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md transition-all shadow-sm shrink-0 flex items-center gap-1.5 ${
              activeCategoryFilter === cat
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-white/95 text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{cat}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeCategoryFilter === cat ? 'bg-rose-700 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {alerts.filter((a) => a.category === cat).length}
            </span>
          </button>
        ))}
      </div>

      {/* Bottom Floating Map Legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-3 shadow-lg max-w-xs hidden sm:block pointer-events-auto text-xs space-y-1.5">
        <div className="font-bold text-[11px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <Activity className="w-3.5 h-3.5 text-indigo-600" />
          <span>Active Alert Legend</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-slate-700">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-600 shadow-sm"></span>
            <span>Extreme / Immediate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm"></span>
            <span>Severe / Expected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border border-rose-500 bg-rose-500/20"></span>
            <span>Official Polygon</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 ring-2 ring-indigo-200"></span>
            <span>User Location</span>
          </div>
        </div>
      </div>
    </div>
  );
};
