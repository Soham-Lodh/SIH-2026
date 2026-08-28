from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd


# ============================================================
# PATH
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

BUNDLE_PATH = (
    BASE_DIR
    / "artifacts"
    / "india_disaster_prediction_bundle.joblib"
)


# ============================================================
# FLOOD FEATURES
# ============================================================

FLOOD_FEATURE_COLUMNS = [
    "Month",
    "Month_Sin",
    "Month_Cos",
    "Latitude",
    "Longitude",
    "Latitude_Squared",
    "Longitude_Squared",
    "IMD_Monthly_Rainfall_Normal_mm",
    "IMD_All_India_Rainfall_Normal_mm",
    "IMD_Annual_Region_Rainfall_Normal_mm",
    "IMD_Monsoon_Rainfall_Normal_mm",
    "IMD_Rainfall_Normal_Ratio_to_India",
    "IMD_Monthly_Rainfall_Share_of_Annual",
]


# ============================================================
# MONTH MAP
# ============================================================

MONTH_MAP = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}


# ============================================================
# LOAD MASTER BUNDLE ONCE
# ============================================================

@lru_cache(maxsize=1)
def load_model_bundle() -> dict[str, Any]:

    if not BUNDLE_PATH.exists():
        raise FileNotFoundError(
            f"Model bundle not found: {BUNDLE_PATH}"
        )

    bundle = joblib.load(BUNDLE_PATH)

    if not isinstance(bundle, dict):
        raise TypeError(
            "Model bundle must be a dictionary."
        )

    required = {
        "flood",
        "landslide",
    }

    missing = required.difference(bundle.keys())

    if missing:
        raise ValueError(
            f"Model bundle missing keys: {sorted(missing)}"
        )

    return bundle


# ============================================================
# MONTH CONVERTER
# ============================================================

def month_to_number(
    month: int | str,
) -> int:

    if isinstance(month, bool):
        raise ValueError(
            "Month must be 1-12 or a month name."
        )

    if isinstance(month, int):

        if 1 <= month <= 12:
            return month

        raise ValueError(
            "Month must be between 1 and 12."
        )

    value = str(month).strip().lower()

    if value in MONTH_MAP:
        return MONTH_MAP[value]

    try:
        number = int(value)
    except ValueError as exc:
        raise ValueError(
            "Month must be 1-12 or a month name."
        ) from exc

    if not 1 <= number <= 12:
        raise ValueError(
            "Month must be between 1 and 12."
        )

    return number


# ============================================================
# FLOOD FEATURE ENGINEERING
# ============================================================

def prepare_flood_features(
    df: pd.DataFrame,
) -> pd.DataFrame:

    x = df.copy()

    numeric_columns = [
        "Month",
        "Latitude",
        "Longitude",
        "IMD_Monthly_Rainfall_Normal_mm",
        "IMD_All_India_Rainfall_Normal_mm",
        "IMD_Annual_Region_Rainfall_Normal_mm",
        "IMD_Monsoon_Rainfall_Normal_mm",
        "IMD_Rainfall_Normal_Ratio_to_India",
        "IMD_Monthly_Rainfall_Share_of_Annual",
    ]

    for column in numeric_columns:

        if column in x.columns:

            x[column] = pd.to_numeric(
                x[column],
                errors="coerce",
            )

    x["Month_Sin"] = np.sin(
        2 * np.pi * x["Month"] / 12.0
    )

    x["Month_Cos"] = np.cos(
        2 * np.pi * x["Month"] / 12.0
    )

    x["Latitude_Squared"] = (
        x["Latitude"] ** 2
    )

    x["Longitude_Squared"] = (
        x["Longitude"] ** 2
    )

    missing = [
        column
        for column in FLOOD_FEATURE_COLUMNS
        if column not in x.columns
    ]

    if missing:
        raise ValueError(
            f"Flood features missing: {missing}"
        )

    return x[FLOOD_FEATURE_COLUMNS]


# ============================================================
# FLOOD PREDICTOR
# ============================================================

