# VitalGuard AI — Patient Deterioration Early-Warning Prototype

> **DEMO ONLY · SYNTHETIC DATA · NOT FOR CLINICAL USE**
>
> VitalGuard AI is a software prototype for exploring patient-observation monitoring, risk-signal visualisation and alert workflows. The included patients and observations are synthetic. The current risk model is trained on generated data and is not clinically validated.

## Live deployment

The demo frontend and synthetic risk API are deployed on Render:

- **Frontend:** https://vitalguard-ai-frontend.onrender.com
- **API health:** https://vitalguard-risk-api-9vie.onrender.com/health
- **API documentation:** https://vitalguard-risk-api-9vie.onrender.com/docs
- **Model metadata:** https://vitalguard-risk-api-9vie.onrender.com/api/v1/model/info
- **Render deployment smoke workflow:** https://github.com/git-Abhihub/vitalpro/actions/workflows/render-smoke.yml

Phases 2–4 are merged into `main`. Phase 5 adds persisted per-patient vital progress and a backend-backed Analytics view. The directory now shows each patient's latest vital readings, a recent synthetic-score sparkline/progress bar, sample count, last-observed time, and change from the previous score when history is available. In backend API mode, Analytics reads saved patient summaries, alert lifecycle, and data freshness from the backend instead of mixing in the local simulator cohort.

