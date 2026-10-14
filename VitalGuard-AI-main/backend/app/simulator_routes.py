"""Demo-only API for submitting deterministic synthetic observations."""
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from .live import event_hub
from .model import MODEL_VERSION, explain, predict_probability, risk_level
from .schemas import RiskPrediction
from .simulator import observation_for_step
from .storage import create_alert, save_observation

router = APIRouter(prefix="/api/v1/demo", tags=["demo-simulator"])


class SimulationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    patient_id: str = Field(default="DEMO-LIVE-001", min_length=1, max_length=64)
    scenario: Literal["stable", "worsening", "recovering"] = "stable"
    step: int = Field(default=0, ge=0, le=1000)


@router.post("/observations", response_model=RiskPrediction)
async def submit_demo_observation(payload: SimulationRequest):
    """Generate, score, persist and broadcast one fictional observation.

    A caller controls the step to make the demo deterministic and easy to
    present. Repeated requests are separate observations, not idempotent writes.
    """
    values = observation_for_step(payload.scenario, payload.step)
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
    if score >= 65:
        alert = create_alert(
            patient_id=payload.patient_id,
            severity="critical" if score >= 85 else "high",
            title="Synthetic elevated-risk signal",
            details={
                "scenario": payload.scenario,
                "step": payload.step,
                "risk_score": score,
                "risk_level": risk_level(score),
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
