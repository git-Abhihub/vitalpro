"""NEWS2 parameter-score demonstration endpoint.

This calculation mirrors RCP NEWS2 chart bands for software demonstration only.
It is not clinically validated, approved, or suitable for making clinical decisions.
"""
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter(prefix="/api/v1/scores", tags=["score-demonstrations"])


class News2Input(BaseModel):
    model_config = ConfigDict(extra="forbid")
    patient_id: str = Field(default="DEMO-NEWS2-001", min_length=1, max_length=64)
    respiratory_rate: float = Field(ge=1, le=100)
    spo2: float = Field(ge=50, le=100)
    systolic_bp: float = Field(ge=20, le=300)
    heart_rate: float = Field(ge=1, le=250)
    temperature: float = Field(ge=30, le=45)
    consciousness: Literal["alert", "new_confusion", "voice", "pain", "unresponsive"] = "alert"
    supplemental_oxygen: bool = False
    spo2_scale: Literal[1, 2] = 1
    scale2_authorized: bool = False


def _respiratory_rate(value: float) -> int:
    if value <= 8: return 3
    if value <= 11: return 1
    if value <= 20: return 0
    if value <= 24: return 2
    return 3


def _spo2_scale1(value: float) -> int:
    if value <= 91: return 3
    if value <= 93: return 2
    if value <= 95: return 1
    return 0


def _spo2_scale2(value: float) -> int:
    # NEWS2 Scale 2 target band is 88–92%; oxygen use is scored separately.
    if value <= 83: return 3
    if value <= 85: return 2
    if value <= 87: return 1
    if value <= 92: return 0
    if value <= 94: return 1
    if value <= 96: return 2
    return 3


def _systolic_bp(value: float) -> int:
    if value <= 90: return 3
    if value <= 100: return 2
    if value <= 110: return 1
    if value <= 219: return 0
    return 3


def _heart_rate(value: float) -> int:
    if value <= 40: return 3
    if value <= 50: return 1
    if value <= 90: return 0
    if value <= 110: return 1
    if value <= 130: return 2
    return 3


def _temperature(value: float) -> int:
    if value <= 35: return 3
    if value <= 36: return 1
    if value <= 38: return 0
    if value <= 39: return 1
    return 2


@router.post("/news2")
def news2_score(payload: News2Input):
    if payload.spo2_scale == 2 and not payload.scale2_authorized:
        raise HTTPException(
            status_code=422,
            detail="NEWS2 SpO2 Scale 2 must only be used under the direction of a qualified clinician. The acknowledgement field is not proof of authorization.",
        )
    parameter_scores = {
        "respiratory_rate": _respiratory_rate(payload.respiratory_rate),
        "spo2": _spo2_scale1(payload.spo2) if payload.spo2_scale == 1 else _spo2_scale2(payload.spo2),
        "supplemental_oxygen": 2 if payload.supplemental_oxygen else 0,
        "systolic_bp": _systolic_bp(payload.systolic_bp),
        "heart_rate": _heart_rate(payload.heart_rate),
        "consciousness": 0 if payload.consciousness == "alert" else 3,
        "temperature": _temperature(payload.temperature),
    }
    return {
        "patient_id": payload.patient_id,
        "score_name": "NEWS2",
        "score_version": "RCP NEWS2 chart (2017)",
        "parameter_scores": parameter_scores,
        "total_score": sum(parameter_scores.values()),
        "spo2_scale": payload.spo2_scale,
        "supplemental_oxygen": payload.supplemental_oxygen,
        "demo_only": True,
        "clinically_validated_implementation": False,
        "disclaimer": "Demonstration-only NEWS2 parameter score. Not clinically validated or approved; verify against the official RCP chart and local policy. This response does not provide escalation or treatment advice.",
    }
