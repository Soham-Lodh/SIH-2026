"""
FastAPI application for the India flood prediction model.

Run from backend-ml:
    uvicorn main:app --reload
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from helpers.flood import load_model_bundle, model_status, predict_floods


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Load the model once when the FastAPI process starts.

    Requests reuse the already-loaded bundle from memory.
    """
    load_model_bundle()
    yield


app = FastAPI(
    title="Aapada Drishti Flood Prediction API",
    description=(
        "India-only monthly flood risk prediction API. "
        "A month is converted into ranked geographic predictions "
        "with flood probability and severity estimates."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# React frontend / development servers.
# Tighten this list for production deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FloodPredictionRequest(BaseModel):
    month: int | str = Field(
        ...,
        description="Month number (1-12) or month name such as July.",
        examples=[7],
    )
    top_n: int = Field(
        default=20,
        ge=1,
        le=500,
        description="Number of highest-risk Indian locations to return.",
        examples=[20],
    )


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "Aapada Drishti Flood Prediction API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health() -> dict[str, Any]:
    try:
        return model_status()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Model service unavailable: {exc}",
        ) from exc


@app.post("/predict")
def predict(request: FloodPredictionRequest) -> dict[str, Any]:
    """
    Return top-N flood-risk locations for the requested month.

    Frontend receives:
        rank
        latitude
        longitude
        flood_probability
        flood_probability_percent
        peak_flood_level_m
        warning_level
        danger_level
        optional historical_observations
    """
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
            detail=f"Prediction failed: {exc}",
        ) from exc