export type DisasterCategory =
  | 'Cyclone'
  | 'Flood'
  | 'Earthquake'
  | 'Landslide'
  | 'Heat Wave'
  | 'Cold Wave'
  | 'Lightning'
  | 'Thunderstorm'
  | 'Heavy Rain'
  | 'Storm'
  | 'Tsunami'
  | 'Avalanche'
  | 'Forest Fire'
  | 'Drought'
  | 'Urban Flood'
  | 'Air Pollution'
  | 'General Alert';

export type AlertSeverity = 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
export type AlertUrgency = 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown';
export type AlertCertainty = 'Observed' | 'Likely' | 'Possible' | 'Unlikely' | 'Unknown';

export interface AlertPolygon {
  type: 'Polygon';
  coordinates: [number, number][]; // [lat, lng] array
}

export interface AlertCircle {
  center: [number, number]; // [lat, lng]
  radiusKm: number;
}

export interface SachetAlert {
  id: string;
  identifier: string;
  sender: string;
  sent: string;
  status: string;
  msgType: string;
  source: string;
  scope: string;
  category: DisasterCategory;
  rawCategory: string;
  event: string;
  urgency: AlertUrgency;
  severity: AlertSeverity;
  certainty: AlertCertainty;
  headline: string;
  description: string;
  instruction: string; // Verbatim official instruction
  areaDesc: string;
  polygon?: AlertPolygon;
  circle?: AlertCircle;
  centroid?: [number, number]; // [lat, lng]
  state?: string;
  district?: string;
  effective: string;
  expires: string;
  isExpired: boolean;
  webUrl?: string;
  sourceAgency?: string;
  helpline?: string;
  bulletinNo?: string;
  officialPortalUrl?: string;
  liveNewsQuery?: string;
  disasterYear?: number;
  feedOrigin?: 'NDMA_SACHET_LIVE' | 'IMD_CAP_LIVE' | 'SDMA_TELEMETRY' | 'VERIFIED_SNAPSHOT';
}

export type RelevanceStatus =
  | 'NOT_RELEVANT'
  | 'AWARENESS_ONLY'
  | 'NEARBY'
  | 'WARNING'
  | 'HIGH_PRIORITY'
  | 'CRITICAL';

export type RelevanceConfidence =
  | 'exact_polygon' // Case 1: Point inside official polygon (highest confidence)
  | 'polygon_distance' // Case 2: Point within category buffer of polygon
  | 'circle' // Case 3: Point inside/near official circle
  | 'approximate_centroid' // Case 4: Centroid only - "approximate — precise boundary unavailable"
  | 'regional_match' // Case 5: Admin region / State match only
  | 'unverified';

export interface EmergencyContact {
  label: string;
  number: string;
  category: 'National' | 'State' | 'District' | 'Police' | 'Medical' | 'Disaster Force';
  description: string;
}

export interface EvacuationGuidance {
  hazardOriginName: string;
  bearingDegrees: number;
  bearingCardinal: string; // e.g. 'South', 'South-East'
  approachDescription: string; // e.g. 'Approaching from South (Puri) towards North (Bhubaneswar)'
  recommendedDirection: string; // e.g. 'North-West (Inland towards higher elevation)'
  safeDistanceKm: number; // e.g. 35
  urgencyLevel: 'IMMEDIATE_EVACUATION' | 'PREPARE_TO_MOVE' | 'SHELTER_IN_PLACE' | 'STANDBY_AWARE';
  actionableMeasures: string[];
  dos: string[];
  donts: string[];
  emergencyContacts: EmergencyContact[];
}

export interface RelevanceResult {
  status: RelevanceStatus;
  distanceKm: number;
  confidence: RelevanceConfidence;
  confidenceLabel: string;
  isInsideBoundary: boolean;
  reason: string;
  plainSummary: string; // Deterministic plain-language summary (Section 50)
  alert: SachetAlert;
  evacuationGuidance?: EvacuationGuidance;
}

export interface UserLocation {
  lat: number;
  lng: number;
  accuracyMeters?: number;
  timestamp: number;
  cityName?: string;
  district?: string;
  state?: string;
  isCustomLookup?: boolean; // For "Check another location" (Section 49A)
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  publisher: string;
  publishedAt: string;
  relativeTime: string;
  recencyVerified: boolean;
  isWithinTemporalGate: boolean;
  matchedEventOrAlertId?: string;
  query?: string;
}

export interface CitedSource {
  id: string; // e.g. 'S1', 'S2' (stable across bundle)
  title: string;
  publisher: string;
  publishedAt: string;
  url: string;
  summary: string;
  qualityScore?: number;
  keyFacts?: string[];
}

export interface TimelineEvent {
  date: string;
  event: string;
  description: string;
  citations: string[]; // e.g. ['S1', 'S2']
}

export interface ConflictingReport {
  topic: string;
  details: string;
  sources: string[];
}

export interface NumericRange {
  min: number;
  max: number;
  outliers?: number[];
  outlierSources?: { value: number; sourceIds: string[] }[];
}

export interface EvidenceBundle {
  id: string;
  eventName: string;
  disasterType: DisasterCategory;
  location: string;
  state: string;
  country: string;
  eventDate?: string;
  dateRange: string;
  numericCasualtiesRange?: NumericRange;
  reportedCasualties: string;
  reportedDamage: string;
  sources: CitedSource[];
  timeline: TimelineEvent[];
  whatHappened: string;
  affectedAreas: string;
  humanImpact: string;
  infrastructureDamage: string;
  economicImpact: string;
  governmentResponse: string;
  rescueRelief: string;
  recovery: string;
  sourceAssessment: string;
  conflictingReports: ConflictingReport[];
  synthesizedAt: string;
  evidenceStatus: 'High Confidence' | 'Moderate Evidence' | 'Limited Coverage' | 'Model-Sourced / Limited External Citation';
  retrievalMetadata: {
    queriesExecuted: string[];
    rawSourcesCount: number;
    dedupedSourcesCount: number;
  };
}

export interface ComparisonMatrix {
  events: EvidenceBundle[];
  comparisonPoints: {
    category: string;
    label: string;
    values: { eventId: string; value: string; citations: string[] }[];
  }[];
  aiSynthesis: {
    broaderImpact: string;
    responseDifferences: string;
    crossEventLessons: string;
    citations: string[];
  };
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sources?: CitedSource[];
  stage?: 'understanding' | 'searching' | 'reviewing' | 'reconciling' | 'ready';
  language?: string;
  audioBase64?: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  associatedEventId?: string;
}
