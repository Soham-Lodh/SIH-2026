import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Calendar,
  X,
  MapPin,
  Activity,
  AlertCircle,
  Waves,
} from 'lucide-react';

interface FuturePageProps {
  currentLanguage: string;
}

interface FloodPrediction {
  rank: number;
  month: number;
  latitude: number;
  longitude: number;
  flood_probability: number;
  flood_probability_percent: number;
  peak_flood_level_m: number;
  warning_level: number;
  danger_level: number;
  historical_observations?: number;
}

interface FloodPredictionResponse {
  month: number;
  requested_top_n: number;
  returned_count: number;
  predictions: FloodPrediction[];
}

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

export const FuturePage: React.FC<FuturePageProps> = ({
  currentLanguage,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const markersLayerRef = useRef<L.LayerGroup | null>(null);

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

  const [selectedMonth, setSelectedMonth] = useState(
    monthsList[9]
  );

  const [predictions, setPredictions] = useState<FloodPrediction[]>([]);
  const [selectedPrediction, setSelectedPrediction] =
    useState<FloodPrediction | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mlApiUrl =
    import.meta.env.VITE_ML_API_BASE_URL ||
    'http://127.0.0.1:8000';

  // ============================================================
  // INITIALIZE MAP
  // ============================================================

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: true,
    });

    mapRef.current = map;

    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      }
    );

    satelliteLayer.addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      markersLayerRef.current?.clearLayers();
      markersLayerRef.current = null;

      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ============================================================
  // GET FLOOD PREDICTIONS FROM FASTAPI
  // ============================================================

  const handleRetrieveForecast = async (
    monthCode: string
  ) => {
    const monthNumber = MONTH_NUMBER[monthCode];

    if (!monthNumber) {
      setError('Invalid forecast month.');
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedPrediction(null);

    try {
      const response = await fetch(
        `${mlApiUrl}/predict`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            month: monthNumber,
            top_n: 15,
          }),
        }
      );

      if (!response.ok) {
        let message = `Prediction request failed (${response.status})`;

        try {
          const errorData = await response.json();

          if (errorData?.detail) {
            message = errorData.detail;
          }
        } catch {
          // Ignore JSON parsing error.
        }

        throw new Error(message);
      }

      const data: FloodPredictionResponse =
        await response.json();

      setPredictions(data.predictions);
    } catch (err) {
      console.error('ML forecast fetch failed:', err);

      setPredictions([]);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to retrieve flood predictions.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // SELECT MONTH
  // ============================================================

  const handleSelectMonth = (
    month: typeof monthsList[number]
  ) => {
    setSelectedMonth(month);

    handleRetrieveForecast(month.code);
  };

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    handleRetrieveForecast(selectedMonth.code);

    // Only on initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // RENDER PREDICTIONS ON MAP
  // ============================================================

  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;

    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    if (predictions.length === 0) {
      return;
    }

    predictions.forEach((prediction) => {
      const probability =
        prediction.flood_probability_percent;

      /*
       * Marker radius scales slightly with probability so that
       * higher-risk predicted locations stand out.
       */
      const radius = Math.max(
        7,
        Math.min(13, 7 + probability / 20)
      );

      const marker = L.circleMarker(
        [
          prediction.latitude,
          prediction.longitude,
        ],
        {
          radius,
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        }
      );

      marker.bindTooltip(
        `
          <div style="font-family: sans-serif;">
            <strong>#${prediction.rank}</strong>
            &nbsp; Flood probability:
            <strong>${probability.toFixed(2)}%</strong>
          </div>
        `,
        {
          direction: 'top',
          offset: [0, -8],
        }
      );

      marker.on('click', () => {
        setSelectedPrediction(prediction);

        map.flyTo(
          [
            prediction.latitude,
            prediction.longitude,
          ],
          Math.max(map.getZoom(), 7),
          {
            duration: 0.6,
          }
        );
      });

      marker.addTo(markersLayer);
    });
  }, [predictions]);

  // ============================================================
  // CLOSE DETAIL SIDEBAR
  // ============================================================

  const closePredictionPanel = () => {
    setSelectedPrediction(null);
  };

  return (
    <div className="w-full h-full bg-[#ECF8F8] text-[#0F1B29] flex flex-col md:flex-row font-sans select-none overflow-hidden">

      {/* ======================================================
          LEFT SIDEBAR - FORECAST TIMELINE
      ====================================================== */}

      <div className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-[#DDDDDD] flex flex-col p-4 md:p-6 md:overflow-hidden shrink-0 h-auto md:h-full z-30">

        <div className="flex flex-col flex-1 gap-4 md:gap-8 min-h-0 h-full">

          <div>
            <h2 className="text-[#0F1B29] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#747F8D]" />
              <span>Forecast Timeline</span>
            </h2>

            <p className="text-[10px] text-[#747F8D] mt-0.5">
              Select a forecast month to generate
              predicted flood locations.
            </p>
          </div>

          <div className="relative border-l-0 ml-0 md:ml-2 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible space-x-2 md:space-x-0 md:space-y-0 md:flex-1 md:justify-between py-1 md:py-6 md:pl-8 scrollbar-none min-h-0">

            <div className="hidden md:block absolute left-[15px] top-[34px] bottom-[34px] w-[2px] bg-[#DDDDDD]/60 z-0" />

            {monthsList.map((month) => {
              const isSelected =
                selectedMonth.code === month.code &&
                selectedMonth.year === month.year;

              return (
                <button
                  key={month.label}
                  type="button"
                  onClick={() =>
                    handleSelectMonth(month)
                  }
                  className={`
                    relative shrink-0 flex items-center justify-center md:justify-between
                    text-center md:text-left px-3 py-1.5 md:px-0 md:py-0 md:w-full
                    rounded-full md:rounded-none transition-all duration-200
                    outline-none cursor-pointer text-xs font-bold tracking-wide z-10
                    ${
                      isSelected
                        ? 'bg-[#0F1B29] text-white md:bg-transparent md:text-[#0F1B29]'
                        : 'bg-white text-[#747F8D] border border-[#DDDDDD] md:bg-transparent md:border-0 hover:text-[#0F1B29]'
                    }
                  `}
                >
                  <div className="hidden md:flex absolute -left-[25px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-[#DDDDDD] bg-white items-center justify-center z-10">

                    <div
                      className={`
                        w-2 h-2 rounded-full transition-all duration-300
                        ${
                          isSelected
                            ? 'bg-[#0F1B29] scale-110'
                            : 'bg-transparent'
                        }
                      `}
                    />
                  </div>

                  <span className="md:ml-3">
                    {month.label}
                  </span>

                  {isSelected && (
                    <div className="hidden md:block absolute left-0 right-0 h-7 bg-[#ECF8F8]/60 border-r-2 border-[#0F1B29] z-[-1] pointer-events-none rounded-l-md" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ======================================================
          MAP AREA
      ====================================================== */}

      <div className="flex-1 relative bg-[#ECF8F8] flex flex-col min-h-0">

        <div
          ref={mapContainerRef}
          className="absolute inset-0 z-10"
        />

        {/* ==================================================
            MAP HEADER
        ================================================== */}

        <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-sm border border-[#DDDDDD] rounded-lg shadow-sm px-4 py-3">

          <div className="flex items-center gap-2">

            <Waves className="w-4 h-4 text-[#0F1B29]" />

            <div>
              <p className="text-xs font-bold uppercase tracking-wider">
                Flood Risk Forecast
              </p>

              <p className="text-[10px] text-[#747F8D]">
                {selectedMonth.label}
              </p>
            </div>

          </div>

          <div className="mt-2 text-[10px] text-[#747F8D]">
            {loading
              ? 'Calculating predictions...'
              : `${predictions.length} high-risk locations predicted`}
          </div>
        </div>

        {/* ==================================================
            LOADING
        ================================================== */}

        {loading && (
          <div className="absolute inset-0 z-25 pointer-events-none flex items-center justify-center">
            <div className="bg-white px-5 py-3 rounded-lg shadow-lg border border-[#DDDDDD]">
              <div className="flex items-center gap-3">

                <div className="w-4 h-4 border-2 border-[#0F1B29] border-t-transparent rounded-full animate-spin" />

                <span className="text-xs font-semibold">
                  Generating flood predictions...
                </span>

              </div>
            </div>
          </div>
        )}

        {/* ==================================================
            ERROR
        ================================================== */}

        {error && !loading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-25 bg-white border border-red-200 shadow-lg rounded-lg px-4 py-3 max-w-md">

            <div className="flex gap-2 items-start">

              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />

              <div>
                <p className="text-xs font-bold">
                  Prediction unavailable
                </p>

                <p className="text-[10px] text-[#747F8D] mt-1">
                  {error}
                </p>
              </div>

            </div>
          </div>
        )}

        {/* ==================================================
            SELECTED PREDICTION SIDEBAR
        ================================================== */}

        {selectedPrediction && (
          <div className="absolute top-0 right-0 bottom-0 w-full sm:w-[370px] z-30 bg-white border-l border-[#DDDDDD] shadow-2xl flex flex-col">

            {/* Header */}

            <div className="p-5 border-b border-[#DDDDDD] flex items-start justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <MapPin className="w-4 h-4 text-[#0F1B29]" />

                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#747F8D]">
                    Predicted Flood Location
                  </span>

                </div>

                <h3 className="text-xl font-bold mt-2">
                  Rank #{selectedPrediction.rank}
                </h3>

                <p className="text-xs text-[#747F8D] mt-1">
                  {selectedMonth.label}
                </p>

              </div>

              <button
                type="button"
                onClick={closePredictionPanel}
                className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#ECF8F8] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

            </div>

            {/* Content */}

            <div className="p-5 overflow-y-auto flex-1">

              {/* Flood probability */}

              <div className="border border-[#DDDDDD] rounded-lg p-4">

                <div className="flex justify-between items-center">

                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    <span className="text-xs font-bold">
                      Flood Probability
                    </span>
                  </div>

                  <span className="text-2xl font-bold">
                    {selectedPrediction.flood_probability_percent.toFixed(
                      2
                    )}
                    %
                  </span>

                </div>

                <div className="mt-3 h-2 bg-[#ECF8F8] rounded-full overflow-hidden">

                  <div
                    className="h-full bg-[#0F1B29] rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        selectedPrediction.flood_probability_percent
                      )}%`,
                    }}
                  />

                </div>

                <p className="text-[10px] text-[#747F8D] mt-2">
                  Model-estimated probability that this
                  location belongs to the flood-observed
                  class for the selected month.
                </p>

              </div>

              {/* Coordinates */}

              <div className="mt-4">

                <p className="text-[10px] font-bold uppercase tracking-wider text-[#747F8D]">
                  Coordinates
                </p>

                <div className="grid grid-cols-2 gap-3 mt-2">

                  <div className="bg-[#ECF8F8] rounded-lg p-3">
                    <p className="text-[9px] text-[#747F8D]">
                      Latitude
                    </p>

                    <p className="text-sm font-bold mt-1">
                      {selectedPrediction.latitude.toFixed(
                        6
                      )}
                    </p>
                  </div>

                  <div className="bg-[#ECF8F8] rounded-lg p-3">
                    <p className="text-[9px] text-[#747F8D]">
                      Longitude
                    </p>

                    <p className="text-sm font-bold mt-1">
                      {selectedPrediction.longitude.toFixed(
                        6
                      )}
                    </p>
                  </div>

                </div>
              </div>

              {/* Severity */}

              <div className="mt-5">

                <p className="text-[10px] font-bold uppercase tracking-wider text-[#747F8D]">
                  Predicted Severity
                </p>

                <div className="space-y-2 mt-2">

                  <div className="flex items-center justify-between border border-[#DDDDDD] rounded-lg p-3">

                    <span className="text-xs">
                      Peak Flood Level
                    </span>

                    <span className="font-bold">
                      {selectedPrediction.peak_flood_level_m.toFixed(
                        2
                      )}{' '}
                      m
                    </span>

                  </div>

                  <div className="flex items-center justify-between border border-[#DDDDDD] rounded-lg p-3">

                    <span className="text-xs">
                      Warning Level
                    </span>

                    <span className="font-bold">
                      {selectedPrediction.warning_level.toFixed(
                        2
                      )}
                    </span>

                  </div>

                  <div className="flex items-center justify-between border border-[#DDDDDD] rounded-lg p-3">

                    <span className="text-xs">
                      Danger Level
                    </span>

                    <span className="font-bold">
                      {selectedPrediction.danger_level.toFixed(
                        2
                      )}
                    </span>

                  </div>

                </div>
              </div>

              {/* Historical observations */}

              {typeof selectedPrediction.historical_observations ===
                'number' && (
                <div className="mt-5">

                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#747F8D]">
                    Historical Evidence
                  </p>

                  <div className="mt-2 border border-[#DDDDDD] rounded-lg p-4">

                    <p className="text-2xl font-bold">
                      {selectedPrediction.historical_observations}
                    </p>

                    <p className="text-[10px] text-[#747F8D] mt-1">
                      Historical observations associated
                      with this candidate location.
                    </p>

                  </div>
                </div>
              )}

              {/* Model disclaimer */}

              <div className="mt-5 bg-[#ECF8F8] rounded-lg p-4">

                <p className="text-[10px] font-bold">
                  Model interpretation
                </p>

                <p className="text-[10px] leading-relaxed text-[#747F8D] mt-1">
                  The probability is the XGBoost model's
                  estimated probability for the flood-observed
                  class. It is a model score and should not be
                  interpreted as a guaranteed real-world
                  probability without probability calibration.
                </p>

              </div>

            </div>
          </div>
        )}

        {/* ==================================================
            POINT COUNT
        ================================================== */}

        {!selectedPrediction && !loading && predictions.length > 0 && (
          <div className="absolute bottom-5 left-5 z-20 bg-white/95 backdrop-blur-sm border border-[#DDDDDD] rounded-lg shadow-sm px-4 py-3">

            <div className="flex items-center gap-3">

              <div className="w-8 h-8 rounded-full bg-[#0F1B29] text-white flex items-center justify-center text-xs font-bold">
                {predictions.length}
              </div>

              <div>
                <p className="text-xs font-bold">
                  Predicted Locations
                </p>

                <p className="text-[10px] text-[#747F8D]">
                  Click any point for details
                </p>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default FuturePage;