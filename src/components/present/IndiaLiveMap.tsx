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

const INDIA_BOUNDS = {
  minLat: 6.0,
  maxLat: 38.8,
  minLng: 67.5,
  maxLng: 98.8,
};

const STATE_CENTROIDS: Record<string, [number, number]> = {
  'andaman and nicobar islands': [11.7401, 92.6586],
  'andhra pradesh': [15.9129, 79.74],
  'arunachal pradesh': [28.218, 94.7278],
  assam: [26.2006, 92.9376],
  bihar: [25.0961, 85.3131],
  chhattisgarh: [21.2787, 81.8661],
  goa: [15.2993, 74.124],
  gujarat: [22.2587, 71.1924],
  haryana: [29.0588, 76.0856],
  'himachal pradesh': [31.1048, 77.1734],
  jharkhand: [23.6102, 85.2799],
  karnataka: [15.3173, 75.7139],
  kerala: [10.8505, 76.2711],
  ladakh: [34.1526, 77.577],
  'madhya pradesh': [22.9734, 78.6569],
  maharashtra: [19.7515, 75.7139],
  manipur: [24.6637, 93.9063],
  meghalaya: [25.467, 91.3662],
  mizoram: [23.1645, 92.9376],
  nagaland: [26.1584, 94.5624],
  odisha: [20.9517, 85.0985],
  punjab: [31.1471, 75.3412],
  rajasthan: [27.0238, 74.2179],
  sikkim: [27.533, 88.5122],
  'tamil nadu': [11.1271, 78.6569],
  telangana: [18.1124, 79.0193],
  tripura: [23.9408, 91.9882],
  uttarakhand: [30.0668, 79.0193],
  'uttar pradesh': [26.8467, 80.9462],
  'west bengal': [22.9868, 87.855],
  delhi: [28.6139, 77.209],
  'jammu and kashmir': [33.7782, 76.5762],
  'dadra and nagar haveli and daman and diu': [20.3974, 72.8328],
  puducherry: [11.9416, 79.8083],
};

