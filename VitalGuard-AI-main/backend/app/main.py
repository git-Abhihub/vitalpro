from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .alert_routes import router as alert_router
from .analytics_routes import router as analytics_router
from .live import event_hub
from .model import MODEL_VERSION, explain, predict_probability, risk_level
from .model_routes import router as model_router
from .news2 import router as news2_router
from .patient_routes import router as patient_router
from .schemas import RiskPrediction, VitalInput
from .simulator_routes import router as simulator_router
from .storage import create_alert, initialize_storage, list_observations, save_observation


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_storage()
    yield


app = FastAPI(
    title="VitalGuard AI Risk Engine",
    version="0.4.0",
    description=(
        "API for synthetic observations, demonstration risk signals, and software integration. "
        "Not clinically validated and not for clinical use."
    ),
    lifespan=lifespan,
)
app.include_router(simulator_router)
app.include_router(patient_router)
app.include_router(alert_router)
app.include_router(analytics_router)
app.include_router(model_router)
app.include_router(news2_router)

_default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://vitalguard-ai-frontend.onrender.com",
]
_origins = os.getenv("CORS_ORIGINS", ",".join(_default_origins))
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in _origins.split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/")
def root():
    return {
        "service": "VitalGuard AI Risk Engine",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
        "demo_only": True,
    }


@app.get("/health")
def health():
    database_url = os.getenv("DATABASE_URL", "").strip()
    return {
        "status": "ok",
        "model_version": MODEL_VERSION,
        "demo_only": True,
        "storage_backend": "postgresql" if database_url.startswith(("postgres://", "postgresql://", "postgresql+psycopg://")) else "sqlite",
        "persistent_storage_configured": bool(database_url),
    }


@app.get("/api/v1/model/info")
def model_info():
    database_url = os.getenv("DATABASE_URL", "").strip()
    return {
        "name": "VitalGuard synthetic risk classifier",
        "model_version": MODEL_VERSION,
        "algorithm": "StandardScaler + LogisticRegression",
        "features": [
            "age", "heart_rate", "spo2", "systolic_bp",
            "diastolic_bp", "temperature", "respiratory_rate",
        ],
        "training_data": "generated synthetic observations only",
        "demo_only": True,
        "clinically_validated": False,
        "storage_backend": "postgresql" if database_url.startswith(("postgres://", "postgresql://", "postgresql+psycopg://")) else "sqlite",
        "persistent_storage_configured": bool(database_url),
    }


@app.post("/api/v1/risk/predict", response_model=RiskPrediction)
async def predict(payload: VitalInput):
    values = payload.model_dump(exclude={"patient_id"})
    probability = predict_probability(values)
    score = round(probability * 100)
    result = RiskPrediction(
        patient_id=payload.patient_id,
        risk_score=score,
        risk_level=risk_level(score),
        model_probability=round(probability, 4),
        factors=explain(values),
        model_version=MODEL_VERSION,
    )
    saved = save_observation(payload.patient_id, values, result.model_dump())
    response = result.model_copy(
        update={"observation_id": saved["id"], "created_at": saved["created_at"]}
    )

    await event_hub.broadcast({
        "type": "observation.created",
        "event_id": saved["id"],
        "patient_id": payload.patient_id,
        "created_at": saved["created_at"],
        "observation": values,
        "prediction": {
            "risk_score": response.risk_score,
            "risk_level": response.risk_level,
            "model_version": response.model_version,
        },
        "demo_only": True,
    })

    # Persist a demonstration alert from the synthetic score bands. These are
    # software demo thresholds, not validated clinical escalation thresholds.
    if score >= 65:
        alert = create_alert(
            patient_id=payload.patient_id,
            severity="critical" if score >= 85 else "high",
            title="Synthetic elevated-risk signal",
            details={
                "risk_score": score,
                "risk_level": risk_level(score),
                "model_version": MODEL_VERSION,
                "disclaimer": "Synthetic heuristic model only; not a clinical alarm.",
            },
            observation_id=saved["id"],
        )
        await event_hub.broadcast({
            "type": "alert.created",
            "event_id": alert["id"],
            "alert": alert,
            "demo_only": True,
        })
    return response


@app.get("/api/v1/observations")
def observation_history(
    patient_id: str | None = Query(default=None, min_length=1, max_length=64),
    limit: int = Query(default=50, ge=1, le=100),
    before_id: int | None = Query(default=None, ge=1),
):
    """Return recent saved demo predictions, optionally filtered by demo patient ID."""
    records = list_observations(
        patient_id=patient_id, limit=limit, before_id=before_id
    )
    next_cursor = records[-1]["id"] if len(records) == limit else None
    return {
        "items": records,
        "count": len(records),
        "limit": limit,
        "next_before_id": next_cursor,
        "demo_only": True,
        "disclaimer": "Synthetic demonstration records only; not for clinical use.",
    }


@app.websocket("/api/v1/live")
async def live_events(websocket: WebSocket):
    await event_hub.connect(websocket)
    try:
        while True:
            message = await websocket.receive_text()
            if message.strip().lower() == "ping":
                await websocket.send_json({"type": "pong", "demo_only": True})
    except WebSocketDisconnect:
        event_hub.disconnect(websocket)
    except Exception:
        event_hub.disconnect(websocket)
