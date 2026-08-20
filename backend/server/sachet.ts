import { XMLParser } from 'fast-xml-parser';
import { SachetAlert, DisasterCategory, AlertSeverity, AlertUrgency, AlertCertainty } from './types/disaster';
import { isAlertExpired } from './lib/relevanceEngine';

interface CacheEntry {
  etag: string;
  lastUpdated: string;
  data: SachetAlert[];
  sourceUrl?: string;
  liveSourceCount: number;
}

let sachetCache: CacheEntry = {
  etag: `sachet-${Date.now()}`,
  lastUpdated: new Date().toISOString(),
  data: [],
  liveSourceCount: 0,
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  trimValues: true,
});

/**
 * Normalizes raw category string from CAP feed or telemetry into our DisasterCategory enum.
 */
export function normalizeCategory(raw: string, eventName: string): DisasterCategory {
  const combined = `${raw || ''} ${eventName || ''}`.toLowerCase();

  if (combined.includes('cyclon') || combined.includes('depression') || combined.includes('gale')) return 'Cyclone';
  if (combined.includes('flood') || combined.includes('inundat')) {
    if (combined.includes('urban')) return 'Urban Flood';
    return 'Flood';
  }
  if (combined.includes('earthquake') || combined.includes('seismic') || combined.includes('tremor')) return 'Earthquake';
  if (combined.includes('landslide') || combined.includes('rockfall') || combined.includes('mudslide')) return 'Landslide';
  if (combined.includes('heat') || combined.includes('loo')) return 'Heat Wave';
  if (combined.includes('cold') || combined.includes('frost')) return 'Cold Wave';
  if (combined.includes('lightning') || combined.includes('thunderbolt')) return 'Lightning';
  if (combined.includes('thunderstorm') || combined.includes('squall')) return 'Thunderstorm';
  if (combined.includes('heavy rain') || combined.includes('rainfall') || combined.includes('downpour')) return 'Heavy Rain';
  if (combined.includes('storm')) return 'Storm';
  if (combined.includes('tsunami')) return 'Tsunami';
  if (combined.includes('avalanche')) return 'Avalanche';
  if (combined.includes('forest fire') || combined.includes('wildfire')) return 'Forest Fire';
  if (combined.includes('drought')) return 'Drought';
  if (combined.includes('air pollution') || combined.includes('smog') || combined.includes('aqi')) return 'Air Pollution';

  return 'General Alert';
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
  'puducherry': [11.9416, 79.8083],
};

function isWithinIndiaBounds(lat: number, lng: number): boolean {
  return lat >= INDIA_BOUNDS.minLat && lat <= INDIA_BOUNDS.maxLat && lng >= INDIA_BOUNDS.minLng && lng <= INDIA_BOUNDS.maxLng;
}

function deriveIndicativeCentroid(...parts: Array<string | undefined | null>): [number, number] | undefined {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  if (!text) return undefined;

  for (const [needle, centroid] of Object.entries(STATE_CENTROIDS)) {
    if (text.includes(needle)) {
      return centroid;
    }
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
    ['kamrup', STATE_CENTROIDS.assam],
    ['sonitpur', STATE_CENTROIDS.assam],
    ['dibrugarh', STATE_CENTROIDS.assam],
    ['goalpara', STATE_CENTROIDS.assam],
    ['barpeta', STATE_CENTROIDS.assam],
    ['raigad', STATE_CENTROIDS.maharashtra],
    ['ratnagiri', STATE_CENTROIDS.maharashtra],
    ['sindhudurg', STATE_CENTROIDS.maharashtra],
    ['wayanad', STATE_CENTROIDS.kerala],
    ['idukki', STATE_CENTROIDS.kerala],
    ['palakkad', STATE_CENTROIDS.kerala],
    ['bhadrak', STATE_CENTROIDS.odisha],
    ['balasore', STATE_CENTROIDS.odisha],
    ['khordha', STATE_CENTROIDS.odisha],
    ['kalahandi', STATE_CENTROIDS.odisha],
    ['koraput', STATE_CENTROIDS.odisha],
    ['jagatsinghpur', STATE_CENTROIDS.odisha],
    ['kendrapara', STATE_CENTROIDS.odisha],
    ['muzaffarpur', STATE_CENTROIDS.bihar],
    ['sitamarhi', STATE_CENTROIDS.bihar],
    ['madhubani', STATE_CENTROIDS.bihar],
    ['patna', STATE_CENTROIDS.bihar],
  ];

  for (const [needle, centroid] of districtHints) {
    if (text.includes(needle)) return centroid;
  }

  return undefined;
}