function clampToIndiaBounds([lat, lng]: [number, number]): [number, number] {
  return [
    Math.min(Math.max(lat, INDIA_BOUNDS.minLat), INDIA_BOUNDS.maxLat),
    Math.min(Math.max(lng, INDIA_BOUNDS.minLng), INDIA_BOUNDS.maxLng),
  ];
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function applyStableJitter(base: [number, number], seed: string, spread = 0.42): [number, number] {
  const hash = hashString(seed || 'alert');
  const angle = (hash % 360) * (Math.PI / 180);
  const radius = ((hash % 1000) / 1000) * spread;
  return clampToIndiaBounds([
    base[0] + Math.sin(angle) * radius,
    base[1] + Math.cos(angle) * radius,
  ]);
}

function hashFallbackPoint(seed: string): [number, number] {
  const hash = hashString(seed || 'alert');
  const latRange = INDIA_BOUNDS.maxLat - INDIA_BOUNDS.minLat;
  const lngRange = INDIA_BOUNDS.maxLng - INDIA_BOUNDS.minLng;
  const lat = INDIA_BOUNDS.minLat + ((hash % 10000) / 10000) * latRange;
  const lng = INDIA_BOUNDS.minLng + (((Math.floor(hash / 10000) % 10000)) / 10000) * lngRange;
  return clampToIndiaBounds([lat, lng]);
}

function deriveFallbackAlertPoint(alert: SachetAlert): [number, number] | null {
  const text = [
    alert.state,
    alert.district,
    alert.areaDesc,
    alert.event,
    alert.headline,
    alert.description,
    alert.category,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const [needle, centroid] of Object.entries(STATE_CENTROIDS)) {
    if (text.includes(needle)) return centroid;
  }

  if (text.includes('bhubaneswar') || text.includes('puri') || text.includes('cuttack')) return STATE_CENTROIDS.odisha;
  if (text.includes('guwahati') || text.includes('kamrup') || text.includes('dibrugarh')) return STATE_CENTROIDS.assam;
  if (text.includes('shimla') || text.includes('kullu') || text.includes('manali')) return STATE_CENTROIDS['himachal pradesh'];
  if (text.includes('srinagar') || text.includes('jammu')) return STATE_CENTROIDS['jammu and kashmir'];
  if (text.includes('mumbai') || text.includes('raigad') || text.includes('konkan')) return STATE_CENTROIDS.maharashtra;
  if (text.includes('kozhikode') || text.includes('wayanad') || text.includes('thiruvananthapuram')) return STATE_CENTROIDS.kerala;
  if (text.includes('ahmedabad') || text.includes('surat') || text.includes('kutch')) return STATE_CENTROIDS.gujarat;
  if (text.includes('kolkata') || text.includes('sundarbans')) return STATE_CENTROIDS['west bengal'];
  if (text.includes('chennai') || text.includes('madurai') || text.includes('tirunelveli')) return STATE_CENTROIDS['tamil nadu'];
  if (text.includes('jaipur') || text.includes('bikaner') || text.includes('jaisalmer')) return STATE_CENTROIDS.rajasthan;
  if (text.includes('delhi') || text.includes('ncr') || text.includes('gurugram')) return STATE_CENTROIDS.delhi;

  const districtHints: Array<[string, [number, number]]> = [
    ['arvalli', STATE_CENTROIDS.gujarat],
    ['chhotaudepur', STATE_CENTROIDS.gujarat],
    ['chhota udaipur', STATE_CENTROIDS.gujarat],
    ['dahod', STATE_CENTROIDS.gujarat],
    ['mahisagar', STATE_CENTROIDS.gujarat],
    ['narmada', STATE_CENTROIDS.gujarat],
    ['panch mahals', STATE_CENTROIDS.gujarat],
    ['panchmahal', STATE_CENTROIDS.gujarat],
    ['sabarkantha', STATE_CENTROIDS.gujarat],
    ['sabar kantha', STATE_CENTROIDS.gujarat],
    ['banaskantha', STATE_CENTROIDS.gujarat],
    ['balrampur', STATE_CENTROIDS['chhattisgarh']],
    ['bastar', STATE_CENTROIDS['chhattisgarh']],
    ['bijapur', STATE_CENTROIDS['chhattisgarh']],
    ['dantewada', STATE_CENTROIDS['chhattisgarh']],
    ['koriya', STATE_CENTROIDS['chhattisgarh']],
    ['manendragarh', STATE_CENTROIDS['chhattisgarh']],
    ['sukma', STATE_CENTROIDS['chhattisgarh']],
    ['surajpur', STATE_CENTROIDS['chhattisgarh']],
    ['chengalpattu', STATE_CENTROIDS['tamil nadu']],
    ['cuddalore', STATE_CENTROIDS['tamil nadu']],
    ['kallakurichi', STATE_CENTROIDS['tamil nadu']],
    ['kancheepuram', STATE_CENTROIDS['tamil nadu']],
    ['pudukkottai', STATE_CENTROIDS['tamil nadu']],
    ['sivaganga', STATE_CENTROIDS['tamil nadu']],
    ['thanjavur', STATE_CENTROIDS['tamil nadu']],
    ['thiruvarur', STATE_CENTROIDS['tamil nadu']],
    ['viluppuram', STATE_CENTROIDS['tamil nadu']],
    ['ariyalur', STATE_CENTROIDS['tamil nadu']],
    ['karur', STATE_CENTROIDS['tamil nadu']],
    ['alipurduar', STATE_CENTROIDS['west bengal']],
    ['jalpaiguri', STATE_CENTROIDS['west bengal']],
    ['north dinajpur', STATE_CENTROIDS['west bengal']],
    ['south dinajpur', STATE_CENTROIDS['west bengal']],
    ['uttar dinajpur', STATE_CENTROIDS['west bengal']],
    ['dakshin dinajpur', STATE_CENTROIDS['west bengal']],
    ['dehradun', STATE_CENTROIDS.uttarakhand],
    ['tehri', STATE_CENTROIDS.uttarakhand],
    ['uttarkashi', STATE_CENTROIDS.uttarakhand],
    ['chamoli', STATE_CENTROIDS.uttarakhand],
    ['rudraprayag', STATE_CENTROIDS.uttarakhand],
    ['pithoragarh', STATE_CENTROIDS.uttarakhand],
    ['east garo hills', STATE_CENTROIDS.meghalaya],
    ['west garo hills', STATE_CENTROIDS.meghalaya],
    ['east khasi hills', STATE_CENTROIDS.meghalaya],
    ['west khasi hills', STATE_CENTROIDS.meghalaya],
    ['west jaintia hills', STATE_CENTROIDS.meghalaya],
    ['south west khasi hills', STATE_CENTROIDS.meghalaya],
    ['ri bhoi', STATE_CENTROIDS.meghalaya],
    ['bahraich', STATE_CENTROIDS['uttar pradesh']],
    ['shravasti', STATE_CENTROIDS['uttar pradesh']],
    ['saharanpur', STATE_CENTROIDS['uttar pradesh']],
    ['sonbhadra', STATE_CENTROIDS['uttar pradesh']],
    ['assam', STATE_CENTROIDS.assam],
    ['kamrup', STATE_CENTROIDS.assam],
    ['sonitpur', STATE_CENTROIDS.assam],
    ['dibrugarh', STATE_CENTROIDS.assam],
    ['goalpara', STATE_CENTROIDS.assam],
    ['barpeta', STATE_CENTROIDS.assam],
    ['maharashtra', STATE_CENTROIDS.maharashtra],
    ['raigad', STATE_CENTROIDS.maharashtra],
    ['ratnagiri', STATE_CENTROIDS.maharashtra],
    ['sindhudurg', STATE_CENTROIDS.maharashtra],
    ['kerala', STATE_CENTROIDS.kerala],
    ['wayanad', STATE_CENTROIDS.kerala],
    ['idukki', STATE_CENTROIDS.kerala],
    ['palakkad', STATE_CENTROIDS.kerala],
    ['odisha', STATE_CENTROIDS.odisha],
    ['bhadrak', STATE_CENTROIDS.odisha],
    ['balasore', STATE_CENTROIDS.odisha],
    ['khordha', STATE_CENTROIDS.odisha],
    ['kalahandi', STATE_CENTROIDS.odisha],
    ['koraput', STATE_CENTROIDS.odisha],
    ['jagatsinghpur', STATE_CENTROIDS.odisha],
    ['kendrapara', STATE_CENTROIDS.odisha],
    ['bihar', STATE_CENTROIDS.bihar],
    ['muzaffarpur', STATE_CENTROIDS.bihar],
    ['sitamarhi', STATE_CENTROIDS.bihar],
    ['madhubani', STATE_CENTROIDS.bihar],
    ['patna', STATE_CENTROIDS.bihar],
    ['maharashtra', STATE_CENTROIDS.maharashtra],
  ];

  for (const [needle, centroid] of districtHints) {
    if (text.includes(needle)) return centroid;
  }

  return null;
}

export function resolveAlertMapPoint(alert: SachetAlert, index = 0): [number, number] | null {
  const base =
    alert.centroid ||
    (alert.polygon && alert.polygon.coordinates.length > 0 ? alert.polygon.coordinates[0] : null) ||
    (alert.circle ? alert.circle.center : null) ||
    deriveFallbackAlertPoint(alert);

  if (!base) {
    return applyStableJitter(hashFallbackPoint(`${alert.id}:${alert.state || ''}:${alert.district || ''}:${alert.areaDesc || alert.event}`), alert.id, 0.18);
  }

  return applyStableJitter(base, `${alert.id}:${index}:${alert.state || ''}:${alert.district || ''}`);
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
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
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

        window.setTimeout(() => {
          map.invalidateSize();
        }, 0);
      }

      if (mapContainerRef.current && !resizeObserverRef.current) {
        resizeObserverRef.current = new ResizeObserver(() => {
          window.requestAnimationFrame(() => {
            mapInstanceRef.current?.invalidateSize();
          });
        });
        resizeObserverRef.current.observe(mapContainerRef.current);
      }
    } catch (e) {
      console.error('Leaflet initialization error:', e);
      setMapError(true);
    }

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
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

      // 3. Place Hazard Marker using centroid, geometry, or a stable regional fallback.
      const markerPos = resolveAlertMapPoint(alert, filteredAlerts.indexOf(alert));

      if (markerPos) {
        const iconHtml = `
          <div class="relative group cursor-pointer flex flex-col items-center">
            <div class="w-8 h-8 rounded-2xl bg-white border border-slate-200 shadow-md flex items-center justify-center ${
              isSelected
                ? 'ring-4 ring-indigo-300 ring-offset-2'
                : isExtreme
                ? 'ring-2 ring-rose-300'
                : 'ring-1 ring-amber-200'
            } transition-transform hover:scale-110">
              ${getCategoryIconSvg(alert.category, alert.severity)}
            </div>
            <div class="mt-1 px-2 py-0.5 rounded-full bg-slate-900 text-[9px] font-bold text-white tracking-tight whitespace-nowrap shadow-sm">
              ${alert.category}
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-disaster-marker',
          iconSize: [34, 42],
          iconAnchor: [17, 21],
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
          <div class="w-4 h-4 rounded-full bg-indigo-600 ring-4 ring-indigo-200 shadow-lg animate-pulse"></div>
          <div class="absolute -top-6 px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold text-[9px] shadow whitespace-nowrap">
            Your Location
          </div>
        </div>
      `;
      const userIcon = L.divIcon({
        html: userIconHtml,
        className: 'custom-user-marker',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker(userCoordinates, { icon: userIcon, zIndexOffset: 1000 }).addTo(layerGroup);
    }

    const fitPositions = filteredAlerts
      .map((alert, index) => resolveAlertMapPoint(alert, index))
      .filter(Boolean) as [number, number][];

    if (userCoordinates) {
      fitPositions.push(userCoordinates);
    }

    const selectedAlert = selectedAlertId ? filteredAlerts.find((item) => item.id === selectedAlertId) : null;
    const selectedPosition = selectedAlert ? resolveAlertMapPoint(selectedAlert, filteredAlerts.indexOf(selectedAlert)) : null;

    if (selectedPosition) {
      map.setView(selectedPosition, Math.min(Math.max(map.getZoom(), 7), 9), { animate: false });
    } else if (fitPositions.length > 0) {
      const bounds = L.latLngBounds(fitPositions.map((pos) => L.latLng(pos[0], pos[1])));
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.12), { padding: [28, 28], maxZoom: 9, animate: false });
      }
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