def predict_floods(
    month: int | str,
    top_n: int = 20,
) -> dict[str, Any]:

    if not isinstance(top_n, int):
        raise ValueError(
            "top_n must be an integer."
        )

    if not 1 <= top_n <= 500:
        raise ValueError(
            "top_n must be between 1 and 500."
        )

    month_number = month_to_number(month)

    bundle = load_model_bundle()

    flood = bundle["flood"]

    location_model = flood["location_model"]

    severity_models = flood["severity_models"]

    candidates: pd.DataFrame = flood["candidates"]

    # ========================================================
    # SELECT MONTH
    # ========================================================

    month_data = candidates[
        candidates["Month"] == month_number
    ].copy()

    if month_data.empty:
        raise ValueError(
            f"No candidate locations are available "
            f"for month {month_number}."
        )

    # ========================================================
    # CREATE FEATURES
    # ========================================================

    x_candidates = prepare_flood_features(
        month_data
    )

    # ========================================================
    # ORIGINAL MODEL PROBABILITY
    #
    # DO NOT ALTER THIS CALCULATION.
    # ========================================================

    raw_probability = (
        location_model
        .predict_proba(x_candidates)[:, 1]
    )

    month_data["Flood_Probability"] = (
        pd.to_numeric(
            raw_probability,
            errors="coerce",
        )
    )

    # Remove invalid predictions
    month_data = month_data[
        month_data["Flood_Probability"].notna()
    ].copy()

    # ========================================================
    # IMPORTANT:
    # REMOVE ALL FLOOD LOCATIONS BELOW 50%
    # BEFORE RANKING.
    # ========================================================

    month_data = month_data[
        month_data["Flood_Probability"] >= 0.50
    ].copy()

    if month_data.empty:

        return {
            "disaster_type": "flood",
            "month": month_number,
            "requested_top_n": top_n,
            "returned_count": 0,
            "predictions": [],
        }

    # ========================================================
    # SORT BY ACTUAL PROBABILITY
    # HIGH → LOW
    # ========================================================

    month_data = (
        month_data
        .sort_values(
            by="Flood_Probability",
            ascending=False,
            kind="mergesort",
        )
        .reset_index(drop=True)
    )

    # ========================================================
    # ASSIGN RANK AFTER FILTER + SORT
    #
    # Therefore:
    #
    # Rank 1  >= Rank 2 >= Rank 3 ...
    #
    # and every returned point is >= 50%.
    # ========================================================

    month_data["rank"] = (
        np.arange(
            1,
            len(month_data) + 1,
        )
    )

    # ========================================================
    # NOW TAKE TOP N
    # ========================================================

    month_data = (
        month_data
        .head(top_n)
        .reset_index(drop=True)
    )

    # ========================================================
    # SEVERITY PREDICTIONS
    # ========================================================

    x_selected = prepare_flood_features(
        month_data
    )

    for target, model in severity_models.items():

        prediction = model.predict(
            x_selected
        )

        month_data[target] = np.maximum(
            prediction,
            0.0,
        )

    # ========================================================
    # BUILD RESPONSE
    # ========================================================

    predictions = []

    for _, row in month_data.iterrows():

        probability = float(
            row["Flood_Probability"]
        )

        predictions.append(
            {
                "rank": int(
                    row["rank"]
                ),

                "month": month_number,

                "disaster_type":
                    "flood",

                "latitude": round(
                    float(
                        row["Latitude"]
                    ),
                    6,
                ),

                "longitude": round(
                    float(
                        row["Longitude"]
                    ),
                    6,
                ),

                "flood_probability": round(
                    probability,
                    6,
                ),

                "flood_probability_percent":
                    round(
                        probability * 100.0,
                        2,
                    ),

                "peak_flood_level_m":
                    round(
                        float(
                            row[
                                "Peak Flood Level (m)"
                            ]
                        ),
                        2,
                    ),

                "warning_level":
                    round(
                        float(
                            row[
                                "Warning Level"
                            ]
                        ),
                        2,
                    ),

                "danger_level":
                    round(
                        float(
                            row[
                                "Danger Level"
                            ]
                        ),
                        2,
                    ),
            }
        )

    return {
        "disaster_type": "flood",

        "month": month_number,

        "requested_top_n": top_n,

        "returned_count":
            len(predictions),

        "predictions":
            predictions,
    }