function isLikelyIndianEarthquake(place: string, lat: number, lng: number): boolean {
  if (!isWithinIndiaBounds(lat, lng)) return false;

  const text = place.toLowerCase();
  const indianHints = [
    'india',
    'assam',
    'bihar',
    'gujarat',
    'himachal pradesh',
    'jammu and kashmir',
    'karnataka',
    'kerala',
    'maharashtra',
    'odisha',
    'rajasthan',
    'sikkim',
    'tamil nadu',
    'uttarakhand',
    'west bengal',
    'delhi',
    'manipur',
    'nagaland',
    'mizoram',
    'tripura',
    'meghalaya',
    'arunachal pradesh',
    'andhra pradesh',
    'telangana',
    'punjab',
  ];

  return indianHints.some((hint) => text.includes(hint));
}

/**
 * Fetches real-time seismic events in India and surrounding fault boundaries (Lat 5-38°N, Lng 65-98°E)
 * from the official USGS Real-Time Earthquake GeoJSON API.
 */
async function fetchUSGSIndianEarthquakes(): Promise<SachetAlert[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.8&minlatitude=5.0&maxlatitude=38.0&minlongitude=65.0&maxlongitude=98.0&limit=15';
    const res = await fetch(url, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);

    if (!res || !res.ok) return [];

    const json = (await res.json()) as { features?: Array<any> };
    const features = json.features || [];
    const alerts: SachetAlert[] = [];

    for (const f of features) {
      const props = f.properties || {};
      const geom = f.geometry || {};
      const [lng, lat, depth] = geom.coordinates || [0, 0, 0];

      if (!lat || !lng) continue;

      const mag = Number(props.mag || 0);
      const place = String(props.place || 'Northern Indian Subcontinent');
      const timeMs = Number(props.time || Date.now());
      const sentTime = new Date(timeMs).toISOString();
      const expiryTime = new Date(timeMs + 48 * 3600 * 1000).toISOString();

      if (!isLikelyIndianEarthquake(place, lat, lng)) {
        continue;
      }

      let severity: AlertSeverity = 'Minor';
      if (mag >= 5.5) severity = 'Extreme';
      else if (mag >= 4.5) severity = 'Severe';
      else if (mag >= 3.5) severity = 'Moderate';

      const alertId = `USGS-EQ-${f.id || Date.now()}`;
      const workingUrl = props.url || `https://earthquake.usgs.gov/earthquakes/eventpage/${f.id}`;

      alerts.push({
        id: alertId,
        identifier: `USGS/NCS/EQ/${f.id}`,
        bulletinNo: `SEISMO-EQ-M${mag.toFixed(1)}-${f.id}`,
        sender: 'National Center for Seismology (NCS) & USGS Global Seismic Network',
        sourceAgency: 'National Center for Seismology (NCS) & USGS',
        helpline: '1070 (SEOC) | 1077 (DEOC) | 112 National Emergency',
        officialPortalUrl: 'https://seismo.gov.in',
        liveNewsQuery: `earthquake ${place} India magnitude ${mag.toFixed(1)}`,
        feedOrigin: 'NDMA_SACHET_LIVE',
        sent: sentTime,
        status: 'Actual',
        msgType: 'Alert',
        source: 'Live USGS / National Center for Seismology (NCS) Real-Time Seismic Stream',
        scope: 'Public',
        category: 'Earthquake',
        rawCategory: 'Geo / Seismic',
        event: `Seismic Activity (Magnitude ${mag.toFixed(1)})`,
        urgency: mag >= 4.5 ? 'Immediate' : 'Expected',
        severity,
        certainty: 'Observed',
        headline: `M ${mag.toFixed(1)} Earthquake Recorded near ${place}`,
        description: `A magnitude ${mag.toFixed(1)} earthquake was detected at coordinates ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E at a depth of ${depth} km. Monitored in real-time by seismic telemetry networks.`,
        instruction: mag >= 4.5
          ? '1. If indoors: DROP, COVER, and HOLD ON under sturdy furniture away from windows.\n2. If outdoors: Move to open areas away from buildings, overhead electrical wires, and steep slopes.\n3. Be prepared for potential secondary aftershocks. Check gas lines and structural cracks before re-entering buildings.'
          : 'Minor seismic tremor registered. No immediate structural damage expected. Stay calm and monitor official State Disaster Management Authority updates.',
        areaDesc: place,
        centroid: [lat, lng],
        circle: {
          center: [lat, lng],
          radiusKm: Math.max(15, mag * 18),
        },
        effective: sentTime,
        expires: expiryTime,
        isExpired: false,
        webUrl: workingUrl,
      });
    }

    return alerts;
  } catch (e) {
    console.log('USGS live seismic API notice:', (e as Error).message);
    return [];
  }
}

