import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  AlertCircle,
  Calendar,
  Layers,
  Mountain,
  Waves,
} from 'lucide-react';
import { translate } from '../../types/language';
import { LRUCache } from '../../lib/lruCache';
import { FuturePredictionDrawer } from './FuturePredictionDrawer';

interface FuturePageProps {
  currentLanguage: string;
}

// ============================================================
// TYPES
// ============================================================

interface BasePrediction {
  rank: number;
  month: number;
  latitude: number;
  longitude: number;
}

interface FloodPrediction extends BasePrediction {
  disaster_type: 'flood';

  flood_probability: number;
  flood_probability_percent: number;

  peak_flood_level_m: number;
  warning_level: number;
  danger_level: number;

  historical_observations?: number;
}

interface LandslidePrediction extends BasePrediction {
  disaster_type: 'landslide';

  landslide_probability: number;
  landslide_probability_percent: number;

  monthly_rainfall_mm?: number;
  rain_zscore?: number;

  prior_event_count?: number;
  prior_same_month_count?: number;

  events_last_3_years?: number;
  events_last_5_years?: number;

  years_since_last_event?: number;
}

type DisasterPrediction =
  | FloodPrediction
  | LandslidePrediction;

interface FloodPredictionResponse {
  disaster_type?: string;
  month: number;
  requested_top_n: number;
  returned_count: number;
  predictions?: unknown[];
}

interface LandslidePredictionResponse {
  disaster_type?: string;
  month: number;
  requested_top_n: number;
  returned_count: number;
  predictions?: unknown[];
}

interface CachedForecast {
  flood: FloodPrediction[];
  landslide: LandslidePrediction[];
}

// ============================================================
// MONTHS
// ============================================================

const MONTH_NUMBER: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const monthsList = [
  { code: 'SEP', year: 2026, label: 'SEP 2026' },
  { code: 'OCT', year: 2026, label: 'OCT 2026' },
  { code: 'NOV', year: 2026, label: 'NOV 2026' },
  { code: 'DEC', year: 2026, label: 'DEC 2026' },
  { code: 'JAN', year: 2027, label: 'JAN 2027' },
  { code: 'FEB', year: 2027, label: 'FEB 2027' },
  { code: 'MAR', year: 2027, label: 'MAR 2027' },
  { code: 'APR', year: 2027, label: 'APR 2027' },
  { code: 'MAY', year: 2027, label: 'MAY 2027' },
  { code: 'JUN', year: 2027, label: 'JUN 2027' },
  { code: 'JUL', year: 2027, label: 'JUL 2027' },
  { code: 'AUG', year: 2027, label: 'AUG 2027' },
];

// ============================================================
// CACHE
// ============================================================

const forecastCache = new LRUCache<number, CachedForecast>(
  10,
  5 * 60 * 1000
);

// ============================================================
// MONTH LABEL
// ============================================================

function formatMonthLabel(
  language: string,
  code: string,
  year: number
): string {
  const monthNames: Record<string, Record<string, string>> = {
    en: {
      SEP: 'Sep',
      OCT: 'Oct',
      NOV: 'Nov',
      DEC: 'Dec',
      JAN: 'Jan',
      FEB: 'Feb',
      MAR: 'Mar',
      APR: 'Apr',
      MAY: 'May',
      JUN: 'Jun',
      JUL: 'Jul',
      AUG: 'Aug',
    },

    hi: {
      SEP: 'सितंबर',
      OCT: 'अक्टूबर',
      NOV: 'नवंबर',
      DEC: 'दिसंबर',
      JAN: 'जनवरी',
      FEB: 'फरवरी',
      MAR: 'मार्च',
      APR: 'अप्रैल',
      MAY: 'मई',
      JUN: 'जून',
      JUL: 'जुलाई',
      AUG: 'अगस्त',
    },

    bn: {
      SEP: 'সেপ্টেম্বর',
      OCT: 'অক্টোবর',
      NOV: 'নভেম্বর',
      DEC: 'ডিসেম্বর',
      JAN: 'জানুয়ারি',
      FEB: 'ফেব্রুয়ারি',
      MAR: 'মার্চ',
      APR: 'এপ্রিল',
      MAY: 'মে',
      JUN: 'জুন',
      JUL: 'জুলাই',
      AUG: 'আগস্ট',
    },
  };

  const name =
    monthNames[language]?.[code] ||
    monthNames.en[code] ||
    code;

  return `${name} ${year}`;
}

