import {
  DisasterCategory,
  SachetAlert,
  RelevanceResult,
  RelevanceStatus,
  RelevanceConfidence,
  UserLocation,
  EvacuationGuidance,
  EmergencyContact,
} from '../types/disaster';

// Category-specific geographic relevance buffer thresholds in Kilometers
export const CATEGORY_DISTANCE_THRESHOLDS: Record<DisasterCategory | string, number> = {
  Cyclone: 150, // Cyclones have broad gale & surge radius
  Flood: 35, // Inundation / river basin impact radius
  'Urban Flood': 25,
  Earthquake: 250, // Tremors & seismic impact zone
  Landslide: 20, // Localized slope failure zone
  'Heat Wave': 75, // Regional thermal anomaly
  'Cold Wave': 75,
  Lightning: 25, // Convective thunderstorm cell
  Thunderstorm: 35,
  'Heavy Rain': 45,
  Storm: 60,
  Tsunami: 120, // Coastal surge perimeter
  Avalanche: 30,
  'Forest Fire': 30,
  Drought: 100,
  'Air Pollution': 80,
  'General Alert': 40,
};

/**
 * Haversine formula to compute great-circle distance between two coordinates in kilometers.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // 1 decimal precision
}

/**
 * Calculates initial compass bearing from point 1 to point 2 in degrees [0, 360).
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export function degreesToCardinal(deg: number): string {
  const cardinals = [
    'North',
    'North-East',
    'East',
    'South-East',
    'South',
    'South-West',
    'West',
    'North-West',
  ];
  const index = Math.round(deg / 45) % 8;
  return cardinals[index];
}

export function getOppositeCardinal(cardinal: string): string {
  const opposites: Record<string, string> = {
    North: 'South (Inland)',
    'North-East': 'South-West (Inland)',
    East: 'West (Inland / Higher Ground)',
    'South-East': 'North-West (Inland)',
    South: 'North (Inland)',
    'South-West': 'North-East (Inland)',
    West: 'East (Safe Elevation)',
    'North-West': 'South-East (Safe Zone)',
  };
  return opposites[cardinal] || 'Inland towards Higher Elevation';
}

/**
 * Generates verified emergency helplines for India / state / district.
 */
export function getEmergencyContactsForState(state?: string, helplineField?: string): EmergencyContact[] {
  const contacts: EmergencyContact[] = [
    {
      label: 'National Emergency Helpline (SOS)',
      number: '112',
      category: 'National',
      description: 'Single all-India emergency response for Police, Fire & Ambulance',
    },
    {
      label: 'NDRF Disaster Response Force',
      number: '1078',
      category: 'Disaster Force',
      description: 'National Disaster Response Force Headquarters 24x7 control room',
    },
    {
      label: 'State Emergency Operations Center (SEOC)',
      number: '1070',
      category: 'State',
      description: 'Toll-free state disaster management command control room',
    },
    {
      label: 'District Emergency Operations Center (DEOC)',
      number: '1077',
      category: 'District',
      description: 'District Collectorate emergency operations & shelter coordination',
    },
    {
      label: 'Police Control Room',
      number: '100',
      category: 'Police',
      description: 'Local law enforcement and rapid evacuation escorts',
    },
    {
      label: 'Ambulance & Medical Emergency',
      number: '108',
      category: 'Medical',
      description: 'National Health Mission 24x7 emergency medical transport',
    },
  ];

  if (helplineField && helplineField.trim()) {
    contacts.unshift({
      label: 'Official Issuer Helpline (From CAP Alert)',
      number: helplineField.replace(/[^0-9| ]/g, '').trim() || helplineField,
      category: 'State',
      description: helplineField,
    });
  }

  return contacts;
}

/**
 * Generates structured evacuation vector, safety measures, Do's & Don'ts tailored to hazard.
 */
