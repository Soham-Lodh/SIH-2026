import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { translate } from '../../types/language';
import { LRUCache } from '../../lib/lruCache';
import { FuturePredictionDrawer } from './FuturePredictionDrawer';

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

// Instantiate the LRU Cache at module level to persist across navigation
const forecastCache = new LRUCache<number, FloodPrediction[]>(10, 5 * 60 * 1000); // capacity = 10, TTL = 5 mins

function formatMonthLabel(language: string, code: string, year: number): string {
  const monthNames: Record<string, Record<string, string>> = {
    en: { SEP: 'Sep', OCT: 'Oct', NOV: 'Nov', DEC: 'Dec', JAN: 'Jan', FEB: 'Feb', MAR: 'Mar', APR: 'Apr', MAY: 'May', JUN: 'Jun', JUL: 'Jul', AUG: 'Aug' },
    hi: { SEP: 'सितंबर', OCT: 'अक्टूबर', NOV: 'नवंबर', DEC: 'दिसंबर', JAN: 'जनवरी', FEB: 'फरवरी', MAR: 'मार्च', APR: 'अप्रैल', MAY: 'मई', JUN: 'जून', JUL: 'जुलाई', AUG: 'अगस्त' },
    bn: { SEP: 'সেপ্টেম্বর', OCT: 'অক্টোবর', NOV: 'নভেম্বর', DEC: 'ডিসেম্বর', JAN: 'জানুয়ারি', FEB: 'ফেব্রুয়ারি', MAR: 'মার্চ', APR: 'এপ্রিল', MAY: 'মে', JUN: 'জুন', JUL: 'জুলাই', AUG: 'আগস্ট' },
  };
  const name = monthNames[language]?.[code] || monthNames.en[code] || code;
  return `${name} ${year}`;
}

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
      setError(translate(currentLanguage, 'future.unavailable'));
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedPrediction(null);

    // Try retrieving from LRU Cache first
    const cached = forecastCache.get(monthNumber);
    if (cached) {
      setPredictions(cached);
      setLoading(false);
      return;
    }

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
            top_n: 30,
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

      forecastCache.put(monthNumber, data.predictions);
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
      const probability = prediction.flood_probability_percent;
      const isSelected = selectedPrediction?.rank === prediction.rank;
      const isHighRisk = probability >= 80;
      const isMediumRisk = probability >= 50 && probability < 80;

      const strokeColor = isSelected ? '#4f46e5' : '#0F1B29';
      const fillColor = isSelected ? '#e0e7ff' : '#EEF0F2';
      const ringClass = isSelected
        ? 'ring-4 ring-indigo-300 ring-offset-2'
        : 'ring-2 ring-slate-200';

      const iconHtml = `
        <div class="relative group cursor-pointer flex flex-col items-center">
          <div class="w-8 h-8 rounded-2xl bg-white shadow-md flex items-center justify-center ${ringClass} transition-transform hover:scale-110" style="border: 2px solid ${strokeColor};">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#0F1B29" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="filter drop-shadow-sm">
              <path d="M18.4 12A6 6 0 1 0 7.2 9H6a7 7 0 0 0-1 13.9" fill="#0F1B29" fill-opacity="0.1"/>
              <path d="M18.4 12A6 6 0 1 0 7.2 9H6a7 7 0 0 0-1 13.9M12 17l-2 3M16 17l-2 3M8 17l-2 3" stroke-width="2" />
            </svg>
          </div>
          <div class="mt-1.5 px-2 py-0.5 rounded-full text-[8px] font-extrabold tracking-tight whitespace-nowrap shadow-sm" style="background-color: ${fillColor}; border: 1.5px solid ${strokeColor}; color: ${strokeColor};">
            ${probability.toFixed(0)}% Risk
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-disaster-marker',
        iconSize: [34, 42],
        iconAnchor: [17, 21],
      });

      const marker = L.marker([prediction.latitude, prediction.longitude], { icon: customIcon });

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
          offset: [0, -12],
          className: 'leaflet-disaster-tooltip',
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
  }, [predictions, selectedPrediction]);

  // ============================================================
  // CLOSE DETAIL SIDEBAR
  // ============================================================

  const closePredictionPanel = () => {
    setSelectedPrediction(null);
  };

  return (
    <div className="w-full h-full bg-[#ECF8F8] text-[#0F1B29] flex flex-col md:flex-row font-sans select-none overflow-hidden animate-in fade-in duration-200">

      {/* ======================================================
          LEFT SIDEBAR - FORECAST TIMELINE
      ====================================================== */}

      <div className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-[#DDDDDD] flex flex-col p-4 md:p-6 md:overflow-hidden shrink-0 h-auto md:h-full z-30">

        <div className="flex flex-col flex-1 gap-4 md:gap-8 min-h-0 h-full">

          <div>
            <h2 className="text-[#0F1B29] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#747F8D]" />
              <span>{translate(currentLanguage, 'future.timelineTitle')}</span>
            </h2>

            <p className="text-[10px] text-[#747F8D] mt-0.5 font-semibold">
              {translate(currentLanguage, 'future.timelineSubtitle')}
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
                    {formatMonthLabel(currentLanguage, month.code, month.year)}
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
            LOADING
        ================================================== */}

        {loading && (
          <div className="absolute inset-0 z-25 pointer-events-none flex items-center justify-center">
            <div className="bg-white px-5 py-3 rounded-lg shadow-lg border border-[#DDDDDD]">
              <div className="flex items-center gap-3">

                <div className="w-4 h-4 border-2 border-[#0F1B29] border-t-transparent rounded-full animate-spin" />

                <span className="text-xs font-semibold">
                  {translate(currentLanguage, 'future.generating')}
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
                  {translate(currentLanguage, 'future.unavailable')}
                </p>

                <p className="text-[10px] text-[#747F8D] mt-1">
                  {error}
                </p>
              </div>

            </div>
          </div>
        )}

        {/* ==================================================
            SELECTED PREDICTION DRAWER
        ================================================== */}

        {selectedPrediction && (
          <FuturePredictionDrawer
            prediction={selectedPrediction}
            selectedMonthLabel={formatMonthLabel(currentLanguage, selectedMonth.code, selectedMonth.year)}
            onClose={closePredictionPanel}
            language={currentLanguage}
          />
        )}

      </div>
    </div>
  );
};

export default FuturePage;