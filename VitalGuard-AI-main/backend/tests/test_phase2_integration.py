from fastapi.testclient import TestClient
import pytest

from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("VITALGUARD_DB_PATH", str(tmp_path / "phase2.sqlite3"))
    with TestClient(app) as test_client:
        yield test_client


def payload(patient_id="DEMO-PHASE2-001", **overrides):
    values = {
        "patient_id": patient_id,
        "age": 58,
        "heart_rate": 82,
        "spo2": 98,
        "systolic_bp": 122,
        "diastolic_bp": 78,
        "temperature": 37.0,
        "respiratory_rate": 16,
    }
    values.update(overrides)
    return values


def test_patient_directory_and_vitals_are_derived_from_saved_records(client):
    first = client.post("/api/v1/risk/predict", json=payload())
    second = client.post(
        "/api/v1/risk/predict",
        json=payload(heart_rate=95, spo2=95),
    )
    assert first.status_code == second.status_code == 200

    directory = client.get("/api/v1/patients?limit=100")
    assert directory.status_code == 200
    match = next(item for item in directory.json()["items"] if item["patient_id"] == "DEMO-PHASE2-001")
    assert match["observation_count"] == 2
    assert match["latest_inputs"]["heart_rate"] == 95
    assert match["latest_observation_id"] == second.json()["observation_id"]

    detail = client.get("/api/v1/patients/DEMO-PHASE2-001")
    assert detail.status_code == 200
    assert detail.json()["age"] == 58

    history = client.get("/api/v1/patients/DEMO-PHASE2-001/vitals?limit=100")
    assert history.status_code == 200
    assert len(history.json()["items"]) == 2
    assert history.json()["items"][0]["heart_rate"] == 82
    assert history.json()["items"][1]["heart_rate"] == 95

    latest = client.get("/api/v1/patients/DEMO-PHASE2-001/vitals/latest")
    assert latest.status_code == 200
    assert latest.json()["heart_rate"] == 95


def test_patient_endpoints_return_404_when_no_records_exist(client):
    assert client.get("/api/v1/patients/UNKNOWN-DEMO").status_code == 404
    assert client.get("/api/v1/patients/UNKNOWN-DEMO/vitals/latest").status_code == 404


def test_trends_quality_and_timeline_endpoints(client):
    patient_id = "DEMO-PHASE2-ANALYTICS"
    client.post("/api/v1/risk/predict", json=payload(patient_id, heart_rate=80))
    client.post("/api/v1/risk/predict", json=payload(patient_id, heart_rate=105, spo2=93, respiratory_rate=24))

    trends = client.get("/api/v1/observations/trends", params={"patient_id": patient_id, "limit": 50})
    assert trends.status_code == 200
    body = trends.json()
    assert body["demo_only"] is True
    assert body["clinically_validated"] is False
    assert body["observation_count"] == 2
    heart_rate = next(item for item in body["trends"] if item["metric"] == "heart_rate")
    assert heart_rate["status"] == "ok"
    assert heart_rate["first_value"] == 80
    assert heart_rate["latest_value"] == 105
    assert heart_rate["direction"] == "increasing"

    quality = client.get("/api/v1/observations/quality", params={"stale_after_seconds": 300, "limit": 100})
    assert quality.status_code == 200
    match = next(item for item in quality.json()["items"] if item["patient_id"] == patient_id)
    assert match["status"] == "fresh"
    assert match["missing_fields"] == []

    timeline = client.get(f"/api/v1/patients/{patient_id}/timeline?limit=30")
    assert timeline.status_code == 200
    assert timeline.json()["count"] >= 2
    assert any(item["type"] == "observation" for item in timeline.json()["items"])
    # A synthetic score can cross the demo alert threshold, so the timeline may
    # also include alert/audit events for the same patient ID.


def test_model_evaluation_and_coefficients_are_explicitly_synthetic(client):
    report = client.get("/api/v1/model/evaluation")
    assert report.status_code == 200
    body = report.json()
    assert body["sample_count"] == 3000
    assert body["demo_only"] is True
    assert body["clinically_validated"] is False
    assert set(body["metrics"]) == {"accuracy", "precision", "recall", "f1", "roc_auc"}
    assert all(0 <= value <= 1 for value in body["metrics"].values())

    explanation = client.post("/api/v1/risk/explain", json=payload("DEMO-PHASE2-EXPLAIN"))
    assert explanation.status_code == 200
    explained = explanation.json()
    assert len(explained["contributions"]) == 7
    assert explained["demo_only"] is True
    assert "not SHAP" in explained["caveat"]


