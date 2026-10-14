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

Phases 2–4 are merged into `main`. Phase 4 adds a synthetic monitor stream panel to backend API mode; the frontend was successfully redeployed at commit `5db4023beab4e03f827a3d6767fc39882bb9b053`. The latest main CI and Render smoke test passed. Smoke coverage includes frontend assets, API health/model metadata, CORS, synthetic prediction/history, model evaluation/contributions, NEWS2 demo scoring, trend/data-quality endpoints, and alert/timeline APIs.

- [Latest main CI](https://github.com/git-Abhihub/vitalpro/actions/runs/38558871128)
- [Latest successful Render smoke test](https://github.com/git-Abhihub/vitalpro/actions/runs/38558871163)
- [Phase 2 integration report](PHASE2_INTEGRATION_REPORT.md)
- [Phase 4 synthetic monitor stream report](PHASE4_SYNTHETIC_STREAM_REPORT.md)

**Persistence limitation:** the backend is still using SQLite on the hosted service filesystem. A Render PostgreSQL database is provisioned but has not been linked to the backend's `DATABASE_URL` yet; hosted demo history may be lost across restarts or redeploys. Link it in the backend service's private Render environment settings and rerun the smoke test before calling hosted persistence durable.

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
- Settings can switch between the local simulator and persisted backend API mode; the selected mode persists across refreshes, and API errors do not silently fall back to local data. In API mode, dashboard/patient-directory and patient-detail views show persisted backend patient summaries, vital history, observation/alert/audit timeline, data quality and descriptive trends. The local simulator cohort, risk charts and analytics still use local synthetic fixtures.
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

This is a one-observation-per-request simulator, not a continuous device feed. Each request creates a new observation; requests are not idempotent. The backend broadcasts saved observations and alerts over `/api/v1/live`, and the dashboard includes backend alert, history, timeline and trend views. Not all patient cards/charts are API-backed. Durable hosted PostgreSQL configuration remains outstanding.

## Important limitations

- Patient directory, vital charts, cohort analytics and some local alert cards still use local synthetic fixtures; backend history and alert operations are separate views.
- The model is a StandardScaler + LogisticRegression classifier trained on generated synthetic observations and heuristic labels. Its output is a demo signal, not a validated probability of clinical deterioration.
- Model evaluation metrics describe agreement with synthetic heuristic labels only. Coefficient contributions are not SHAP explanations or causal attributions.
- WebSocket fan-out is in-process and designed for a single backend instance. Hosted PostgreSQL, identity/role controls, and production operational safeguards remain deployment work.
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
