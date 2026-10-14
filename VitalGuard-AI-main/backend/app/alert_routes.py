"""Persistent synthetic alert lifecycle and audit API."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from .live import event_hub
from .storage import get_alert, list_alert_audit, list_alerts, transition_alert

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])


class AlertTransitionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    actor: str = Field(min_length=1, max_length=128)


@router.get("")
def alert_list(
    patient_id: str | None = Query(default=None, min_length=1, max_length=64),
    limit: int = Query(default=100, ge=1, le=100),
):
    items = list_alerts(patient_id=patient_id, limit=limit)
    return {"items": items, "count": len(items), "limit": limit, "demo_only": True}


@router.get("/{alert_id}/audit")
def alert_audit(alert_id: int):
    if get_alert(alert_id) is None:
        raise HTTPException(status_code=404, detail="Demo alert not found.")
    items = list_alert_audit(alert_id)
    return {"items": items, "count": len(items), "demo_only": True}


@router.post("/{alert_id}/{action}")
async def alert_transition(
    alert_id: int,
    action: Literal["acknowledge", "resolve"],
    payload: AlertTransitionRequest,
):
    target_status = "acknowledged" if action == "acknowledge" else "resolved"
    try:
        item = transition_alert(alert_id, target_status, payload.actor.strip())
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if item is None:
        raise HTTPException(status_code=404, detail="Demo alert not found.")
    return {"item": item, "demo_only": True}