def test_news2_default_components_total_zero_and_scale2_requires_acknowledgement(client):
    news2_payload = {
        "patient_id": "DEMO-PHASE2-NEWS2",
        "respiratory_rate": 16,
        "spo2": 98,
        "systolic_bp": 120,
        "heart_rate": 80,
        "temperature": 37,
        "consciousness": "alert",
        "supplemental_oxygen": False,
        "spo2_scale": 1,
        "scale2_authorized": False,
    }
    response = client.post("/api/v1/scores/news2", json=news2_payload)
    assert response.status_code == 200
    assert response.json()["total_score"] == 0
    assert response.json()["clinically_validated_implementation"] is False
    assert response.json()["parameter_scores"]["supplemental_oxygen"] == 0

    news2_payload.update({"spo2_scale": 2, "spo2": 90})
    denied = client.post("/api/v1/scores/news2", json=news2_payload)
    assert denied.status_code == 422
    news2_payload["scale2_authorized"] = True
    allowed_demo = client.post("/api/v1/scores/news2", json=news2_payload)
    assert allowed_demo.status_code == 200
    assert allowed_demo.json()["spo2_scale"] == 2


def test_high_synthetic_prediction_creates_alert_and_audit_lifecycle(client):
    patient_id = "DEMO-PHASE2-ALERT"
    high = payload(
        patient_id,
        age=70,
        heart_rate=180,
        spo2=78,
        systolic_bp=80,
        diastolic_bp=50,
        temperature=39.5,
        respiratory_rate=34,
    )
    prediction = client.post("/api/v1/risk/predict", json=high)
    assert prediction.status_code == 200
    assert prediction.json()["risk_score"] >= 65

    alerts = client.get("/api/v1/alerts", params={"patient_id": patient_id, "limit": 10})
    assert alerts.status_code == 200
    assert alerts.json()["items"]
    alert_id = alerts.json()["items"][0]["id"]

    acknowledged = client.post(
        f"/api/v1/alerts/{alert_id}/acknowledge",
        json={"actor": "phase2-test-operator"},
    )
    assert acknowledged.status_code == 200
    assert acknowledged.json()["item"]["status"] == "acknowledged"

    resolved = client.post(
        f"/api/v1/alerts/{alert_id}/resolve",
        json={"actor": "phase2-test-operator"},
    )
    assert resolved.status_code == 200
    assert resolved.json()["item"]["status"] == "resolved"

    audit = client.get(f"/api/v1/alerts/{alert_id}/audit")
    assert audit.status_code == 200
    assert [item["action"] for item in audit.json()["items"]] == ["created", "acknowledged", "resolved"]

    timeline = client.get(f"/api/v1/patients/{patient_id}/timeline?limit=30")
    types = {item["type"] for item in timeline.json()["items"]}
    assert {"observation", "alert", "alert_audit"}.issubset(types)


def test_live_websocket_receives_persisted_observation_event(client):
    with client.websocket_connect("/api/v1/live") as websocket:
        connected = websocket.receive_json()
        assert connected["type"] == "connected"
        response = client.post("/api/v1/risk/predict", json=payload("DEMO-PHASE2-LIVE"))
        assert response.status_code == 200
        event = websocket.receive_json()
        assert event["type"] == "observation.created"
        assert event["patient_id"] == "DEMO-PHASE2-LIVE"
        assert event["event_id"] == response.json()["observation_id"]
        websocket.send_text("ping")
        assert websocket.receive_json()["type"] == "pong"

def test_news2_scale2_spo2_bands():
    from app.news2 import _spo2_scale2

    assert _spo2_scale2(83) == 3
    assert _spo2_scale2(84) == 2
    assert _spo2_scale2(86) == 1
    assert _spo2_scale2(88) == 0
    assert _spo2_scale2(92) == 0
    assert _spo2_scale2(93) == 1
    assert _spo2_scale2(95) == 2
    assert _spo2_scale2(97) == 3