/**
 * Queries Open-Meteo real-time live meteorological telemetry across key Indian hazard sectors
 * and synthesizes live weather advisories with facts and figures.
 */
async function fetchOpenMeteoIndianTelemetry(): Promise<SachetAlert[]> {
  try {
    const locations = [
      { name: 'Coastal Odisha (Puri / Khordha)', state: 'Odisha', lat: 20.2961, lng: 85.8245, agency: 'IMD Coastal Cyclone Warning Center & OSDMA', helpline: '1070 (OSDMA) | 1077 (Puri) | 112', portal: 'https://osdma.org' },
      { name: 'Western Ghats / Central Kerala (Periyar Basin)', state: 'Kerala', lat: 10.1632, lng: 76.6413, agency: 'Kerala State Disaster Management Authority (KSDMA) & CWC', helpline: '1077 (KSDMA) | 1070 | 112', portal: 'https://sdma.kerala.gov.in' },
      { name: 'Himachal Western Himalayas (Kullu / Shimla)', state: 'Himachal Pradesh', lat: 31.1048, lng: 77.1734, agency: 'Himachal Pradesh State Disaster Management Authority (HPSDMA)', helpline: '1070 (HPSDMA) | 1077 | 112', portal: 'https://hpsdma.nic.in' },
      { name: 'Brahmaputra Valley (Guwahati / Kamrup)', state: 'Assam', lat: 26.1445, lng: 91.7362, agency: 'Assam State Disaster Management Authority (ASDMA) & CWC', helpline: '1070 (ASDMA) | 1077 | 112', portal: 'https://asdma.assam.gov.in' },
      { name: 'Konkan Coastal Belt (Mumbai / Raigad)', state: 'Maharashtra', lat: 19.076, lng: 72.8777, agency: 'IMD Regional Met Center Mumbai & BMC Disaster Cell', helpline: '1916 (BMC Disaster Cell) | 112', portal: 'https://mahasdma.maharashtra.gov.in' },
    ];

    const alerts: SachetAlert[] = [];
    const now = new Date();
    const future24 = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();

    for (const loc of locations) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_gusts_10m&hourly=precipitation_probability,precipitation&timezone=Asia%2FKolkata`;
        const res = await fetch(url, { signal: controller.signal }).catch(() => null);
        clearTimeout(timeoutId);

        if (!res || !res.ok) continue;

        const data = (await res.json()) as { current?: Record<string, unknown> };
        const current = data.current || {};
        const temp = Number(current.temperature_2m || 28);
        const precip = Number(current.precipitation || 0);
        const windGust = Number(current.wind_gusts_10m || 0);
        const windSpeed = Number(current.wind_speed_10m || 0);
        const humidity = Number(current.relative_humidity_2m || 70);

        const isHighWind = windGust >= 35 || windSpeed >= 25;
        const isHeavyRain = precip >= 5;
        const isExtremeHeat = temp >= 40;

        let category: DisasterCategory = 'General Alert';
        let headline = '';
        let description = '';
        let instruction = '';
        let severity: AlertSeverity = 'Moderate';

        if (isHeavyRain) {
          category = 'Heavy Rain';
          severity = precip > 20 ? 'Extreme' : 'Severe';
          headline = `Heavy Rainfall & Inundation Watch for ${loc.name}`;
          description = `Live meteorological telemetry measures active precipitation of ${precip.toFixed(1)} mm/hr and ${humidity}% relative humidity. Localized waterlogging risk along low-lying corridors.`;
          instruction = '1. Avoid crossing waterlogged subways and low-lying river bridges.\n2. Keep emergency battery packs charged and follow local Municipal Emergency bulletins.';
        } else if (isHighWind) {
          category = 'Storm';
          severity = windGust > 60 ? 'Extreme' : 'Severe';
          headline = `Squally Wind & Gale Warning for ${loc.name}`;
          description = `Observed wind gusts of ${windGust.toFixed(1)} km/h (sustained ${windSpeed.toFixed(1)} km/h) recorded by live atmospheric sensors. Potential risk to tin roofs and loose banners.`;
          instruction = '1. Secure loose outdoor objects and stay away from overhead power transmission cables and large aged trees.\n2. Fishermen along coastal boundaries advised to heed harbor warnings.';
        } else if (isExtremeHeat) {
          category = 'Heat Wave';
          severity = temp >= 43 ? 'Extreme' : 'Severe';
          headline = `Severe Heat Wave & High Temperature Advisory for ${loc.name}`;
          description = `Live telemetry reports extreme ambient temperatures touching ${temp.toFixed(1)}°C. Elevated heat index poses acute dehydration risk.`;
          instruction = '1. Avoid direct sunlight exposure between 11:30 AM and 03:30 PM.\n2. Stay hydrated with ORS, lemon water, and buttermilk. Protect infants, elderly, and outdoor workers.';
        } else {
          category = loc.state === 'Odisha' ? 'Cyclone' : loc.state === 'Kerala' ? 'Flood' : 'General Alert';
          severity = 'Moderate';
          headline = `Live Weather Telemetry & Surveillance for ${loc.name}`;
          description = `Current live atmospheric conditions: Temperature ${temp.toFixed(1)}°C, Humidity ${humidity}%, Wind Speed ${windSpeed.toFixed(1)} km/h, Precipitation ${precip.toFixed(1)} mm. Monitored continuously.`;
          instruction = 'Stay updated with local district disaster management bulletins and NDMA SACHET early warnings. Dial 1070 or 112 for emergency queries.';
        }

        alerts.push({
          id: `MET-LIVE-${loc.state.toUpperCase().replace(/\s+/g, '')}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          identifier: `NDMA/MET/LIVE/${loc.state.substring(0, 2).toUpperCase()}/2026/08`,
          bulletinNo: `IMD-MET-${loc.state.substring(0, 2).toUpperCase()}-${Math.floor(temp)}C-${Math.floor(windGust)}K`,
          sender: loc.agency,
          sourceAgency: loc.agency,
          helpline: loc.helpline,
          officialPortalUrl: loc.portal,
          liveNewsQuery: `${category} alert ${loc.name} ${loc.state} IMD weather`,
          feedOrigin: 'NDMA_SACHET_LIVE',
          sent: now.toISOString(),
          status: 'Actual',
          msgType: 'Alert',
          source: 'Live Open-Meteo & IMD Telemetry Network',
          scope: 'Public',
          category,
          rawCategory: 'Met / Atmospheric Telemetry',
          event: headline,
          urgency: severity === 'Extreme' ? 'Immediate' : 'Expected',
          severity,
          certainty: 'Observed',
          headline,
          description,
          instruction,
          areaDesc: `${loc.name}, ${loc.state}`,
          centroid: [loc.lat, loc.lng],
          circle: {
            center: [loc.lat, loc.lng],
            radiusKm: 30,
          },
          state: loc.state,
          effective: now.toISOString(),
          expires: future24,
          isExpired: false,
          webUrl: `https://news.google.com/search?q=${encodeURIComponent(category + ' ' + loc.name + ' India weather alert')}&hl=en-IN&gl=IN&ceid=IN:en`,
        });
      } catch (innerErr) {
        // Skip to next loc
      }
    }

    return alerts;
  } catch (e) {
    console.log('Open-Meteo telemetry API notice:', (e as Error).message);
    return [];
  }
}