export function generateEvacuationGuidance(
  userLoc: UserLocation,
  alert: SachetAlert,
  distanceKm: number,
  isInsideBoundary: boolean
): EvacuationGuidance {
  const originLat =
    alert.centroid?.[0] ??
    (alert.polygon?.coordinates?.[0]?.[0] ?? (alert.circle?.center[0] ?? userLoc.lat));
  const originLng =
    alert.centroid?.[1] ??
    (alert.polygon?.coordinates?.[0]?.[1] ?? (alert.circle?.center[1] ?? userLoc.lng));

  const bearingFromDisaster = calculateBearing(originLat, originLng, userLoc.lat, userLoc.lng);
  const disasterRelativeBearing = calculateBearing(userLoc.lat, userLoc.lng, originLat, originLng);

  const disasterDirFromUser = degreesToCardinal(disasterRelativeBearing);
  const safeEvacDir = getOppositeCardinal(disasterDirFromUser);

  const hazardOriginName = alert.areaDesc || alert.district || alert.state || 'Epicenter';
  const userCity = userLoc.cityName || 'your current area';

  let approachDescription = '';
  if (distanceKm === 0 || isInsideBoundary) {
    approachDescription = `Direct Impact Zone: Active hazard is currently centered over ${hazardOriginName} and encompasses ${userCity}.`;
  } else {
    approachDescription = `Hazard vector positioned ${distanceKm} km ${disasterDirFromUser} of ${userCity} (near ${hazardOriginName}).`;
  }

  // Recommended safe buffer distance to move
  let safeDistanceKm = 30;
  if (alert.category === 'Cyclone') safeDistanceKm = Math.max(35, Math.round(distanceKm * 0.7));
  else if (alert.category === 'Flood' || alert.category === 'Urban Flood') safeDistanceKm = 15;
  else if (alert.category === 'Landslide') safeDistanceKm = 10;
  else if (alert.category === 'Earthquake') safeDistanceKm = 20;

  // Tailored Actionable Measures & Do's / Don'ts
  let actionableMeasures: string[] = [];
  let dos: string[] = [];
  let donts: string[] = [];
  let urgencyLevel: EvacuationGuidance['urgencyLevel'] = 'STANDBY_AWARE';

  if (isInsideBoundary || distanceKm <= 20) {
    urgencyLevel = 'IMMEDIATE_EVACUATION';
  } else if (distanceKm <= 60) {
    urgencyLevel = 'PREPARE_TO_MOVE';
  } else if (distanceKm <= 120) {
    urgencyLevel = 'SHELTER_IN_PLACE';
  }

  const catLower = (alert.category || '').toLowerCase();

  if (catLower.includes('cyclon') || catLower.includes('storm')) {
    actionableMeasures = [
      `1. Immediate Evacuation Vector: Move at least ${safeDistanceKm} km towards the ${safeEvacDir} into designated Multi-Purpose Cyclone Shelters (MPCS) or sturdy reinforced concrete buildings.`,
      '2. Power & Gas Shutoff: Switch off main electrical circuit breakers and LPG gas regulators before leaving to prevent post-surge electrocution and fires.',
      '3. Emergency Survival Kit: Carry drinking water (3L/person), non-perishable food, power banks, battery torch, first-aid kit, and essential ID documents in waterproof bags.',
      '4. Structural Safety: Fasten loose rooftop tin sheets, secure windows, and move vehicles away from trees and hoardings.',
    ];
    dos = [
      'Relocate immediately to official cyclone shelters if residing in kutcha/low-lying structures.',
      'Keep mobile phones fully charged and stay tuned to official district disaster updates.',
      'Assist children, elderly persons, and pregnant women first during evacuation convoys.',
      'Store emergency drinking water in sealed, clean containers.',
    ];
    donts = [
      'DO NOT venture outdoors during the calm "eye of the cyclone" — gale winds will reverse abruptly with violent force.',
      'DO NOT touch fallen electric poles, dangling wires, or water in contact with submerged lines.',
      'DO NOT spread unverified social media rumours or ignore siren warning broadcasts.',
      'DO NOT attempt to cross coastal causeways or storm-surge inundated roads.',
    ];
  } else if (catLower.includes('flood') || catLower.includes('inundat')) {
    actionableMeasures = [
      `1. Immediate Flood Evacuation: Relocate ${safeDistanceKm} km towards ${safeEvacDir} to higher ground away from river embankments and low-lying drainage depressions.`,
      '2. Elevated Storage: Move valuable electronics, documents, and livestock to upper floors or earthen highlands.',
      '3. Water Safety: Boil drinking water or use chlorine purification tablets to prevent water-borne epidemics.',
      '4. Dial 1077 or 1070 for National Disaster Response Force (NDRF) rescue boat assistance.',
    ];
    dos = [
      'Disconnect main electrical supply to avoid short circuits in inundated ground floors.',
      'Keep a floating life jacket, inflated tube, or strong rope handy.',
      'Follow marked evacuation routes established by district administration.',
    ];
    donts = [
      'DO NOT walk or drive through flowing water — 15 cm of moving water can knock you down, and 30 cm can float vehicles.',
      'DO NOT consume flood water or food exposed to flood currents.',
      'DO NOT wade through flood water near electrical substations or transformer posts.',
    ];
  } else if (catLower.includes('landslide')) {
    actionableMeasures = [
      `1. Slope Evacuation: Evacuate immediately ${safeDistanceKm} km ${safeEvacDir} away from steep cut slopes, mountain streams, and debris paths.`,
      '2. Stay Alert for Warning Signs: Listen for unusual sounds like trees cracking, boulders knocking together, or muddy stream discharge.',
      '3. Highway Clearance: Halt mountain vehicular travel on affected corridors until State PWD and BRO confirm clearance.',
    ];
    dos = [
      'Move quickly out of the path of a landslide or debris flow towards solid bedrock ridge lines.',
      'Curl into a tight ball and protect your head if escape is not possible.',
      'Notify local authorities immediately about cracks appearing in road pavements or hillside retaining walls.',
    ];
    donts = [
      'DO NOT stay near stream channels, ravines, or cliff bottoms during prolonged heavy downpours.',
      'DO NOT cross active rockfall zones or newly formed debris piles.',
    ];
  } else if (catLower.includes('earthquake')) {
    actionableMeasures = [
      '1. Drop, Cover, and Hold On: Take cover under a sturdy desk or interior wall away from glass windows and heavy fixtures.',
      '2. Post-Tremor Evacuation: Once shaking stops, evacuate using stairwells (never use elevators) to open grounds.',
      '3. Gas & Electrical Safety: Shut off gas cylinders and main power breakers to avert aftershock fires.',
    ];
    dos = [
      'Stay inside if you are in a modern seismic-resistant building; protect head and neck.',
      'Move to open areas clear of power lines, high-rises, and brick parapets if outdoors.',
      'Expect aftershocks and keep emergency shoes and torches near your bed.',
    ];
    donts = [
      'DO NOT run outside during active ground tremors — falling debris causes most injuries.',
      'DO NOT use elevators or light matches/lighters until gas line integrity is verified.',
    ];
  } else {
    actionableMeasures = [
      `1. Precautionary Action: Follow official advisories and maintain readiness to move towards ${safeEvacDir} if conditions worsen.`,
      '2. Communication: Keep emergency helpline numbers handy (112 / 1070 / 1077).',
      '3. Stay Informed: Monitor official SACHET / NDMA / IMD bulletins.',
    ];
    dos = [
      'Follow instructions from local disaster management personnel.',
      'Check on vulnerable neighbors, elderly individuals, and pets.',
    ];
    donts = [
      'DO NOT venture into warning perimeters unnecessarily.',
      'DO NOT believe or propagate rumors.',
    ];
  }

  const emergencyContacts = getEmergencyContactsForState(alert.state, alert.helpline);

  return {
    hazardOriginName,
    bearingDegrees: Math.round(bearingFromDisaster),
    bearingCardinal: disasterDirFromUser,
    approachDescription,
    recommendedDirection: safeEvacDir,
    safeDistanceKm,
    urgencyLevel,
    actionableMeasures,
    dos,
    donts,
    emergencyContacts,
  };
}

