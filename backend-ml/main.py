"""
Aapada Drishti Disaster Prediction API

Endpoints:

    GET  /
    GET  /health

    POST /predict/floods
    POST /predict/landslides
    POST /predict
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from helpers.help import (
    load_model_bundle,
    model_status,
    predict_floods,
    predict_landslides,
)


# ============================================================
# LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    # Load the ONE merged Joblib once.
    load_model_bundle()

    yield


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="Aapada Drishti Disaster Prediction API",

    description=(
        "India-only flood and landslide "
        "prediction API."
    ),

    version="2.0.0",

    lifespan=lifespan,
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://sih-2026-bay.vercel.app",
        "https://aapda-drishti.antideploy.com"
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# ============================================================
# REQUEST MODEL
# ============================================================

class PredictionRequest(BaseModel):

    month: int | str = Field(
        ...,
        description=(
            "Month number 1-12 or "
            "month name such as August."
        ),
        examples=[8],
    )

    top_n: int = Field(
        default=20,
        ge=1,
        le=500,
        description=(
            "Number of highest-risk locations."
        ),
        examples=[20],
    )


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root() -> dict[str, Any]:

    return {
        "service":
            "Aapada Drishti Disaster "
            "Prediction API",

        "status": "running",

        "models": [
            "flood",
            "landslide",
        ],

        "docs": "/docs",
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health() -> dict[str, Any]:

    try:

        return model_status()

    except Exception as exc:

        raise HTTPException(
            status_code=503,
            detail=(
                f"Model service unavailable: "
                f"{exc}"
            ),
        ) from exc


# ============================================================
# FLOOD
# ============================================================

@app.post("/predict/floods")
def predict_flood(
    request: PredictionRequest,
) -> dict[str, Any]:

    try:

        return predict_floods(
            month=request.month,
            top_n=request.top_n,
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Flood prediction failed: "
                f"{exc}"
            ),
        ) from exc


# ============================================================
# LANDSLIDE
# ============================================================

@app.post("/predict/landslides")
def predict_landslide(
    request: PredictionRequest,
) -> dict[str, Any]:

    try:

        return predict_landslides(
            month=request.month,
            top_n=request.top_n,
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Landslide prediction failed: "
                f"{exc}"
            ),
        ) from exc


# ============================================================
# BOTH FLOOD + LANDSLIDE
# ============================================================

@app.post("/predict")
def predict_all(
    request: PredictionRequest,
) -> dict[str, Any]:

    try:

        flood = predict_floods(
            month=request.month,
            top_n=request.top_n,
        )

        landslide = predict_landslides(
            month=request.month,
            top_n=request.top_n,
        )

        return {
            "month": flood["month"],
            "flood": flood,
            "landslide": landslide,
        }

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Combined prediction failed: "
                f"{exc}"
            ),
        ) from exc