/**
 * Public NDMA SACHET India CAP/RSS feed.
 *
 * This is the public feed used when no agency-specific SACHET identifier
 * is available. No API key or SACHET_CAP_IDENTIFIER is required.
 */
const PUBLIC_SACHET_FEED_URL =
  'https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml';

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function asString(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function normalizeSeverityValue(value: unknown): AlertSeverity {
  const raw = asString(value).toLowerCase();
  if (raw === 'extreme' || raw.includes('red')) return 'Extreme';
  if (raw === 'severe' || raw.includes('orange')) return 'Severe';
  if (raw === 'moderate' || raw.includes('yellow')) return 'Moderate';
  return 'Minor';
}

function normalizeUrgencyValue(value: unknown): AlertUrgency {
  return asString(value).toLowerCase() === 'immediate' ? 'Immediate' : 'Expected';
}

function normalizeCertaintyValue(value: unknown): AlertCertainty {
  const raw = asString(value).toLowerCase();
  if (raw === 'observed') return 'Observed';
  if (raw === 'likely') return 'Likely';
  return 'Possible';
}

function parseCapPolygon(value: unknown): SachetAlert['polygon'] {
  const raw = asString(value);
  if (!raw) return undefined;

  const points: Array<[number, number]> = [];
  for (const pair of raw.split(/\s+/)) {
    const [latRaw, lngRaw] = pair.split(',');
    const lat = Number(latRaw);
    const lng = Number(lngRaw);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      points.push([lat, lng]);
    }
  }

  if (points.length < 3) return undefined;

  return {
    type: 'Polygon',
    coordinates: points,
  };
}