# ============================================================
# LANDSLIDE PREDICTOR
# ============================================================

def predict_landslides(
    month: int | str,
    top_n: int = 20,
) -> dict[str, Any]:

    month_number = month_to_number(month)

    bundle = load_model_bundle()

    landslide = bundle["landslide"]

    prediction_table = landslide["prediction_table"]

    month_data = prediction_table[
        prediction_table["month"] == month_number
    ].copy()

    if month_data.empty:
        raise ValueError(
            f"No landslide predictions for month {month_number}."
        )

    month_data["confidence_percent"] = pd.to_numeric(
        month_data["confidence_percent"],
        errors="coerce",
    ).fillna(0)

    month_data = (
        month_data
        .sort_values(
            "confidence_percent",
            ascending=False,
        )
        .head(top_n)
        .reset_index(drop=True)
    )

    predictions = []

    for rank, (_, row) in enumerate(
        month_data.iterrows(),
        start=1,
    ):

        probability_percent = float(
            row["confidence_percent"]
        )

        predictions.append(
            {
                "rank": rank,
                "month": month_number,
                "disaster_type": "landslide",

                "latitude": round(
                    float(row["latitude"]),
                    6,
                ),

                "longitude": round(
                    float(row["longitude"]),
                    6,
                ),

                "landslide_probability": round(
                    probability_percent / 100.0,
                    6,
                ),

                "landslide_probability_percent":
                    round(
                        probability_percent,
                        2,
                    ),

                "monthly_rainfall_mm":
                    float(
                        row["monthly_rainfall_mm"]
                    ),

                "rain_zscore":
                    float(
                        row["rain_zscore"]
                    ),

                "prior_event_count":
                    int(
                        row["prior_event_count"]
                    ),

                "prior_same_month_count":
                    int(
                        row["prior_same_month_count"]
                    ),

                "events_last_3_years":
                    int(
                        row["events_last_3_years"]
                    ),

                "events_last_5_years":
                    int(
                        row["events_last_5_years"]
                    ),

                "years_since_last_event":
                    int(
                        row["years_since_last_event"]
                    ),
            }
        )

    return {
        "disaster_type": "landslide",
        "month": month_number,
        "requested_top_n": top_n,
        "returned_count": len(predictions),
        "predictions": predictions,
    }


# ============================================================
# HEALTH
# ============================================================

def model_status() -> dict[str, Any]:

    bundle = load_model_bundle()

    flood = bundle["flood"]

    landslide = bundle["landslide"]

    candidates = flood[
        "candidates"
    ]

    prediction_table = landslide.get(
        "prediction_table"
    )

    return {
        "loaded": True,

        "bundle": BUNDLE_PATH.name,

        "models": {
            "flood": {
                "location_model":
                    type(
                        flood[
                            "location_model"
                        ]
                    ).__name__,

                "severity_models": {
                    target:
                        type(model).__name__
                    for target, model
                    in flood[
                        "severity_models"
                    ].items()
                },
            },

            "landslide": {
                "model":
                    type(
                        landslide[
                            "model"
                        ]
                    ).__name__,

                "prediction_table_loaded":
                    prediction_table
                    is not None,

                "saved_features":
                    landslide.get(
                        "features"
                    ),

                "confidence_threshold":
                    landslide.get(
                        "confidence_threshold"
                    ),
            },
        },

        "flood": {
            "candidate_rows":
                int(len(candidates)),
        },

        "landslide": {
            "prediction_rows":
                int(
                    len(prediction_table)
                )
                if prediction_table is not None
                else 0,

            "months":
                sorted(
                    prediction_table[
                        "month"
                    ]
                    .unique()
                    .tolist()
                )
                if prediction_table is not None
                else [],
        },
    }