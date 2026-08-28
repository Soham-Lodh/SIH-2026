from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
BUNDLE_PATH = BASE_DIR / "artifacts" / "india_flood_prediction_bundle.joblib"

FEATURE_COLUMNS = [
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

SEVERITY_TARGETS = [
    "Peak Flood Level (m)",
    "Warning Level",
    "Danger Level",
]

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


@lru_cache(maxsize=1)
def load_model_bundle() -> dict[str, Any]:
    """
    Load the complete joblib bundle once and keep it in process memory.

    This is deliberately cached so the model is NOT loaded for every request.
    """
    if not BUNDLE_PATH.exists():
        raise FileNotFoundError(
            f"Flood model bundle not found: {BUNDLE_PATH}"
        )

    bundle = joblib.load(BUNDLE_PATH)

    required_keys = {
        "location_model",
        "severity_models",
        "candidates",
    }
    missing = required_keys.difference(bundle.keys())

    if missing:
        raise ValueError(
            f"Invalid flood model bundle. Missing keys: {sorted(missing)}"
        )

    candidates = bundle["candidates"]

    if not isinstance(candidates, pd.DataFrame):
        raise TypeError("Bundle 'candidates' must be a pandas DataFrame.")

    required_candidate_columns = {
        "Month",
        "Latitude",
        "Longitude",
    }
    missing_candidate_columns = (
        required_candidate_columns.difference(candidates.columns)
    )

    if missing_candidate_columns:
        raise ValueError(
            "Candidate data is missing columns: "
            f"{sorted(missing_candidate_columns)}"
        )

    return bundle


def month_to_number(month: int | str) -> int:
    """Convert month name or number into 1-12."""
    if isinstance(month, int):
        if 1 <= month <= 12:
            return month
        raise ValueError("Month must be between 1 and 12.")

    clean = str(month).strip().lower()

    if clean in MONTH_MAP:
        return MONTH_MAP[clean]

    try:
        number = int(clean)
    except ValueError as exc:
        raise ValueError(
            "Month must be January-December or an integer from 1 to 12."
        ) from exc

    if not 1 <= number <= 12:
        raise ValueError("Month must be between 1 and 12.")

    return number


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Reproduce the feature engineering used during training.
    """
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
            x[column] = pd.to_numeric(x[column], errors="coerce")

    x["Month_Sin"] = np.sin(
        2 * np.pi * x["Month"] / 12.0
    )
    x["Month_Cos"] = np.cos(
        2 * np.pi * x["Month"] / 12.0
    )
    x["Latitude_Squared"] = x["Latitude"] ** 2
    x["Longitude_Squared"] = x["Longitude"] ** 2

    missing_features = [
        column for column in FEATURE_COLUMNS
        if column not in x.columns
    ]

    if missing_features:
        raise ValueError(
            "Candidate data is missing model features: "
            f"{missing_features}"
        )

    # XGBoost can handle numeric NaN values directly.
    return x[FEATURE_COLUMNS]


def predict_floods(
    month: int | str,
    top_n: int = 20,
) -> dict[str, Any]:
    """
    Predict the top-N Indian flood-risk locations for a month.

    Output is JSON-ready and designed for direct frontend consumption.
    """
    if not isinstance(top_n, int):
        raise ValueError("top_n must be an integer.")

    if not 1 <= top_n <= 500:
        raise ValueError("top_n must be between 1 and 500.")

    month_number = month_to_number(month)
    bundle = load_model_bundle()

    location_model = bundle["location_model"]
    severity_models = bundle["severity_models"]
    candidates: pd.DataFrame = bundle["candidates"]

    month_data = candidates[
        candidates["Month"] == month_number
    ].copy()

    if month_data.empty:
        raise ValueError(
            f"No candidate locations are available for month {month_number}."
        )

    x_candidates = prepare_features(month_data)

    # Probability of Flood_Observed = 1.
    risk_probability = (
        location_model.predict_proba(x_candidates)[:, 1]
    )

    month_data["Flood_Probability"] = risk_probability

    # Rank ALL candidate coordinates first, then take top N.
    month_data = (
        month_data
        .sort_values(
            "Flood_Probability",
            ascending=False,
        )
        .head(top_n)
        .reset_index(drop=True)
    )

    x_selected = prepare_features(month_data)

    for target, model in severity_models.items():
        prediction = model.predict(x_selected)

        # Physical lower bound: no negative flood level/severity.
        month_data[target] = np.maximum(
            prediction,
            0.0,
        )

    predictions: list[dict[str, Any]] = []

    for rank, (_, row) in enumerate(
        month_data.iterrows(),
        start=1,
    ):
        item: dict[str, Any] = {
            "rank": rank,
            "month": month_number,
            "latitude": round(float(row["Latitude"]), 6),
            "longitude": round(float(row["Longitude"]), 6),
            "flood_probability": round(
                float(row["Flood_Probability"]),
                6,
            ),
            "flood_probability_percent": round(
                float(row["Flood_Probability"]) * 100.0,
                2,
            ),
            "peak_flood_level_m": round(
                float(row["Peak Flood Level (m)"]),
                2,
            ),
            "warning_level": round(
                float(row["Warning Level"]),
                2,
            ),
            "danger_level": round(
                float(row["Danger Level"]),
                2,
            ),
        }

        if "Historical_Observations" in row.index:
            value = row["Historical_Observations"]

            if pd.notna(value):
                try:
                    item["historical_observations"] = int(value)
                except (TypeError, ValueError):
                    item["historical_observations"] = value

        predictions.append(item)

    return {
        "month": month_number,
        "requested_top_n": top_n,
        "returned_count": len(predictions),
        "predictions": predictions,
    }


def model_status() -> dict[str, Any]:
    """
    Lightweight status information for /health.
    """
    bundle = load_model_bundle()

    severity_models = bundle["severity_models"]
    candidates: pd.DataFrame = bundle["candidates"]

    return {
        "loaded": True,
        "bundle": BUNDLE_PATH.name,
        "location_model": type(
            bundle["location_model"]
        ).__name__,
        "severity_models": {
            target: type(model).__name__
            for target, model in severity_models.items()
        },
        "candidate_rows": int(len(candidates)),
        "candidate_coordinates": int(
            candidates[
                ["Latitude", "Longitude"]
            ].drop_duplicates().shape[0]
        ),
    }