- [Latest main CI](https://github.com/git-Abhihub/vitalpro/actions/runs/38579449086) — frontend type-check, tests, production build and backend tests passed.
- [Latest Render smoke test](https://github.com/git-Abhihub/vitalpro/actions/runs/38579449227) — live API progress-series and persisted-history checks passed.
- [Phase 2 integration report](PHASE2_INTEGRATION_REPORT.md)
- [Phase 4 synthetic monitor stream report](PHASE4_SYNTHETIC_STREAM_REPORT.md)
- [Phase 5 patient progress and analytics report](PHASE5_PATIENT_PROGRESS_ANALYTICS.md)

**Persistence:** the deployed backend uses Render PostgreSQL and the health/smoke checks verify this configuration and persisted synthetic prediction history. The current free database is scheduled to expire on **November 13, 2026**, so long-term storage beyond the free-instance expiry still needs a plan.

The frontend starts in backend API mode, with local synthetic demo mode still selectable in Settings. The model and NEWS2 demonstration are not clinically validated and must not be used for diagnosis, triage, or treatment decisions.

## Requirements

- Node.js 20 or newer (Node.js 22 LTS recommended)
- npm 10 or newer
- Python 3.11+ recommended for the FastAPI backend

## Quick start

Frontend:
```bash
npm ci
cp .env.example .env
npm run dev
```

Backend (from the repository root):
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
uvicorn app.main:app --reload
```

The frontend normally runs at `http://localhost:5173`; the backend at `http://localhost:8000`. API docs are at `http://localhost:8000/docs`.

## Verification commands

Run from the project root:
```bash
npm run lint
npm test
npm run build
```

Run backend tests from `backend/`:
```bash
pytest -q
```

Only describe a command as passing after it has been run successfully against the current source.

## Environment configuration

Copy `.env.example` to `.env` for local development. Vite variables prefixed with `VITE_` are bundled into browser code, so never store secrets in them.

| Variable | Purpose |
| --- | --- |
| `VITE_DEMO_MODE` | Starts in synthetic demo mode unless explicitly set to `false`. |
| `VITE_API_BASE_URL` | Optional FastAPI base URL; local default is normally `http://localhost:8000`. |
| `VITE_APP_VERSION` | Frontend version label. |
| `DATABASE_URL` | Optional backend database URL; SQLite is used by default. |
| `VITALGUARD_DB_PATH` | Optional local SQLite file path for tests/development. |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins. |

## Current implementation

- React, TypeScript, Vite and Tailwind frontend with dashboard, patient directory/detail, alerts, analytics and settings.
- Existing synthetic patient records, demo simulation controls and local UI persistence.
- FastAPI synthetic risk endpoint, model metadata, deterministic holdout evaluation, coefficient-contribution explanation, bounded observation history and observation quality endpoint.
- SQLAlchemy storage adapter supports local SQLite and PostgreSQL when `DATABASE_URL` is configured. A hosted PostgreSQL instance is not yet confirmed in the live deployment.
- WebSocket event delivery for persisted observations and alerts, with a reconnecting frontend client.
- Persistent demo alert lifecycle (open, acknowledged, resolved) with audit trail.
- Settings can switch between the local simulator and persisted backend API mode; the selected mode persists across refreshes, and API errors do not silently fall back to local data. In API mode, the dashboard/patient directory and patient detail show persisted backend summaries, saved vital history, observation/alert/audit timeline, data quality and descriptive trends. The API-mode Analytics route now uses saved patient summaries, alert lifecycle and data-freshness endpoints; local simulator mode retains its local synthetic cohort analytics.
- Patient directory progress payload includes recent persisted risk-score, HR, SpO₂ and systolic BP series, score direction/delta and timestamps. The directory displays latest vital values, a score sparkline/progress bar, observation count and last observed time for each synthetic patient.
- Interactive model evaluation and coefficient-contribution workbench in Settings.
- Source-documented NEWS2 parameter scoring demo endpoint (`POST /api/v1/scores/news2`) and Settings calculator; this is not a clinically validated or approved implementation.
- Unified persisted patient timeline (`GET /api/v1/patients/{patient_id}/timeline`) and descriptive trend endpoint (`GET /api/v1/observations/trends?patient_id=...`).
- Deterministic simulator endpoint for stable, worsening, and recovering fictional observation scenarios.
- API dashboard includes a start/pause synthetic monitor stream that submits fictional readings through the backend every five seconds and refreshes subscribed views over the WebSocket. It does not connect to physical bedside equipment.

### Phase 1 API: synthetic observation ingestion

Endpoint:
`POST /api/v1/demo/observations`

Example request:
```json
{
  "patient_id": "DEMO-LIVE-001",
  "scenario": "worsening",
  "step": 3
}
```

Supported scenarios: `stable`, `worsening`, `recovering`. Step must be between 0 and 1000. The endpoint generates one deterministic observation for the requested scenario and step, runs the current synthetic risk model, and persists the resulting observation/prediction using the configured storage adapter.

Example local request:
```bash
curl -X POST http://localhost:8000/api/v1/demo/observations \
  -H 'Content-Type: application/json' \
  -d '{"patient_id":"DEMO-LIVE-001","scenario":"worsening","step":3}'
```

History can be inspected at:
`GET /api/v1/observations?patient_id=DEMO-LIVE-001`

This is a one-observation-per-request simulator, not a continuous device feed. Each request creates a new observation; requests are not idempotent. The backend broadcasts saved observations and alerts over `/api/v1/live`. API-mode patient directory progress, patient detail, and cohort analytics use persisted backend records; local simulator mode still uses local synthetic fixtures.

## Important limitations

- Local simulator mode's patient cohort, vital charts, cohort analytics and some alert cards use local synthetic fixtures; the persisted backend mode is a separate synthetic observation cohort.
- The model is a StandardScaler + LogisticRegression classifier trained on generated synthetic observations and heuristic labels. Its output is a demo signal, not a validated probability of clinical deterioration.
- Model evaluation metrics describe agreement with synthetic heuristic labels only. Coefficient contributions are not SHAP explanations or causal attributions.
- WebSocket fan-out is in-process and designed for a single backend instance. Identity/role controls and production operational safeguards remain deployment work. The hosted PostgreSQL instance is free and has a scheduled expiry date (November 13, 2026).
- The NEWS2 scoring endpoint follows parameter bands from the RCP chart for demonstration, but the implementation is not clinically validated or approved. The existing local NEWS2-like display also remains a separate synthetic fixture.
- No clinical performance, safety, regulatory or real-device integration is claimed.
- Do not use real patient data or use this prototype to diagnose, triage, or make treatment decisions.

## Project layout

```text
backend/app/
  main.py              FastAPI application
  model.py             Synthetic demo classifier
  schemas.py           Validated API request/response schemas
  simulator.py         Deterministic fictional observation scenarios
  simulator_routes.py  Demo observation ingestion endpoint
  patient_routes.py   Persisted patient directory, vitals and timeline
  analytics_routes.py Observation trend and data-quality endpoints
  alert_routes.py     Alert lifecycle and audit API
  model_routes.py     Synthetic evaluation and coefficient contributions
  live.py             Single-process WebSocket event hub
  news2.py             NEWS2 parameter scoring demonstration
  storage.py           SQLite/PostgreSQL storage adapter
backend/tests/
  test_api.py
  test_simulator.py
  test_phase2_integration.py
src/
  data/                Synthetic frontend fixtures
  pages/               Dashboard and feature pages
  services/            API and demo data services
  store/               Frontend state
  test/                Frontend tests, including API-client integration checks
docs/
  REALTIME_DEMO_ROADMAP.md
```

## Database configuration

- Local development defaults to SQLite.
- Hosted deployments can set `DATABASE_URL` to a PostgreSQL connection string. The adapter normalizes common `postgres://` and `postgresql://` URLs to psycopg 3.
- Configure credentials only in the backend service's private environment settings; do not commit them.
- Provision the hosted database separately. Existing SQLite records are not automatically migrated.
- This storage adapter currently supports synthetic demonstration data only; it is not a production patient-record system.

## Live API smoke test

Run `npm run smoke:api` to check health, model metadata, frontend CORS preflight, synthetic prediction and persistence, model evaluation, coefficient contributions, NEWS2 scoring/Scale 2 guard, data quality, alert acknowledgement/resolution and audit trail. This writes fictional records to the configured demo database.

- Workflow: `.github/workflows/live-api-smoke.yml`
- Script: `scripts/smoke-test.mjs`
- Run via GitHub Actions → Live API smoke test → Run workflow.
- The workflow creates synthetic demo records; never send real patient data.

## Phase 2 integration report

See [PHASE2_INTEGRATION_REPORT.md](PHASE2_INTEGRATION_REPORT.md) for the patient API integration, alert lifecycle and audit events, WebSocket fan-out, analytics, API client tests, CI results, and current deployment blockers.

## Roadmap

See [docs/REALTIME_DEMO_ROADMAP.md](docs/REALTIME_DEMO_ROADMAP.md) for phases, acceptance criteria, and current limitations. See [docs/RENDER_RELEASE_RUNBOOK.md](docs/RENDER_RELEASE_RUNBOOK.md) for the actual Render service branches, deploy verification, and release smoke-test procedure. The delivered phase status and remaining deployment requirements are tracked in the roadmap. Hosted PostgreSQL, identity/access controls, cross-instance event delivery, and any clinically meaningful model remain outstanding.