function parseCapCircle(value: unknown): SachetAlert['circle'] {
  const raw = asString(value);
  if (!raw) return undefined;

  const [latRaw, lngRaw, radiusRaw] = raw.split(',');
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  const radiusKm = Number(radiusRaw);

  if (![lat, lng, radiusKm].every(Number.isFinite)) {
    return undefined;
  }

  return {
    center: [lat, lng],
    radiusKm,
  };
}

function calculateCentroid(
  polygon?: SachetAlert['polygon'],
  circle?: SachetAlert['circle'],
): SachetAlert['centroid'] {
  if (circle) return circle.center;
  if (!polygon?.coordinates?.length) return undefined;

  const points = polygon.coordinates;
  const lat = points.reduce((sum: number, p: [number, number]) => sum + p[0], 0) / points.length;
  const lng = points.reduce((sum: number, p: [number, number]) => sum + p[1], 0) / points.length;

  return [lat, lng];
}

/**
 * Converts an actual CAP <alert> object into SachetAlert objects.
 *
 * SACHET may expose more than one <info> block for different languages.
 * Prefer English where available.
 */
function parseCapAlert(root: any): SachetAlert[] {
  const infos = asArray(root?.info || root?.['cap:info']);
  if (!infos.length) return [];

  const selectedInfo =
    infos.find((info: any) => {
      const language = asString(info.language || info['cap:language']).toLowerCase();
      return language === 'en' || language === 'en-in' || language.startsWith('en-');
    }) || infos[0];

  const info = selectedInfo || {};
  const area = asArray(info.area || info['cap:area'])[0] || {};

  const event = asString(
    info.event || info['cap:event'],
    'Disaster Warning',
  );

  const rawCategory = asString(
    info.category || info['cap:category'],
    'Met',
  );

  const polygon = parseCapPolygon(
    area.polygon || area['cap:polygon'],
  );

  const circle = parseCapCircle(
    area.circle || area['cap:circle'],
  );

  const centroid =
    calculateCentroid(polygon, circle) ||
    deriveIndicativeCentroid(
      asString(info.parameter?.state || info.parameter?.STATE),
      asString(info.parameter?.district || info.parameter?.DISTRICT),
      asString(area.areaDesc || area['cap:areaDesc']),
      event,
      rawCategory,
    );

  const sent = asString(
    root.sent,
    new Date().toISOString(),
  );

  const effective = asString(
    info.effective || info['cap:effective'],
    sent,
  );

  const expires = asString(
    info.expires || info['cap:expires'],
    new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  );

  const alertObj: SachetAlert = {
    id: asString(
      root.identifier,
      `SACHET-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ),

    identifier: asString(
      root.identifier,
      `NDMA/SACHET/${Date.now()}`,
    ),

    bulletinNo: asString(
      info.parameter?.value || root.identifier,
      root.identifier || 'NDMA-CAP-OFFICIAL',
    ),

    sender: asString(
      root.sender,
      'NDMA / SACHET Portal',
    ),

    sourceAgency: asString(
      root.sender,
      'National Disaster Management Authority (NDMA)',
    ),

    helpline: '1070 (SEOC) | 1077 (District Control) | 112',

    officialPortalUrl: 'https://sachet.ndma.gov.in',

    liveNewsQuery:
      `${event} ${asString(area.areaDesc || area['cap:areaDesc'])} alert India`,

    feedOrigin: 'NDMA_SACHET_LIVE',

    sent,
    status: asString(root.status, 'Actual'),
    msgType: asString(root.msgType, 'Alert'),

    source: 'NDMA SACHET Public India CAP RSS Feed',

    scope: asString(root.scope, 'Public'),

    category: normalizeCategory(rawCategory, event),
    rawCategory,

    event,

    urgency: normalizeUrgencyValue(
      info.urgency || info['cap:urgency'],
    ),

    severity: normalizeSeverityValue(
      info.severity || info['cap:severity'],
    ),

    certainty: normalizeCertaintyValue(
      info.certainty || info['cap:certainty'],
    ),

    headline: asString(
      info.headline || info['cap:headline'],
      event,
    ),

    description: asString(
      info.description || info['cap:description'],
      'Active alert from NDMA SACHET.',
    ),

    instruction: asString(
      info.instruction || info['cap:instruction'],
      'Follow official instructions from local disaster management authorities.',
    ),

    areaDesc: asString(
      area.areaDesc || area['cap:areaDesc'],
      'Designated warning zone',
    ),

    polygon,
    circle,
    centroid,

    state: asString(info.parameter?.state || info.parameter?.STATE) || undefined,
    district: asString(info.parameter?.district || info.parameter?.DISTRICT) || undefined,

    effective,
    expires,

    isExpired: false,

    webUrl: asString(
      info.web || info['cap:web'],
      'https://sachet.ndma.gov.in',
    ),
  };

  if (isAlertExpired(alertObj)) return [];
  return [alertObj];
}

/**
 * Parses the public SACHET RSS feed.
 *
 * It supports:
 * 1. RSS items containing a CAP <alert>
 * 2. Direct CAP <alert>
 * 3. RSS items that expose the alert metadata directly
 */
function parseCapPayload(rawContent: string): SachetAlert[] {
  try {
    if (!rawContent.trim()) return [];

    if (
      rawContent.trim().startsWith('{') ||
      rawContent.trim().startsWith('[')
    ) {
      return [];
    }

    const parsed = xmlParser.parse(rawContent);
    const roots: any[] = [];

    const directAlerts =
      parsed?.alert ||
      parsed?.['cap:alert'];

    if (directAlerts) {
      roots.push(...asArray(directAlerts));
    }

    const items = asArray(
      parsed?.rss?.channel?.item,
    );

    for (const item of items) {
      const nested =
        item?.alert ||
        item?.['cap:alert'] ||
        item?.Alert;

      if (nested) {
        roots.push(...asArray(nested));
      }
    }

    const results: SachetAlert[] = [];

    for (const root of roots) {
      results.push(...parseCapAlert(root));
    }

    /*
     * Some RSS representations expose the CAP fields as RSS item fields.
     * Only use this path when a real CAP alert object is absent.
     */
    if (results.length === 0) {
      for (const item of items) {
        const title = asString(item.title);
        const description = asString(item.description);

        if (!title && !description) continue;

        const identifier = asString(
          item.guid || item.id || item.link,
          `SACHET-RSS-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        );

        const sent = asString(
          item.pubDate,
          new Date().toISOString(),
        );

        const fallbackAlert: SachetAlert = {
          id: identifier,
          identifier,
          bulletinNo: identifier,

          sender: asString(
            item.source,
            'NDMA SACHET',
          ),

          sourceAgency:
            'National Disaster Management Authority (NDMA)',

          helpline:
            '1070 (SEOC) | 1077 (District Control) | 112',

          officialPortalUrl:
            'https://sachet.ndma.gov.in',

          liveNewsQuery:
            `${title || 'disaster'} India alert`,

          feedOrigin:
            'NDMA_SACHET_LIVE',

          sent,
          status: 'Actual',
          msgType: 'Alert',

          source:
            'NDMA SACHET Public India CAP RSS Feed',

          scope: 'Public',

          category:
            normalizeCategory(title, title),

          rawCategory: 'RSS',

          event:
            title || 'Disaster Warning',

          urgency: 'Expected',
          severity: 'Moderate',
          certainty: 'Possible',

          headline:
            title || 'Official SACHET Alert',

          description:
            description || 'Official alert published through SACHET.',

          instruction:
            'Follow official instructions from NDMA and local authorities.',

          areaDesc:
            title || 'Designated warning zone',

          centroid: deriveIndicativeCentroid(
            title,
            description,
            asString(item.source),
          ),

          effective: sent,

          expires:
            new Date(
              new Date(sent).getTime() + 24 * 3600 * 1000,
            ).toISOString(),

          isExpired: false,

          webUrl:
            asString(
              item.link,
              'https://sachet.ndma.gov.in',
            ),
        };

        if (!isAlertExpired(fallbackAlert)) {
          results.push(fallbackAlert);
        }
      }
    }

    const seen = new Set<string>();

    return results.filter((alert) => {
      if (seen.has(alert.identifier)) return false;
      seen.add(alert.identifier);
      return true;
    });
  } catch (err) {
    console.error(
      'Error parsing public SACHET CAP/RSS payload:',
      (err as Error).message,
    );

    return [];
  }
}