/**
 * Ray-casting algorithm to test if a point (lat, lng) is strictly inside a polygon of [lat, lng] vertices.
 */
export function isPointInPolygon(
  point: [number, number],
  polygonCoords: [number, number][]
): boolean {
  if (!polygonCoords || polygonCoords.length < 3) return false;

  const [lat, lng] = point;
  let inside = false;

  for (let i = 0, j = polygonCoords.length - 1; i < polygonCoords.length; j = i++) {
    const [xi, yi] = polygonCoords[i];
    const [xj, yj] = polygonCoords[j];

    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Computes minimum distance from a point to polygon perimeter (in km).
 */
export function minDistanceToPolygon(
  point: [number, number],
  polygonCoords: [number, number][]
): number {
  if (!polygonCoords || polygonCoords.length === 0) return Infinity;

  let minDistance = Infinity;
  for (let i = 0; i < polygonCoords.length; i++) {
    const vertex = polygonCoords[i];
    const d = calculateHaversineDistance(point[0], point[1], vertex[0], vertex[1]);
    if (d < minDistance) {
      minDistance = d;
    }
  }
  return minDistance;
}

/**
 * Checks if an alert is expired based on current wall-clock time (Section 77A).
 */
export function isAlertExpired(alert: SachetAlert, now: Date = new Date()): boolean {
  if (!alert.expires) return false;
  const expiryTime = new Date(alert.expires).getTime();
  return !isNaN(expiryTime) && expiryTime <= now.getTime();
}

/**
 * Generates a deterministic plain-language summary string from official structured fields (Section 50).
 * Gemini is NEVER used to invent or rephrase core alert facts.
 */
export function generatePlainLanguageSummary(alert: SachetAlert): string {
  const event = alert.event || alert.category || 'Disaster Alert';
  const area = alert.areaDesc || 'specified region';
  const severity = alert.severity || 'Active';

  let timeStr = 'further notice';
  if (alert.expires) {
    try {
      const exp = new Date(alert.expires);
      if (!isNaN(exp.getTime())) {
        timeStr =
          exp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) +
          ' on ' +
          exp.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    } catch {
      timeStr = alert.expires;
    }
  }

  return `Official ${severity} ${event} is active for ${area}, valid until ${timeStr}.`;
}

/**
 * Evaluates the strict 5-case Location Relevance Engine for a user against an alert.
 */
export function evaluateLocationRelevance(
  userLoc: UserLocation,
  alert: SachetAlert
): RelevanceResult {
  const plainSummary = generatePlainLanguageSummary(alert);
  const threshold =
    CATEGORY_DISTANCE_THRESHOLDS[alert.category] || CATEGORY_DISTANCE_THRESHOLDS['General Alert'];

  // Case 1 & Case 2: Alert has an official polygon
  if (alert.polygon && alert.polygon.coordinates && alert.polygon.coordinates.length >= 3) {
    const inside = isPointInPolygon([userLoc.lat, userLoc.lng], alert.polygon.coordinates);

    if (inside) {
      // Case 1: Point strictly inside official polygon (highest confidence)
      const status: RelevanceStatus =
        alert.severity === 'Extreme' || alert.urgency === 'Immediate'
          ? 'CRITICAL'
          : alert.severity === 'Severe'
          ? 'HIGH_PRIORITY'
          : 'WARNING';

      const evacuationGuidance = generateEvacuationGuidance(userLoc, alert, 0, true);

      return {
        status,
        distanceKm: 0,
        confidence: 'exact_polygon',
        confidenceLabel: 'Authoritative Official Boundary Match',
        isInsideBoundary: true,
        reason: `Your coordinates are directly inside the official ${alert.event} warning boundary for ${alert.areaDesc}.`,
        plainSummary,
        alert,
        evacuationGuidance,
      };
    } else {
      // Case 2: Point outside polygon -> compute distance
      const distance = minDistanceToPolygon([userLoc.lat, userLoc.lng], alert.polygon.coordinates);
      const roundedDist = Math.round(distance * 10) / 10;

      if (distance <= threshold) {
        const status: RelevanceStatus = distance <= threshold * 0.35 ? 'WARNING' : 'NEARBY';
        const evacuationGuidance = generateEvacuationGuidance(userLoc, alert, roundedDist, false);

        return {
          status,
          distanceKm: roundedDist,
          confidence: 'polygon_distance',
          confidenceLabel: `Near Warning Boundary (${Math.round(distance)} km away)`,
          isInsideBoundary: false,
          reason: `Your location is approximately ${Math.round(distance)} km from the active ${alert.event} boundary (Buffer: ${threshold} km).`,
          plainSummary,
          alert,
          evacuationGuidance,
        };
      } else {
        return {
          status: 'NOT_RELEVANT',
          distanceKm: roundedDist,
          confidence: 'polygon_distance',
          confidenceLabel: 'Outside Category Relevance Buffer',
          isInsideBoundary: false,
          reason: `Distance (${Math.round(distance)} km) exceeds relevance threshold for ${alert.category} (${threshold} km).`,
          plainSummary,
          alert,
        };
      }
    }
  }

  // Case 3: Alert has an official circle
  if (alert.circle && alert.circle.center) {
    const distToCenter = calculateHaversineDistance(
      userLoc.lat,
      userLoc.lng,
      alert.circle.center[0],
      alert.circle.center[1]
    );
    const radius = alert.circle.radiusKm || 20;

    if (distToCenter <= radius) {
      const evacuationGuidance = generateEvacuationGuidance(userLoc, alert, 0, true);
      return {
        status: alert.severity === 'Extreme' ? 'CRITICAL' : 'WARNING',
        distanceKm: 0,
        confidence: 'circle',
        confidenceLabel: 'Inside Official Warning Circle',
        isInsideBoundary: true,
        reason: `Your coordinates fall within the ${radius} km radius warning zone.`,
        plainSummary,
        alert,
        evacuationGuidance,
      };
    } else if (distToCenter <= radius + threshold) {
      const edgeDist = Math.max(0, distToCenter - radius);
      const roundedDist = Math.round(edgeDist * 10) / 10;
      const evacuationGuidance = generateEvacuationGuidance(userLoc, alert, roundedDist, false);
      return {
        status: 'NEARBY',
        distanceKm: roundedDist,
        confidence: 'circle',
        confidenceLabel: `Near Warning Circle (${Math.round(edgeDist)} km away)`,
        isInsideBoundary: false,
        reason: `Your location is approximately ${Math.round(edgeDist)} km from the warning perimeter.`,
        plainSummary,
        alert,
        evacuationGuidance,
      };
    } else {
      return {
        status: 'NOT_RELEVANT',
        distanceKm: Math.round(distToCenter * 10) / 10,
        confidence: 'circle',
        confidenceLabel: 'Outside Circle Perimeter',
        isInsideBoundary: false,
        reason: `Distance (${Math.round(distToCenter)} km) is outside warning perimeter.`,
        plainSummary,
        alert,
      };
    }
  }

  // Case 4: Alert has centroid only (no polygon or circle geometry)
  if (alert.centroid) {
    const distToCentroid = calculateHaversineDistance(
      userLoc.lat,
      userLoc.lng,
      alert.centroid[0],
      alert.centroid[1]
    );
    const roundedDist = Math.round(distToCentroid * 10) / 10;

    if (distToCentroid <= threshold) {
      const evacuationGuidance = generateEvacuationGuidance(userLoc, alert, roundedDist, false);
      return {
        status: 'NEARBY',
        distanceKm: roundedDist,
        confidence: 'approximate_centroid',
        confidenceLabel: 'approximate — precise boundary unavailable',
        isInsideBoundary: false,
        reason: `Located ~${Math.round(distToCentroid)} km from alert epicenter. Official precise polygon boundary was not supplied in feed.`,
        plainSummary,
        alert,
        evacuationGuidance,
      };
    } else {
      return {
        status: 'NOT_RELEVANT',
        distanceKm: roundedDist,
        confidence: 'approximate_centroid',
        confidenceLabel: 'approximate — outside radius',
        isInsideBoundary: false,
        reason: `Centroid distance (${Math.round(distToCentroid)} km) exceeds category threshold.`,
        plainSummary,
        alert,
      };
    }
  }

  // Case 5: Named administrative region match only (state/district match)
  if (alert.state && userLoc.state) {
    const normAlertState = alert.state.toLowerCase().trim();
    const normUserState = userLoc.state.toLowerCase().trim();

    if (
      normAlertState === normUserState ||
      normAlertState.includes(normUserState) ||
      normUserState.includes(normAlertState)
    ) {
      const evacuationGuidance = generateEvacuationGuidance(userLoc, alert, 0, false);
      return {
        status: 'AWARENESS_ONLY',
        distanceKm: 0,
        confidence: 'regional_match',
        confidenceLabel: 'State/District Administrative Match Only',
        isInsideBoundary: false,
        reason: `Regional match for ${alert.state}. Precise coordinates/polygon were not available from issuer.`,
        plainSummary,
        alert,
        evacuationGuidance,
      };
    }
  }

  // Default: Cannot establish geographical relevance
  return {
    status: 'NOT_RELEVANT',
    distanceKm: Infinity,
    confidence: 'unverified',
    confidenceLabel: 'No Geographic Relevance',
    isInsideBoundary: false,
    reason: 'Alert does not have proximity or overlap with current coordinates.',
    plainSummary,
    alert,
  };
}

/**
 * Evaluates relevance for all alerts against a user location and sorts them by priority and distance.
 */
export function evaluateAllAlertsRelevance(
  alerts: SachetAlert[],
  userLoc: UserLocation
): RelevanceResult[] {
  const priorityOrder: Record<RelevanceStatus, number> = {
    CRITICAL: 1,
    HIGH_PRIORITY: 2,
    WARNING: 3,
    NEARBY: 4,
    AWARENESS_ONLY: 5,
    NOT_RELEVANT: 6,
  };

  const results = alerts.map((alert) => evaluateLocationRelevance(userLoc, alert));

  return results.sort((a, b) => {
    const pDiff = (priorityOrder[a.status] || 99) - (priorityOrder[b.status] || 99);
    if (pDiff !== 0) return pDiff;
    return (a.distanceKm || 0) - (b.distanceKm || 0);
  });
}


