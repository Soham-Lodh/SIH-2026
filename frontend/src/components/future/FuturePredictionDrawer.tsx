import React from 'react';
import {
  Activity,
  Calendar,
  CloudRain,
  Compass,
  History,
  Info,
  MapPin,
  Mountain,
  TrendingUp,
  Waves,
  X,
} from 'lucide-react';
import { translate } from '../../types/language';

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

interface FuturePredictionDrawerProps {
  prediction:
    | DisasterPrediction
    | null;

  selectedMonthLabel: string;

  onClose: () => void;

  language: string;
}

// ============================================================
// SAFE NUMBER
// ============================================================

function safeNumber(
  value: unknown,
  fallback = 0
): number {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

// ============================================================
// COMPONENT
// ============================================================

export const FuturePredictionDrawer: React.FC<
  FuturePredictionDrawerProps
> = ({
  prediction,
  selectedMonthLabel,
  onClose,
  language,
}) => {
  if (!prediction) {
    return null;
  }

  const isFlood =
    prediction.disaster_type ===
    'flood';

  const disasterName =
    isFlood
      ? 'FLOOD'
      : 'LANDSLIDE';

  const probability =
    isFlood
      ? safeNumber(
          prediction.flood_probability_percent
        )
      : safeNumber(
          prediction.landslide_probability_percent
        );

  const isHighRisk =
    probability >= 80;

  const isMediumRisk =
    probability >= 50 &&
    probability < 80;

  const riskColorClass =
    isHighRisk
      ? 'text-rose-600 bg-rose-50 border-rose-100 ring-rose-200'
      : isMediumRisk
        ? 'text-amber-700 bg-amber-50 border-amber-100 ring-amber-200'
        : 'text-emerald-700 bg-emerald-50 border-emerald-100 ring-emerald-200';

  const riskLabelKey =
    isHighRisk
      ? 'future.highRisk'
      : isMediumRisk
        ? 'future.mediumRisk'
        : 'future.lowRisk';

  const disasterIcon =
    isFlood
      ? (
        <Waves className="w-5 h-5" />
      )
      : (
        <Mountain className="w-5 h-5" />
      );

  return (
    <div
      className="
        fixed
        inset-y-0
        right-0
        z-50
        w-full
        sm:w-[480px]
        bg-white
        border-l
        border-slate-200
        shadow-2xl
        flex
        flex-col
        overflow-hidden
        animate-in
        slide-in-from-right
        duration-200
      "
    >

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div
        className="
          p-4
          sm:p-5
          border-b
          border-slate-200
          flex
          items-center
          justify-between
          bg-slate-50
        "
      >

        <div
          className="
            flex
            items-center
            gap-2.5
            min-w-0
          "
        >

          <div
            className={`
              w-9
              h-9
              rounded-xl
              border
              flex
              items-center
              justify-center
              shrink-0
              ${
                isHighRisk
                  ? 'bg-rose-50 border-rose-100 text-rose-600'
                  : 'bg-indigo-50 border-indigo-100 text-indigo-600'
              }
            `}
          >
            {disasterIcon}
          </div>


          <div
            className="
              min-w-0
            "
          >

            <h3
              className="
                font-bold
                text-sm
                sm:text-base
                text-slate-900
                truncate
              "
            >
              {disasterName}
            </h3>


            <p
              className="
                text-[10px]
                text-slate-500
                flex
                items-center
                gap-1
                mt-0.5
                font-semibold
              "
            >

              <Calendar
                className="
                  w-3
                  h-3
                  text-slate-400
                "
              />

              <span>
                {selectedMonthLabel}
              </span>

              <span
                className="
                  text-slate-300
                "
              >
                •
              </span>

              <span>
                Rank #{prediction.rank}
              </span>

            </p>

          </div>

        </div>


        <button
          type="button"
          onClick={onClose}
          className="
            p-2
            rounded-xl
            bg-white
            hover:bg-slate-100
            text-slate-700
            border
            border-slate-200
            transition-colors
            shadow-xs
            cursor-pointer
          "
          aria-label="Close prediction details"
        >
          <X className="w-4 h-4" />
        </button>

      </div>


      {/* ======================================================
          CONTENT
      ====================================================== */}

      <div
        className="
          flex-1
          overflow-y-auto
          p-4
          sm:p-5
          space-y-5
        "
      >

        {/* ====================================================
            DISASTER TYPE
        ==================================================== */}

        <div
          className="
            flex
            items-center
            justify-between
            border
            border-slate-200
            rounded-xl
            px-4
            py-3
            bg-white
          "
        >

          <div
            className="
              flex
              items-center
              gap-2
            "
          >

            <MapPin
              className="
                w-4
                h-4
                text-slate-500
              "
            />

            <span
              className="
                text-xs
                font-bold
                text-slate-800
              "
            >
              Predicted disaster
            </span>

          </div>


          <span
            className="
              px-2.5
              py-1
              rounded-full
              bg-slate-900
              text-white
              text-[9px]
              font-extrabold
              tracking-wider
            "
          >
            {disasterName}
          </span>

        </div>


        {/* ====================================================
            RISK CARD
        ==================================================== */}

        <div
          className="
            p-4
            rounded-2xl
            bg-slate-50
            border
            border-slate-200
            space-y-3
          "
        >

          <div
            className="
              flex
              justify-between
              items-center
            "
          >

            <div
              className="
                flex
                items-center
                gap-2
              "
            >

              <Activity
                className="
                  w-4
                  h-4
                  text-slate-500
                "
              />

              <span
                className="
                  text-xs
                  font-bold
                  text-slate-800
                "
              >
                {translate(
                  language,
                  'future.probability'
                )}
              </span>

            </div>


            <div
              className={`
                px-2.5
                py-0.5
                rounded-full
                border
                text-[10px]
                font-bold
                ring-2
                ring-offset-1
                ${riskColorClass}
              `}
            >
              {translate(
                language,
                riskLabelKey
              )}
            </div>

          </div>


          <div
            className="
              flex
              items-baseline
              gap-1
              pt-1
            "
          >

            <span
              className="
                text-3xl
                font-extrabold
                tracking-tight
                text-slate-900
              "
            >
              {probability.toFixed(2)}%
            </span>

          </div>


          <div
            className="
              h-2.5
              bg-slate-200
              rounded-full
              overflow-hidden
            "
          >

            <div
              className={`
                h-full
                rounded-full
                transition-all
                duration-500
                ${
                  isHighRisk
                    ? 'bg-rose-600'
                    : isMediumRisk
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }
              `}
              style={{
                width: `${Math.min(
                  Math.max(
                    probability,
                    0
                  ),
                  100
                )}%`,
              }}
            />

          </div>


          <p
            className="
              text-[10px]
              leading-relaxed
              text-slate-500
            "
          >
            {translate(
              language,
              'future.probabilityDesc'
            )}
          </p>

        </div>


        {/* ====================================================
            COORDINATES
        ==================================================== */}

        <div
          className="
            space-y-2
          "
        >

          <div
            className="
              text-xs
              font-bold
              text-slate-900
              uppercase
              tracking-wider
              flex
              items-center
              gap-1
            "
          >

            <Compass
              className="
                w-3.5
                h-3.5
                text-slate-500
              "
            />

            <span>
              {translate(
                language,
                'future.coordinates'
              )}
            </span>

          </div>


          <div
            className="
              grid
              grid-cols-2
              gap-3
            "
          >

            <div
              className="
                bg-slate-50
                border
                border-slate-200
                rounded-xl
                p-3
              "
            >

              <span
                className="
                  text-[10px]
                  text-slate-500
                  uppercase
                  font-bold
                "
              >
                {translate(
                  language,
                  'future.latitude'
                )}
              </span>

              <div
                className="
                  text-sm
                  font-mono
                  font-bold
                  text-slate-900
                  mt-1
                "
              >
                {safeNumber(
                  prediction.latitude
                ).toFixed(6)}
              </div>

            </div>


            <div
              className="
                bg-slate-50
                border
                border-slate-200
                rounded-xl
                p-3
              "
            >

              <span
                className="
                  text-[10px]
                  text-slate-500
                  uppercase
                  font-bold
                "
              >
                {translate(
                  language,
                  'future.longitude'
                )}
              </span>

              <div
                className="
                  text-sm
                  font-mono
                  font-bold
                  text-slate-900
                  mt-1
                "
              >
                {safeNumber(
                  prediction.longitude
                ).toFixed(6)}
              </div>

            </div>

          </div>

        </div>


        {/* ====================================================
            FLOOD DETAILS
        ==================================================== */}

        {isFlood && (
          <div
            className="
              space-y-2
            "
          >

            <div
              className="
                text-xs
                font-bold
                text-slate-900
                uppercase
                tracking-wider
                flex
                items-center
                gap-1
              "
            >

              <TrendingUp
                className="
                  w-3.5
                  h-3.5
                  text-slate-500
                "
              />

              <span>
                {translate(
                  language,
                  'future.severityTitle'
                )}
              </span>

            </div>


            <div
              className="
                space-y-2.5
              "
            >

              {/* Peak flood level */}

              <div
                className="
                  flex
                  items-center
                  justify-between
                  border
                  border-slate-200
                  rounded-xl
                  p-3.5
                  bg-slate-50
                "
              >

                <div>

                  <span
                    className="
                      text-xs
                      font-bold
                      text-slate-800
                    "
                  >
                    {translate(
                      language,
                      'future.peakLevel'
                    )}
                  </span>

                  <div
                    className="
                      text-[9px]
                      font-semibold
                      text-slate-500
                      mt-0.5
                    "
                  >
                    Estimated peak river water level
                  </div>

                </div>


                <span
                  className="
                    font-mono
                    font-extrabold
                    text-base
                    text-slate-900
                  "
                >
                  {safeNumber(
                    prediction.peak_flood_level_m
                  ).toFixed(2)}{' '}
                  m
                </span>

              </div>


              {/* Warning level */}

              <div
                className="
                  flex
                  items-center
                  justify-between
                  border
                  border-slate-200
                  rounded-xl
                  p-3
                  bg-white
                "
              >

                <div>

                  <span
                    className="
                      text-xs
                      font-bold
                      text-slate-700
                    "
                  >
                    {translate(
                      language,
                      'future.warningLevel'
                    )}
                  </span>

                  <div
                    className="
                      text-[9px]
                      text-slate-400
                      mt-0.5
                    "
                  >
                    Warning threshold
                  </div>

                </div>


                <span
                  className="
                    font-mono
                    font-extrabold
                    text-sm
                    text-slate-800
                  "
                >
                  {safeNumber(
                    prediction.warning_level
                  ).toFixed(2)}{' '}
                  m
                </span>

              </div>


              {/* Danger level */}

              <div
                className="
                  flex
                  items-center
                  justify-between
                  border
                  border-slate-200
                  rounded-xl
                  p-3
                  bg-white
                "
              >

                <div>

                  <span
                    className="
                      text-xs
                      font-bold
                      text-slate-700
                    "
                  >
                    {translate(
                      language,
                      'future.dangerLevel'
                    )}
                  </span>

                  <div
                    className="
                      text-[9px]
                      text-slate-400
                      mt-0.5
                    "
                  >
                    Critical danger threshold
                  </div>

                </div>


                <span
                  className="
                    font-mono
                    font-extrabold
                    text-sm
                    text-slate-800
                  "
                >
                  {safeNumber(
                    prediction.danger_level
                  ).toFixed(2)}{' '}
                  m
                </span>

              </div>

            </div>

          </div>
        )}


        {/* ====================================================
            LANDSLIDE DETAILS
        ==================================================== */}

        {!isFlood && (
          <>
            {/* ------------------------------------------------
                RAINFALL
            ------------------------------------------------ */}

            <div
              className="
                space-y-2
              "
            >

              <div
                className="
                  text-xs
                  font-bold
                  text-slate-900
                  uppercase
                  tracking-wider
                  flex
                  items-center
                  gap-1
                "
              >

                <CloudRain
                  className="
                    w-3.5
                    h-3.5
                    text-slate-500
                  "
                />

                <span>
                  Rainfall indicators
                </span>

              </div>


              <div
                className="
                  grid
                  grid-cols-2
                  gap-3
                "
              >

                <div
                  className="
                    bg-slate-50
                    border
                    border-slate-200
                    rounded-xl
                    p-3
                  "
                >

                  <span
                    className="
                      text-[10px]
                      text-slate-500
                      uppercase
                      font-bold
                    "
                  >
                    Monthly rainfall
                  </span>

                  <div
                    className="
                      text-lg
                      font-mono
                      font-extrabold
                      text-slate-900
                      mt-1
                    "
                  >
                    {typeof prediction.monthly_rainfall_mm ===
                    'number'
                      ? `${prediction.monthly_rainfall_mm.toFixed(2)} mm`
                      : 'N/A'}
                  </div>

                </div>


                </div>

            </div>


            {/* ------------------------------------------------
                HISTORICAL
            ------------------------------------------------ */}

            <div
              className="
                space-y-2
              "
            >

              <div
                className="
                  text-xs
                  font-bold
                  text-slate-900
                  uppercase
                  tracking-wider
                  flex
                  items-center
                  gap-1
                "
              >

                <History
                  className="
                    w-3.5
                    h-3.5
                    text-slate-500
                  "
                />

                <span>
                  Historical indicators
                </span>

              </div>


              <div
                className="
                  space-y-2.5
                "
              >

                {/* Prior events */}

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    border
                    border-slate-200
                    rounded-xl
                    p-3
                    bg-slate-50
                  "
                >

                  <span
                    className="
                      text-xs
                      font-bold
                      text-slate-700
                    "
                  >
                    Prior events
                  </span>

                  <span
                    className="
                      font-mono
                      font-extrabold
                      text-sm
                      text-slate-900
                    "
                  >
                    {prediction.prior_event_count ??
                      'N/A'}
                  </span>

                </div>


                {/* Same month */}

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    border
                    border-slate-200
                    rounded-xl
                    p-3
                    bg-white
                  "
                >

                  <span
                    className="
                      text-xs
                      font-bold
                      text-slate-700
                    "
                  >
                    Same-month events
                  </span>

                  <span
                    className="
                      font-mono
                      font-extrabold
                      text-sm
                      text-slate-900
                    "
                  >
                    {prediction.prior_same_month_count ??
                      'N/A'}
                  </span>

                </div>


                {/* Last 3 years */}

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    border
                    border-slate-200
                    rounded-xl
                    p-3
                    bg-white
                  "
                >

                  <span
                    className="
                      text-xs
                      font-bold
                      text-slate-700
                    "
                  >
                    Events last 3 years
                  </span>

                  <span
                    className="
                      font-mono
                      font-extrabold
                      text-sm
                      text-slate-900
                    "
                  >
                    {prediction.events_last_3_years ??
                      'N/A'}
                  </span>

                </div>


                {/* Last 5 years */}

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    border
                    border-slate-200
                    rounded-xl
                    p-3
                    bg-white
                  "
                >

                  <span
                    className="
                      text-xs
                      font-bold
                      text-slate-700
                    "
                  >
                    Events last 5 years
                  </span>

                  <span
                    className="
                      font-mono
                      font-extrabold
                      text-sm
                      text-slate-900
                    "
                  >
                    {prediction.events_last_5_years ??
                      'N/A'}
                  </span>

                </div>


                {/* Years since last event */}

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    border
                    border-slate-200
                    rounded-xl
                    p-3
                    bg-white
                  "
                >

                  <span
                    className="
                      text-xs
                      font-bold
                      text-slate-700
                    "
                  >
                    Years since last event
                  </span>

                  <span
                    className="
                      font-mono
                      font-extrabold
                      text-sm
                      text-slate-900
                    "
                  >
                    {prediction.years_since_last_event ===
                    999
                      ? 'No prior record'
                      : prediction.years_since_last_event ??
                        'N/A'}
                  </span>

                </div>

              </div>

            </div>
          </>
        )}


        

      </div>


      {/* ======================================================
          FOOTER
      ====================================================== */}

      <div
        className="
          p-4
          border-t
          border-slate-200
          bg-slate-50
          flex
          items-center
          justify-center
        "
      >

        <button
          type="button"
          onClick={onClose}
          className="
            w-full
            py-2.5
            rounded-xl
            bg-slate-900
            hover:bg-slate-800
            text-white
            font-bold
            text-xs
            shadow-sm
            transition-colors
            cursor-pointer
          "
        >
          {translate(
            language,
            'common.close'
          )}
        </button>

      </div>

    </div>
  );
};

export default FuturePredictionDrawer;