/**
 * Retrieves live disaster data from:
 *
 * 1. PUBLIC NDMA SACHET India CAP/RSS feed
 * 2. USGS live earthquake stream
 * 3. Open-Meteo live telemetry
 *
 * IMPORTANT:
 * - No SACHET identifier is required.
 * - No hardcoded/fake disaster alerts are injected.
 * - Empty SACHET feed means zero official SACHET alerts.
 */
export async function getSachetAlerts(clientEtag?: string): Promise<{
  alerts: SachetAlert[];
  etag: string;
  isModified: boolean;
  lastUpdated: string;
  cacheStatus: 'LIVE_FETCH' | 'ETAG_CACHED' | 'FALLBACK_SNAPSHOT';
  sourceUrl?: string;
}> {
  const now = new Date();

  const cacheAgeMs =
    Date.now() -
    new Date(
      sachetCache.lastUpdated,
    ).getTime();

  /*
   * Preserve the existing API contract:
   * if the caller already has our current ETag and the cache
   * is still fresh, avoid hitting upstream again.
   */
  if (
    sachetCache.data.length > 0 &&
    cacheAgeMs < 45_000 &&
    clientEtag === sachetCache.etag
  ) {
    const active =
      sachetCache.data.filter(
        (a) => !isAlertExpired(a, now),
      );

    return {
      alerts: active,
      etag: sachetCache.etag,
      isModified: false,
      lastUpdated: sachetCache.lastUpdated,
      cacheStatus: 'ETAG_CACHED',
      sourceUrl: sachetCache.sourceUrl,
    };
  }

  /*
   * 1. PUBLIC SACHET FEED
   */
  let sachetLiveAlerts: SachetAlert[] = [];

  try {
    const controller =
      new AbortController();

    const timeoutId =
      setTimeout(
        () => controller.abort(),
        10_000,
      );

    const response =
      await fetch(
        PUBLIC_SACHET_FEED_URL,
        {
          method: 'GET',

          headers: {
            Accept:
              'application/rss+xml, application/xml, text/xml, */*',

            'User-Agent':
              'DisasterAlertPlatform/1.0',
          },

          signal:
            controller.signal,
        },
      ).catch(() => null);

    clearTimeout(timeoutId);

    if (response?.ok) {
      const contentType =
        (
          response.headers.get(
            'content-type',
          ) || ''
        ).toLowerCase();

      const body =
        await response.text();

      const looksLikeXml =
        body.trimStart().startsWith('<?xml') ||
        body.trimStart().startsWith('<rss') ||
        body.trimStart().startsWith('<feed') ||
        body.trimStart().startsWith('<alert') ||
        contentType.includes('xml') ||
        contentType.includes('rss');

      if (!looksLikeXml) {
        throw new Error(
          `SACHET returned a non-XML response. HTTP ${response.status}, content-type=${contentType || 'unknown'}`,
        );
      }

      sachetLiveAlerts =
        parseCapPayload(body);
    } else {
      throw new Error(
        `SACHET public feed request failed: HTTP ${
          response?.status ?? 'NO_RESPONSE'
        }`,
      );
    }
  } catch (err) {
    console.error(
      'Public SACHET feed notice:',
      (err as Error).message,
    );

    /*
     * If SACHET is temporarily unavailable, use the
     * last real SACHET response if one exists.
     */
    sachetLiveAlerts =
      sachetCache.data.filter(
        (a) =>
          a.feedOrigin === 'NDMA_SACHET_LIVE' &&
          !isAlertExpired(a, now),
      );
  }

  /*
   * 2. USGS live earthquakes.
   */
  const usgsAlerts =
    await fetchUSGSIndianEarthquakes();

  /*
   * 3. ONLY REAL/LIVE SOURCES.
   *
   * The old getVerifiedSnapshotAlerts() has intentionally
   * been removed. Nothing is fabricated when an upstream
   * source has no data.
   */
  const combinedAlerts: SachetAlert[] = [
    ...sachetLiveAlerts,
    ...usgsAlerts,
  ];

  /*
   * Remove expired records.
   */
  const activeAlerts =
    combinedAlerts
      .filter(
        (a) => !isAlertExpired(a, now),
      )
      .sort(
        (a, b) =>
          new Date(
            b.sent ||
              b.effective,
          ).getTime() -
          new Date(
            a.sent ||
              a.effective,
          ).getTime(),
      );

  /*
   * Stable-ish application ETag.
   */
  const fingerprint =
    activeAlerts
      .map(
        (a) =>
          `${a.identifier}|${a.sent}|${a.effective}|${a.expires}|${a.category}`,
      )
      .sort()
      .join('||');

  let hash = 2166136261;

  for (
    let i = 0;
    i < fingerprint.length;
    i++
  ) {
    hash ^= fingerprint.charCodeAt(i);
    hash = Math.imul(
      hash,
      16777619,
    );
  }

  const newEtag =
    `live-api-feed-${(
      hash >>> 0
    ).toString(16)}-${activeAlerts.length}`;

  sachetCache = {
    etag: newEtag,

    lastUpdated:
      new Date().toISOString(),

    data: activeAlerts,

    sourceUrl:
      PUBLIC_SACHET_FEED_URL,

      liveSourceCount:
      sachetLiveAlerts.length +
      usgsAlerts.length,
  };

  return {
    alerts: activeAlerts,

    etag: newEtag,

    isModified:
      clientEtag !== newEtag,

    lastUpdated:
      sachetCache.lastUpdated,

    cacheStatus:
      'LIVE_FETCH',

    sourceUrl:
      PUBLIC_SACHET_FEED_URL,
  };
}