// ============================================================
// NUMERIC NORMALIZATION
// ============================================================

function toFiniteNumber(
  value: unknown,
  fallback = 0
): number {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

// ============================================================
// FLOOD NORMALIZATION
// ============================================================

function normalizeFloodPrediction(
  raw: unknown
): FloodPrediction | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const item = raw as Record<string, unknown>;

  const latitude = toFiniteNumber(
    item.latitude,
    NaN
  );

  const longitude = toFiniteNumber(
    item.longitude,
    NaN
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const floodProbability = toFiniteNumber(
    item.flood_probability,
    NaN
  );

  const suppliedPercent = toFiniteNumber(
    item.flood_probability_percent,
    NaN
  );

  const floodProbabilityPercent =
    Number.isFinite(suppliedPercent)
      ? suppliedPercent
      : Number.isFinite(floodProbability)
        ? floodProbability * 100
        : 0;

  return {
    rank: Math.max(
      0,
      Math.trunc(
        toFiniteNumber(item.rank)
      )
    ),

    month: Math.max(
      1,
      Math.min(
        12,
        Math.trunc(
          toFiniteNumber(item.month)
        )
      )
    ),

    latitude,
    longitude,

    disaster_type: 'flood',

    flood_probability:
      Number.isFinite(floodProbability)
        ? floodProbability
        : floodProbabilityPercent / 100,

    flood_probability_percent:
      floodProbabilityPercent,

    peak_flood_level_m:
      toFiniteNumber(
        item.peak_flood_level_m
      ),

    warning_level:
      toFiniteNumber(
        item.warning_level
      ),

    danger_level:
      toFiniteNumber(
        item.danger_level
      ),

    historical_observations:
      item.historical_observations != null
        ? toFiniteNumber(
            item.historical_observations
          )
        : undefined,
  };
}

// ============================================================
// LANDSLIDE NORMALIZATION
// ============================================================

function normalizeLandslidePrediction(
  raw: unknown
): LandslidePrediction | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const item = raw as Record<string, unknown>;

  const latitude = toFiniteNumber(
    item.latitude,
    NaN
  );

  const longitude = toFiniteNumber(
    item.longitude,
    NaN
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const probability = toFiniteNumber(
    item.landslide_probability,
    NaN
  );

  const suppliedPercent = toFiniteNumber(
    item.landslide_probability_percent,
    NaN
  );

  const probabilityPercent =
    Number.isFinite(suppliedPercent)
      ? suppliedPercent
      : Number.isFinite(probability)
        ? probability * 100
        : 0;

  return {
    rank: Math.max(
      0,
      Math.trunc(
        toFiniteNumber(item.rank)
      )
    ),

    month: Math.max(
      1,
      Math.min(
        12,
        Math.trunc(
          toFiniteNumber(item.month)
        )
      )
    ),

    latitude,
    longitude,

    disaster_type: 'landslide',

    landslide_probability:
      Number.isFinite(probability)
        ? probability
        : probabilityPercent / 100,

    landslide_probability_percent:
      probabilityPercent,

    monthly_rainfall_mm:
      item.monthly_rainfall_mm != null
        ? toFiniteNumber(
            item.monthly_rainfall_mm
          )
        : undefined,

    rain_zscore:
      item.rain_zscore != null
        ? toFiniteNumber(
            item.rain_zscore
          )
        : undefined,

    prior_event_count:
      item.prior_event_count != null
        ? toFiniteNumber(
            item.prior_event_count
          )
        : undefined,

    prior_same_month_count:
      item.prior_same_month_count != null
        ? toFiniteNumber(
            item.prior_same_month_count
          )
        : undefined,

    events_last_3_years:
      item.events_last_3_years != null
        ? toFiniteNumber(
            item.events_last_3_years
          )
        : undefined,

    events_last_5_years:
      item.events_last_5_years != null
        ? toFiniteNumber(
            item.events_last_5_years
          )
        : undefined,

    years_since_last_event:
      item.years_since_last_event != null
        ? toFiniteNumber(
            item.years_since_last_event
          )
        : undefined,
  };
}

// ============================================================
// DISASTER PROBABILITY
// ============================================================

function getProbability(
  prediction: DisasterPrediction
): number {
  if (
    prediction.disaster_type ===
    'flood'
  ) {
    return toFiniteNumber(
      prediction.flood_probability_percent
    );
  }

  return toFiniteNumber(
    prediction.landslide_probability_percent
  );
}

// ============================================================
// DISASTER NAME
// ============================================================

function getDisasterName(
  prediction: DisasterPrediction
): string {
  return prediction.disaster_type ===
    'flood'
    ? 'FLOOD'
    : 'LANDSLIDE';
}

// ============================================================
// MARKER ICON
// ============================================================

function createDisasterIcon(
  type: DisasterPrediction['disaster_type']
): string {
  if (type === 'flood') {
    return `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="#0F1B29"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 12h18" />
        <path d="M5 16c2 2 4 2 6 0s4-2 6 0 4 2 6 0" />
        <path d="M5 8c2 2 4 2 6 0s4-2 6 0 4 2 6 0" />
      </svg>
    `;
  }

  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="#0F1B29"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="m3 20 7-9 4 5 3-4 4 8" />
      <path d="M14 11 16 8l2 3" />
    </svg>
  `;
}

// ============================================================
// COMPONENT
// ============================================================

export const FuturePage: React.FC<
  FuturePageProps
> = ({ currentLanguage }) => {
  const mapContainerRef =
    useRef<HTMLDivElement>(null);

  const mapRef =
    useRef<L.Map | null>(null);

  const markersLayerRef =
    useRef<L.LayerGroup | null>(null);

  const requestSequenceRef =
    useRef(0);

  const [selectedMonth, setSelectedMonth] =
    useState(monthsList[9]);

  const [predictions, setPredictions] =
    useState<DisasterPrediction[]>([]);

  const [
    selectedPrediction,
    setSelectedPrediction,
  ] = useState<DisasterPrediction | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [floodCount, setFloodCount] =
    useState(0);

  const [
    landslideCount,
    setLandslideCount,
  ] = useState(0);

  const mlApiUrl =
    import.meta.env.VITE_ML_API_BASE_URL ||
    'https://sih-2026-kg5u.onrender.com';

  // ==========================================================
  // INITIALIZE MAP
  // ==========================================================

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    const map = L.map(
      mapContainerRef.current,
      {
        center: [
          20.5937,
          78.9629,
        ],
        zoom: 5,
        zoomControl: true,
      }
    );

    mapRef.current = map;

    const satelliteLayer =
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution:
            'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        }
      );

    satelliteLayer.addTo(map);

    markersLayerRef.current =
      L.layerGroup().addTo(map);

    return () => {
      markersLayerRef.current?.clearLayers();
      markersLayerRef.current = null;

      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ==========================================================
  // GENERIC API REQUEST
  // ==========================================================

  const requestPredictions =
    useCallback(
      async <T,>(
        endpoint: string,
        monthNumber: number
      ): Promise<T> => {
        const response =
          await fetch(
            `${mlApiUrl}${endpoint}`,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                month: monthNumber,
                top_n: 30,
              }),
            }
          );

        if (!response.ok) {
          let message =
            `${endpoint} failed (${response.status})`;

          try {
            const errorData =
              await response.json();

            if (
              errorData?.detail
            ) {
              message = String(
                errorData.detail
              );
            }
          } catch {
            // Ignore invalid response body.
          }

          throw new Error(message);
        }

        return response.json() as Promise<T>;
      },
      [mlApiUrl]
    );

  // ==========================================================
  // LOAD FORECAST
  // ==========================================================

  const handleRetrieveForecast =
    useCallback(
      async (monthCode: string) => {
        const monthNumber =
          MONTH_NUMBER[monthCode];

        if (!monthNumber) {
          setError(
            translate(
              currentLanguage,
              'future.unavailable'
            )
          );

          return;
        }

        const requestId =
          ++requestSequenceRef.current;

        setLoading(true);
        setError(null);
        setSelectedPrediction(null);

        // ----------------------------------------------------
        // CACHE
        // ----------------------------------------------------

        const cached =
          forecastCache.get(
            monthNumber
          );

        if (cached) {
          if (
            requestId !==
            requestSequenceRef.current
          ) {
            return;
          }

          setPredictions([
            ...cached.flood,
            ...cached.landslide,
          ]);

          setFloodCount(
            cached.flood.length
          );

          setLandslideCount(
            cached.landslide.length
          );

          setLoading(false);

          return;
        }

        // ----------------------------------------------------
        // START BOTH REQUESTS INDEPENDENTLY
        // ----------------------------------------------------

        const floodPromise =
          requestPredictions<FloodPredictionResponse>(
            '/predict/floods',
            monthNumber
          );

        const landslidePromise =
          requestPredictions<LandslidePredictionResponse>(
            '/predict/landslides',
            monthNumber
          );

        const [
          floodResult,
          landslideResult,
        ] = await Promise.allSettled([
          floodPromise,
          landslidePromise,
        ]);

        if (
          requestId !==
          requestSequenceRef.current
        ) {
          return;
        }

        // ----------------------------------------------------
        // NORMALIZE FLOOD
        // ----------------------------------------------------

        let floodPredictions:
          FloodPrediction[] = [];

        if (
          floodResult.status ===
          'fulfilled'
        ) {
          floodPredictions =
            (
              floodResult.value
                ?.predictions ?? []
            )
              .map(
                normalizeFloodPrediction
              )
              .filter(
                (
                  item
                ): item is FloodPrediction =>
                  item !== null
              )
              // ------------------------------------------------
              // HARD UI RULE:
              // NEVER DISPLAY FLOOD RISK < 50%.
              // ------------------------------------------------
              .filter(
                (item) =>
                  item.flood_probability_percent >=
                  50
              )
              // ------------------------------------------------
              // SORT AGAIN IN FRONTEND AS SAFETY.
              // Highest probability first.
              // ------------------------------------------------
              .sort(
                (
                  a,
                  b
                ) =>
                  b.flood_probability_percent -
                  a.flood_probability_percent
              )
              // ------------------------------------------------
              // Reassign rank after filtering.
              // ------------------------------------------------
              .map(
                (item, index) => ({
                  ...item,
                  rank:
                    index + 1,
                })
              );
        }

        // ----------------------------------------------------
        // NORMALIZE LANDSLIDE
        // ----------------------------------------------------

        let landslidePredictions:
          LandslidePrediction[] = [];

        if (
          landslideResult.status ===
          'fulfilled'
        ) {
          landslidePredictions =
            (
              landslideResult.value
                ?.predictions ?? []
            )
              .map(
                normalizeLandslidePrediction
              )
              .filter(
                (
                  item
                ): item is LandslidePrediction =>
                  item !== null
              )
              .sort(
                (
                  a,
                  b
                ) =>
                  b.landslide_probability_percent -
                  a.landslide_probability_percent
              )
              .map(
                (item, index) => ({
                  ...item,
                  rank:
                    index + 1,
                })
              );
        }

        // ----------------------------------------------------
        // ERRORS
        // ----------------------------------------------------

        const errors: string[] = [];

        if (
          floodResult.status ===
          'rejected'
        ) {
          errors.push(
            floodResult.reason instanceof
              Error
              ? `Flood: ${floodResult.reason.message}`
              : 'Flood prediction failed.'
          );
        }

        if (
          landslideResult.status ===
          'rejected'
        ) {
          errors.push(
            landslideResult.reason instanceof
              Error
              ? `Landslide: ${landslideResult.reason.message}`
              : 'Landslide prediction failed.'
          );
        }

        // ----------------------------------------------------
        // CACHE
        // ----------------------------------------------------

        const cacheValue: CachedForecast = {
          flood: floodPredictions,
          landslide:
            landslidePredictions,
        };

        forecastCache.put(
          monthNumber,
          cacheValue
        );

        // ----------------------------------------------------
        // MAP
        // ----------------------------------------------------

        setPredictions([
          ...floodPredictions,
          ...landslidePredictions,
        ]);

        setFloodCount(
          floodPredictions.length
        );

        setLandslideCount(
          landslidePredictions.length
        );

        if (errors.length > 0) {
          setError(
            errors.join(' | ')
          );
        }

        setLoading(false);
      },
      [
        currentLanguage,
        requestPredictions,
      ]
    );

  // ==========================================================
  // SELECT MONTH
  // ==========================================================

  const handleSelectMonth = (
    month: typeof monthsList[number]
  ) => {
    setSelectedMonth(month);

    void handleRetrieveForecast(
      month.code
    );
  };

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    void handleRetrieveForecast(
      selectedMonth.code
    );

    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================================
  // DRAW MARKERS
  // ==========================================================

  useEffect(() => {
    const map = mapRef.current;

    const markersLayer =
      markersLayerRef.current;

    if (!map || !markersLayer) {
      return;
    }

    markersLayer.clearLayers();

    if (!predictions.length) {
      return;
    }

    predictions.forEach(
      (prediction) => {
        const probability =
          getProbability(
            prediction
          );

        const disasterName =
          getDisasterName(
            prediction
          );

        const isSelected =
          selectedPrediction ===
          prediction;

        const strokeColor =
          isSelected
            ? '#4f46e5'
            : '#0F1B29';

        const fillColor =
          isSelected
            ? '#e0e7ff'
            : '#EEF0F2';

        const ringClass =
          isSelected
            ? 'ring-4 ring-indigo-300 ring-offset-2'
            : 'ring-2 ring-slate-200';

        const iconHtml = `
          <div
            class="relative group cursor-pointer flex flex-col items-center"
          >
            <div
              class="w-8 h-8 rounded-2xl bg-white shadow-md flex items-center justify-center ${ringClass} transition-transform hover:scale-110"
              style="
                border: 2px solid ${strokeColor};
              "
            >
              ${createDisasterIcon(
                prediction.disaster_type
              )}
            </div>

            <div
              class="mt-1.5 px-2 py-0.5 rounded-full text-[8px] font-extrabold tracking-tight whitespace-nowrap shadow-sm"
              style="
                background-color: ${fillColor};
                border: 1.5px solid ${strokeColor};
                color: ${strokeColor};
              "
            >
              ${disasterName}
            </div>
          </div>
        `;

        const customIcon =
          L.divIcon({
            html: iconHtml,

            className:
              'custom-disaster-marker',

            iconSize: [
              70,
              52,
            ],

            iconAnchor: [
              35,
              22,
            ],
          });

        const marker =
          L.marker(
            [
              prediction.latitude,
              prediction.longitude,
            ],
            {
              icon: customIcon,
            }
          );

        marker.bindTooltip(
          `
            <div
              style="
                font-family: sans-serif;
                min-width: 120px;
                line-height: 1.5;
              "
            >
              <strong>
                ${disasterName}
              </strong>

              <br />

              Rank:
              <strong>
                #${prediction.rank}
              </strong>

              <br />

              Risk:
              <strong>
                ${probability.toFixed(2)}%
              </strong>
            </div>
          `,
          {
            direction: 'top',
            offset: [0, -12],
            className:
              'leaflet-disaster-tooltip',
          }
        );

        marker.on(
          'click',
          () => {
            setSelectedPrediction(
              prediction
            );

            map.flyTo(
              [
                prediction.latitude,
                prediction.longitude,
              ],
              Math.max(
                map.getZoom(),
                7
              ),
              {
                duration: 0.6,
              }
            );
          }
        );

        marker.addTo(
          markersLayer
        );
      }
    );
  }, [
    predictions,
    selectedPrediction,
  ]);

  // ==========================================================
  // CLOSE DRAWER
  // ==========================================================

  const closePredictionPanel = () => {
    setSelectedPrediction(
      null
    );
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      className="
        w-full
        h-full
        bg-[#ECF8F8]
        text-[#0F1B29]
        flex
        flex-col
        md:flex-row
        font-sans
        select-none
        overflow-hidden
        animate-in
        fade-in
        duration-200
      "
    >

      {/* ======================================================
          LEFT TIMELINE
      ====================================================== */}

      <div
        className="
          w-full
          md:w-80
          bg-white
          border-b
          md:border-b-0
          md:border-r
          border-[#DDDDDD]
          flex
          flex-col
          p-4
          md:p-6
          md:overflow-hidden
          shrink-0
          h-auto
          md:h-full
          z-30
        "
      >

        <div
          className="
            flex
            flex-col
            flex-1
            gap-4
            md:gap-8
            min-h-0
            h-full
          "
        >

          <div>
            <h2
              className="
                text-[#0F1B29]
                font-bold
                text-xs
                uppercase
                tracking-wider
                flex
                items-center
                gap-1.5
              "
            >
              <Calendar
                className="
                  w-4
                  h-4
                  text-[#747F8D]
                "
              />

              <span>
                {translate(
                  currentLanguage,
                  'future.timelineTitle'
                )}
              </span>
            </h2>

            <p
              className="
                text-[10px]
                text-[#747F8D]
                mt-0.5
                font-semibold
              "
            >
              {translate(
                currentLanguage,
                'future.timelineSubtitle'
              )}
            </p>
          </div>


          <div
            className="
              relative
              border-l-0
              ml-0
              md:ml-2
              flex
              flex-row
              md:flex-col
              overflow-x-auto
              md:overflow-x-visible
              space-x-2
              md:space-x-0
              md:space-y-0
              md:flex-1
              md:justify-between
              py-1
              md:py-6
              md:pl-8
              scrollbar-none
              min-h-0
            "
          >

            <div
              className="
                hidden
                md:block
                absolute
                left-[15px]
                top-[34px]
                bottom-[34px]
                w-[2px]
                bg-[#DDDDDD]/60
                z-0
              "
            />

            {monthsList.map(
              (month) => {

                const isSelected =
                  selectedMonth.code ===
                    month.code &&
                  selectedMonth.year ===
                    month.year;

                return (
                  <button
                    key={
                      month.label
                    }
                    type="button"
                    onClick={() =>
                      handleSelectMonth(
                        month
                      )
                    }
                    className={`
                      relative
                      shrink-0
                      flex
                      items-center
                      justify-center
                      md:justify-between
                      text-center
                      md:text-left
                      px-3
                      py-1.5
                      md:px-0
                      md:py-0
                      md:w-full
                      rounded-full
                      md:rounded-none
                      transition-all
                      duration-200
                      outline-none
                      cursor-pointer
                      text-xs
                      font-bold
                      tracking-wide
                      z-10
                      ${
                        isSelected
                          ? 'bg-[#0F1B29] text-white md:bg-transparent md:text-[#0F1B29]'
                          : 'bg-white text-[#747F8D] border border-[#DDDDDD] md:bg-transparent md:border-0 hover:text-[#0F1B29]'
                      }
                    `}
                  >

                    <div
                      className="
                        hidden
                        md:flex
                        absolute
                        -left-[25px]
                        top-1/2
                        -translate-y-1/2
                        w-4
                        h-4
                        rounded-full
                        border-2
                        border-[#DDDDDD]
                        bg-white
                        items-center
                        justify-center
                        z-10
                      "
                    >

                      <div
                        className={`
                          w-2
                          h-2
                          rounded-full
                          transition-all
                          duration-300
                          ${
                            isSelected
                              ? 'bg-[#0F1B29] scale-110'
                              : 'bg-transparent'
                          }
                        `}
                      />

                    </div>


                    <span
                      className="md:ml-3"
                    >
                      {formatMonthLabel(
                        currentLanguage,
                        month.code,
                        month.year
                      )}
                    </span>


                    {isSelected && (
                      <div
                        className="
                          hidden
                          md:block
                          absolute
                          left-0
                          right-0
                          h-7
                          bg-[#ECF8F8]/60
                          border-r-2
                          border-[#0F1B29]
                          z-[-1]
                          pointer-events-none
                          rounded-l-md
                        "
                      />
                    )}

                  </button>
                );
              }
            )}

          </div>
        </div>
      </div>


      {/* ======================================================
          MAP
      ====================================================== */}

      <div
        className="
          flex-1
          relative
          bg-[#ECF8F8]
          flex
          flex-col
          min-h-0
        "
      >

        <div
          ref={mapContainerRef}
          className="
            absolute
            inset-0
            z-10
          "
        />


        {/* ==================================================
            MAP STATUS / LEGEND
        ================================================== */}

        {!loading &&
          (floodCount > 0 ||
            landslideCount > 0) && (
            <div
              className="
                absolute
                bottom-5
                right-5
                z-20
                bg-white/95
                border
                border-[#DDDDDD]
                shadow-lg
                rounded-xl
                px-3
                py-2
                flex
                items-center
                gap-3
              "
            >

              <Layers
                className="
                  w-3.5
                  h-3.5
                  text-[#747F8D]
                "
              />

              {floodCount > 0 && (
                <div
                  className="
                    flex
                    items-center
                    gap-1.5
                  "
                >
                  <Waves
                    className="
                      w-3.5
                      h-3.5
                      text-[#0F1B29]
                    "
                  />

                  <span
                    className="
                      text-[9px]
                      font-extrabold
                      tracking-wide
                      text-[#0F1B29]
                    "
                  >
                    FLOOD
                  </span>

                  <span
                    className="
                      text-[9px]
                      text-[#747F8D]
                      font-bold
                    "
                  >
                    {floodCount}
                  </span>
                </div>
              )}

              {floodCount > 0 &&
                landslideCount > 0 && (
                  <div
                    className="
                      h-4
                      w-px
                      bg-[#DDDDDD]
                    "
                  />
                )}

              {landslideCount > 0 && (
                <div
                  className="
                    flex
                    items-center
                    gap-1.5
                  "
                >
                  <Mountain
                    className="
                      w-3.5
                      h-3.5
                      text-[#0F1B29]
                    "
                  />

                  <span
                    className="
                      text-[9px]
                      font-extrabold
                      tracking-wide
                      text-[#0F1B29]
                    "
                  >
                    LANDSLIDE
                  </span>

                  <span
                    className="
                      text-[9px]
                      text-[#747F8D]
                      font-bold
                    "
                  >
                    {landslideCount}
                  </span>
                </div>
              )}

            </div>
          )}


        {/* ==================================================
            LOADING
        ================================================== */}

        {loading && (
          <div
            className="
              absolute
              inset-0
              z-25
              pointer-events-none
              flex
              items-center
              justify-center
            "
          >

            <div
              className="
                bg-white
                px-5
                py-3
                rounded-lg
                shadow-lg
                border
                border-[#DDDDDD]
              "
            >

              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >

                <div
                  className="
                    w-4
                    h-4
                    border-2
                    border-[#0F1B29]
                    border-t-transparent
                    rounded-full
                    animate-spin
                  "
                />

                <span
                  className="
                    text-xs
                    font-semibold
                  "
                >
                  {translate(
                    currentLanguage,
                    'future.generating'
                  )}
                </span>

              </div>

            </div>
          </div>
        )}


        {/* ==================================================
            ERROR
        ================================================== */}

        {error && !loading && (
          <div
            className="
              absolute
              top-4
              left-1/2
              -translate-x-1/2
              z-25
              bg-white
              border
              border-red-200
              shadow-lg
              rounded-lg
              px-4
              py-3
              max-w-xl
            "
          >

            <div
              className="
                flex
                gap-2
                items-start
              "
            >

              <AlertCircle
                className="
                  w-4
                  h-4
                  text-red-600
                  shrink-0
                  mt-0.5
                "
              />

              <div>

                <p
                  className="
                    text-xs
                    font-bold
                  "
                >
                  {translate(
                    currentLanguage,
                    'future.unavailable'
                  )}
                </p>

                <p
                  className="
                    text-[10px]
                    text-[#747F8D]
                    mt-1
                  "
                >
                  {error}
                </p>

              </div>

            </div>

          </div>
        )}


        {/* ==================================================
            DRAWER
        ================================================== */}

        {selectedPrediction && (
          <FuturePredictionDrawer
            prediction={
              selectedPrediction
            }

            selectedMonthLabel={
              formatMonthLabel(
                currentLanguage,
                selectedMonth.code,
                selectedMonth.year
              )
            }

            onClose={
              closePredictionPanel
            }

            language={
              currentLanguage
            }
          />
        )}

      </div>
    </div>
  );
};

export default FuturePage;