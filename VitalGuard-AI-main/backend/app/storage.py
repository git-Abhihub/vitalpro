"""Repository for synthetic VitalGuard observations, alerts, and audit events.

Uses DATABASE_URL when configured and otherwise falls back to SQLite for local
development. Records are fictional demonstration data, not medical records.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from sqlalchemy import (
    Column,
    DateTime,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    func,
    insert,
    select,
    update,
)
from sqlalchemy.engine import Engine

_DEFAULT_DB = Path(__file__).resolve().parents[1] / "vitalguard_demo.sqlite3"
_METADATA = MetaData()

_OBSERVATIONS = Table(
    "observations",
    _METADATA,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("patient_id", String(64), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("input_json", Text, nullable=False),
    Column("prediction_json", Text, nullable=False),
    Column("model_version", String(128), nullable=False),
)
Index(
    "idx_observations_patient_created",
    _OBSERVATIONS.c.patient_id,
    _OBSERVATIONS.c.created_at.desc(),
    _OBSERVATIONS.c.id.desc(),
)

_ALERTS = Table(
    "alerts",
    _METADATA,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("patient_id", String(64), nullable=False),
    Column("severity", String(16), nullable=False),
    Column("status", String(20), nullable=False, server_default="open"),
    Column("title", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("acknowledged_by", String(128), nullable=True),
    Column("observation_id", Integer, nullable=True),
    Column("details_json", Text, nullable=False, server_default="{}"),
)
Index("idx_alerts_patient_created", _ALERTS.c.patient_id, _ALERTS.c.id.desc())

_ALERT_AUDIT = Table(
    "alert_audit",
    _METADATA,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("entity_type", String(32), nullable=False),
    Column("entity_id", String(64), nullable=False),
    Column("action", String(64), nullable=False),
    Column("actor", String(128), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("details_json", Text, nullable=False, server_default="{}"),
)
Index("idx_alert_audit_entity", _ALERT_AUDIT.c.entity_type, _ALERT_AUDIT.c.entity_id, _ALERT_AUDIT.c.id.desc())


def _database_url() -> str:
    """Prefer hosted DATABASE_URL; retain a local SQLite default."""
    configured = os.getenv("DATABASE_URL", "").strip()
    if configured:
        if configured.startswith("postgres://"):
            return "postgresql+psycopg://" + configured[len("postgres://") :]
        if configured.startswith("postgresql://"):
            return "postgresql+psycopg://" + configured[len("postgresql://") :]
        return configured

    path = os.getenv("VITALGUARD_DB_PATH", str(_DEFAULT_DB))
    if path == ":memory:":
        return "sqlite+pysqlite:///:memory:"
    absolute_path = Path(path).expanduser().resolve()
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite+pysqlite:///{absolute_path.as_posix()}"


def _engine() -> Engine:
    url = _database_url()
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args, pool_pre_ping=True)


def initialize_storage() -> None:
    engine = _engine()
    try:
        _METADATA.create_all(engine)
    finally:
        engine.dispose()


def save_observation(
    patient_id: str,
    inputs: dict[str, Any],
    prediction: dict[str, Any],
) -> dict[str, Any]:
    engine = _engine()
    try:
        _METADATA.create_all(engine)
        with engine.begin() as connection:
            result = connection.execute(
                insert(_OBSERVATIONS).values(
                    patient_id=patient_id,
                    input_json=json.dumps(inputs, separators=(",", ":")),
                    prediction_json=json.dumps(prediction, separators=(",", ":")),
                    model_version=prediction["model_version"],
                )
            )
            observation_id = result.inserted_primary_key[0]
            row = connection.execute(
                select(_OBSERVATIONS).where(_OBSERVATIONS.c.id == observation_id)
            ).mappings().one()
        return _serialize_observation(row)
    finally:
        engine.dispose()


def list_observations(
    patient_id: str | None = None,
    limit: int = 50,
    before_id: int | None = None,
) -> list[dict[str, Any]]:
    engine = _engine()
    try:
        _METADATA.create_all(engine)
        query = select(_OBSERVATIONS)
        if patient_id is not None:
            query = query.where(_OBSERVATIONS.c.patient_id == patient_id)
        if before_id is not None:
            query = query.where(_OBSERVATIONS.c.id < before_id)
        query = query.order_by(_OBSERVATIONS.c.id.desc()).limit(limit)
        with engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
        return [_serialize_observation(row) for row in rows]
    finally:
        engine.dispose()


def get_latest_observation(patient_id: str) -> dict[str, Any] | None:
    rows = list_observations(patient_id=patient_id, limit=1)
    return rows[0] if rows else None


def list_patient_summaries(limit: int = 100) -> list[dict[str, Any]]:
    """Return the latest persisted observation for each patient ID."""
    engine = _engine()
    try:
        _METADATA.create_all(engine)
        grouped = (
            select(
                _OBSERVATIONS.c.patient_id.label("patient_id"),
                func.max(_OBSERVATIONS.c.id).label("latest_id"),
                func.count(_OBSERVATIONS.c.id).label("observation_count"),
            )
            .group_by(_OBSERVATIONS.c.patient_id)
            .order_by(func.max(_OBSERVATIONS.c.id).desc())
            .limit(limit)
            .subquery()
        )
        query = (
            select(_OBSERVATIONS, grouped.c.observation_count)
            .join(grouped, _OBSERVATIONS.c.id == grouped.c.latest_id)
            .order_by(_OBSERVATIONS.c.id.desc())
        )
        with engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
        return [
            {
                "record": _serialize_observation(row),
                "observation_count": int(row["observation_count"]),
            }
            for row in rows
        ]
    finally:
        engine.dispose()


def create_alert(
    patient_id: str,
    severity: str,
    title: str,
    details: dict[str, Any] | None = None,
    observation_id: int | None = None,
) -> dict[str, Any]:
    engine = _engine()
    payload = details or {}
    try:
        _METADATA.create_all(engine)
        with engine.begin() as connection:
            result = connection.execute(
                insert(_ALERTS).values(
                    patient_id=patient_id,
                    severity=severity,
                    status="open",
                    title=title,
                    observation_id=observation_id,
                    details_json=json.dumps(payload, separators=(",", ":")),
                )
            )
            alert_id = int(result.inserted_primary_key[0])
            row = connection.execute(select(_ALERTS).where(_ALERTS.c.id == alert_id)).mappings().one()
            connection.execute(
                insert(_ALERT_AUDIT).values(
                    entity_type="alert",
                    entity_id=str(alert_id),
                    action="created",
                    actor="system",
                    details_json=json.dumps({"patient_id": patient_id, "severity": severity}, separators=(",", ":")),
                )
            )
        return _serialize_alert(row)
    finally:
        engine.dispose()


def get_alert(alert_id: int) -> dict[str, Any] | None:
    engine = _engine()
    try:
        _METADATA.create_all(engine)
        with engine.connect() as connection:
            row = connection.execute(select(_ALERTS).where(_ALERTS.c.id == alert_id)).mappings().first()
        return _serialize_alert(row) if row else None
    finally:
        engine.dispose()


def list_alerts(patient_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    engine = _engine()
    try:
        _METADATA.create_all(engine)
        query = select(_ALERTS)
        if patient_id is not None:
            query = query.where(_ALERTS.c.patient_id == patient_id)
        query = query.order_by(_ALERTS.c.id.desc()).limit(limit)
        with engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
        return [_serialize_alert(row) for row in rows]
    finally:
        engine.dispose()


def transition_alert(alert_id: int, status: str, actor: str) -> dict[str, Any] | None:
    """Persist a supported alert state transition and a corresponding audit event."""
    if status not in {"acknowledged", "resolved"}:
        raise ValueError("Unsupported alert state")
    engine = _engine()
    try:
        _METADATA.create_all(engine)
        with engine.begin() as connection:
            row = connection.execute(select(_ALERTS).where(_ALERTS.c.id == alert_id)).mappings().first()
            if row is None:
                return None
            current = _serialize_alert(row)
            if current["status"] == status:
                return current
            if current["status"] == "resolved":
                raise ValueError("Resolved alerts cannot be changed")
            if status == "acknowledged" and current["status"] != "open":
                raise ValueError("Only open alerts can be acknowledged")
            values: dict[str, Any] = {"status": status}
            if status == "acknowledged":
                values["acknowledged_by"] = actor
            connection.execute(update(_ALERTS).where(_ALERTS.c.id == alert_id).values(**values))
            connection.execute(
                insert(_ALERT_AUDIT).values(
                    entity_type="alert",
                    entity_id=str(alert_id),
                    action=status,
                    actor=actor,
                    details_json=json.dumps({"from_status": current["status"], "to_status": status}, separators=(",", ":")),
                )
            )
            updated = connection.execute(select(_ALERTS).where(_ALERTS.c.id == alert_id)).mappings().one()
        return _serialize_alert(updated)
    finally:
        engine.dispose()


def list_alert_audit(alert_id: int) -> list[dict[str, Any]]:
    engine = _engine()
    try:
        _METADATA.create_all(engine)
        query = (
            select(_ALERT_AUDIT)
            .where(_ALERT_AUDIT.c.entity_type == "alert", _ALERT_AUDIT.c.entity_id == str(alert_id))
            .order_by(_ALERT_AUDIT.c.id.asc())
        )
        with engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
        return [_serialize_audit(row) for row in rows]
    finally:
        engine.dispose()


def _serialize_observation(row: Any) -> dict[str, Any]:
    created_at = row["created_at"]
    if hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat()
    return {
        "id": row["id"],
        "patient_id": row["patient_id"],
        "created_at": created_at,
        "inputs": json.loads(row["input_json"]),
        "prediction": json.loads(row["prediction_json"]),
        "model_version": row["model_version"],
    }


def _serialize_alert(row: Any) -> dict[str, Any]:
    created_at = row["created_at"]
    if hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat()
    return {
        "id": row["id"],
        "patient_id": row["patient_id"],
        "severity": row["severity"],
        "status": row["status"],
        "title": row["title"],
        "created_at": created_at,
        "acknowledged_by": row["acknowledged_by"],
        "observation_id": row["observation_id"],
        "details": json.loads(row["details_json"]),
    }


def _serialize_audit(row: Any) -> dict[str, Any]:
    created_at = row["created_at"]
    if hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat()
    return {
        "id": row["id"],
        "entity_type": row["entity_type"],
        "entity_id": row["entity_id"],
        "action": row["action"],
        "actor": row["actor"],
        "created_at": created_at,
        "details": json.loads(row["details_json"]),
    }
