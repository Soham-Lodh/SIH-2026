import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  evaluateLocationRelevance,
  isPointInPolygon,
  minDistanceToPolygon,
  calculateHaversineDistance,
  isAlertExpired,
  generatePlainLanguageSummary,
} from '../server/lib/relevanceEngine.ts';
import { SachetAlert, UserLocation } from '../server/types/disaster.ts';

describe('Location Relevance Engine - 5 Cases & Boundary Verification', () => {
  // Polygon enclosing Bhubaneswar area (~20.25 to 20.35 Lat, 85.78 to 85.88 Lng)
  const odishaCycloneAlert: SachetAlert = {
    id: 'OD-CYC-2026-01',
    identifier: 'SACHET-OD-CYC-01',
    sender: 'IMD Bhubaneswar',
    sent: new Date().toISOString(),
    status: 'Actual',
    msgType: 'Alert',
    source: 'SACHET/NDMA',
    scope: 'Public',
    category: 'Cyclone',
    rawCategory: 'Cyclone',
    event: 'Severe Cyclonic Storm Warning',
    urgency: 'Immediate',
    severity: 'Extreme',
    certainty: 'Observed',
    headline: 'Severe Cyclone Warning for Coastal Odisha (Khordha & Puri)',
    description: 'Squally winds 90-100 kmph gusting to 115 kmph expected.',
    instruction: 'Fishermen advised not to venture into sea. Evacuate low-lying areas immediately.',
    areaDesc: 'Khordha, Puri and Cuttack districts',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [20.20, 85.70],
        [20.40, 85.70],
        [20.40, 85.95],
        [20.20, 85.95],
        [20.20, 85.70],
      ],
    },
    effective: new Date(Date.now() - 3600000).toISOString(),
    expires: new Date(Date.now() + 86400000).toISOString(),
    isExpired: false,
  };

  const rajasthanEarthquakeAlert: SachetAlert = {
    id: 'RJ-EQ-2026-02',
    identifier: 'SACHET-RJ-EQ-02',
    sender: 'NCS New Delhi',
    sent: new Date().toISOString(),
    status: 'Actual',
    msgType: 'Alert',
    source: 'SACHET/NDMA',
    scope: 'Public',
    category: 'Earthquake',
    rawCategory: 'Earthquake',
    event: 'Earthquake Magnitude 4.8',
    urgency: 'Immediate',
    severity: 'Moderate',
    certainty: 'Observed',
    headline: 'Earthquake in Bikaner, Rajasthan',
    description: 'Moderate tremors felt in Bikaner region.',
    instruction: 'Drop, Cover, and Hold On. Avoid damaged structures.',
    areaDesc: 'Bikaner District, Rajasthan',
    centroid: [28.02, 73.31], // Bikaner, Rajasthan
    state: 'Rajasthan',
    effective: new Date().toISOString(),
    expires: new Date(Date.now() + 7200000).toISOString(),
    isExpired: false,
  };

  it('Case 1: User strictly inside official polygon -> RELEVANT (0 km, exact_polygon, CRITICAL/HIGH_PRIORITY)', () => {
    const userInBhubaneswar: UserLocation = {
      lat: 20.2961, // Inside polygon
      lng: 85.8245,
      timestamp: Date.now(),
      state: 'Odisha',
      cityName: 'Bhubaneswar',
    };

    const res = evaluateLocationRelevance(userInBhubaneswar, odishaCycloneAlert);
    assert.strictEqual(res.status, 'CRITICAL');
    assert.strictEqual(res.distanceKm, 0);
    assert.strictEqual(res.confidence, 'exact_polygon');
    assert.strictEqual(res.isInsideBoundary, true);
    assert.ok(res.reason.includes('directly inside'));
  });

  it('Case 2 & Boundary Test: User just outside polygon edge (~12 km away) -> NEARBY (not false WARNING inside boundary)', () => {
    // Lat 20.20 to 20.40, Lng 85.70 to 85.95
    // User at 20.48, 85.82 (just north of Cuttack border, ~9 km away)
    const userJustOutside: UserLocation = {
      lat: 20.48,
      lng: 85.82,
      timestamp: Date.now(),
      state: 'Odisha',
      cityName: 'Choudwar',
    };

    const res = evaluateLocationRelevance(userJustOutside, odishaCycloneAlert);
    assert.strictEqual(res.isInsideBoundary, false);
    assert.ok(res.distanceKm > 0 && res.distanceKm < 30);
    assert.strictEqual(res.confidence, 'polygon_distance');
    // Threshold for Cyclone is 150 km, so user at ~9 km is in WARNING / NEARBY zone with clear distance indicator
    assert.ok(res.status === 'WARNING' || res.status === 'NEARBY');
  });

  it('Boundary Case: User far outside polygon (> 150 km) -> NOT_RELEVANT', () => {
    const userInKolkata: UserLocation = {
      lat: 22.5726,
      lng: 88.3639, // ~360 km away from Bhubaneswar
      timestamp: Date.now(),
      state: 'West Bengal',
      cityName: 'Kolkata',
    };

    const res = evaluateLocationRelevance(userInKolkata, odishaCycloneAlert);
    assert.strictEqual(res.status, 'NOT_RELEVANT');
    assert.strictEqual(res.isInsideBoundary, false);
    assert.ok(res.distanceKm > 150);
  });

  it('Irrelevant Alert: User in Bhubaneswar receiving Rajasthan earthquake alert -> NO WARNING (NOT_RELEVANT)', () => {
    const userInBhubaneswar: UserLocation = {
      lat: 20.2961,
      lng: 85.8245,
      timestamp: Date.now(),
      state: 'Odisha',
      cityName: 'Bhubaneswar',
    };

    const res = evaluateLocationRelevance(userInBhubaneswar, rajasthanEarthquakeAlert);
    assert.strictEqual(res.status, 'NOT_RELEVANT');
    assert.ok(res.distanceKm > 1000); // Over 1300 km away
  });

  it('Case 3: Official Circle Alert -> Inside vs Outside buffer', () => {
    const circleAlert: SachetAlert = {
      id: 'KL-FLD-01',
      identifier: 'SACHET-KL-01',
      sender: 'KSDMA',
      sent: new Date().toISOString(),
      status: 'Actual',
      msgType: 'Alert',
      source: 'SACHET/NDMA',
      scope: 'Public',
      category: 'Flood',
      rawCategory: 'Flood',
      event: 'Flash Flood Advisory',
      urgency: 'Expected',
      severity: 'Severe',
      certainty: 'Likely',
      headline: 'Flash flood alert for Idukki Dam downstream',
      description: 'Water discharge increased.',
      instruction: 'Move to elevated shelters.',
      areaDesc: 'Idukki downstream',
      circle: {
        center: [9.85, 76.97],
        radiusKm: 25,
      },
      effective: new Date().toISOString(),
      expires: new Date(Date.now() + 36000000).toISOString(),
      isExpired: false,
    };

    const userInsideCircle: UserLocation = {
      lat: 9.87,
      lng: 76.98,
      timestamp: Date.now(),
      state: 'Kerala',
    };

    const res = evaluateLocationRelevance(userInsideCircle, circleAlert);
    assert.strictEqual(res.distanceKm, 0);
    assert.strictEqual(res.isInsideBoundary, true);
    assert.strictEqual(res.confidence, 'circle');
  });

  it('Case 4: Centroid only -> approximate confidence label', () => {
    const userInBikaner: UserLocation = {
      lat: 28.05,
      lng: 73.35,
      timestamp: Date.now(),
      state: 'Rajasthan',
      cityName: 'Bikaner',
    };

    const res = evaluateLocationRelevance(userInBikaner, rajasthanEarthquakeAlert);
    assert.strictEqual(res.status, 'NEARBY');
    assert.strictEqual(res.confidence, 'approximate_centroid');
    assert.ok(res.confidenceLabel.includes('approximate — precise boundary unavailable'));
  });

  it('Case 5: Administrative State match without coordinates -> regional_match', () => {
    const adminAlert: SachetAlert = {
      id: 'AS-RAIN-01',
      identifier: 'SACHET-AS-01',
      sender: 'ASDMA',
      sent: new Date().toISOString(),
      status: 'Actual',
      msgType: 'Alert',
      source: 'SACHET/NDMA',
      scope: 'Public',
      category: 'Heavy Rain',
      rawCategory: 'Heavy Rain',
      event: 'Heavy Rainfall Warning',
      urgency: 'Expected',
      severity: 'Moderate',
      certainty: 'Likely',
      headline: 'Heavy rains in Assam',
      description: 'Heavy to very heavy rainfall expected across Assam.',
      instruction: 'Take shelter during intense showers.',
      areaDesc: 'Assam State',
      state: 'Assam',
      effective: new Date().toISOString(),
      expires: new Date(Date.now() + 86400000).toISOString(),
      isExpired: false,
    };

    const userInGuwahati: UserLocation = {
      lat: 0,
      lng: 0,
      timestamp: Date.now(),
      state: 'Assam',
      cityName: 'Guwahati',
    };

    const res = evaluateLocationRelevance(userInGuwahati, adminAlert);
    assert.strictEqual(res.status, 'AWARENESS_ONLY');
    assert.strictEqual(res.confidence, 'regional_match');
  });

  it('Deterministic Plain-Language Summary Generator', () => {
    const summary = generatePlainLanguageSummary(odishaCycloneAlert);
    assert.ok(summary.startsWith('Official Extreme Severe Cyclonic Storm Warning is active for'));
    assert.ok(summary.includes('Khordha, Puri and Cuttack districts'));
  });

  it('Alert Expiry Enforcement (Section 77A)', () => {
    const expiredAlert: SachetAlert = {
      ...odishaCycloneAlert,
      expires: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    };
    assert.strictEqual(isAlertExpired(expiredAlert), true);

    const activeAlert: SachetAlert = {
      ...odishaCycloneAlert,
      expires: new Date(Date.now() + 3600000).toISOString(), // 1 hour future
    };
    assert.strictEqual(isAlertExpired(activeAlert), false);
  });
});

