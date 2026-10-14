# VitalGuard AI — Phase 2 Integration Report

Date: 2026-10-14

## Status

**Phase 2 is merged into `main`, deployed to Render, and has passed CI and the live Render smoke test.** The remaining deployment blocker is PostgreSQL linkage: the API still reports/uses SQLite because the backend's `DATABASE_URL` has not been configured to reference the provisioned Render PostgreSQL instance.

- Merged PR: https://github.com/git-Abhihub/vitalpro/pull/2
- Latest main CI: https://github.com/git-Abhihub/vitalpro/actions/runs/38552217294
- Latest successful Render smoke test: https://github.com/git-Abhihub/vitalpro/actions/runs/38552217384
- Live frontend: https://vitalguard-ai-frontend.onrender.com
- API health: https://vitalguard-risk-api-9vie.onrender.com/health
- API docs: https://vitalguard-risk-api-9vie.onrender.com/docs
- Model metadata: https://vitalguard-risk-api-9vie.onrender.com/api/v1/model/info

## Changes implemented

### Frontend/API integration
- Added typed frontend API models for persisted patient summaries and vital observations.
- Fixed patient-list query parameter construction.
- Added a backend-sourced patient directory and patient detail view, including the latest persisted observation, its history, a timeline, and descriptive observation trends.
- API mode now shows request failures rather than silently replacing backend data with local demo fixtures.
- Data source preference persists across browser refreshes and honours `VITE_DEMO_MODE` as the default.
- Empty backend patient directories include a direct link to Settings → Risk Engine to create a synthetic prediction.
- Configured the deployed frontend to start in API mode; the demo mode remains selectable in Settings.

### Backend
- Added patient directory, patient detail, latest-vitals, vital-history, and unified timeline endpoints based on persisted observations.
- Added descriptive trend and freshness/completeness endpoints.
- Added persistent demo alert creation, listing, acknowledgement/resolution transitions, and audit events.
- Added a single-process WebSocket event hub at `/api/v1/live`, including connected/ping-pong frames and broadcasts for persisted observations and alerts.
- Prediction and simulator routes now broadcast events and create demo alerts when the synthetic score crosses configured demo bands.
- Added deterministic synthetic holdout metrics and logistic-regression coefficient-contribution endpoints.
- Added a NEWS2 parameter-score demonstration endpoint with an explicit restriction gate for SpO₂ Scale 2. This implementation is not clinically validated or approved.

### Tests
- Added backend integration tests for patient summaries/history, trend and data-quality APIs, timeline, synthetic evaluation/contributions, NEWS2, alert lifecycle/audit, and WebSocket events.
- Added frontend API-client tests for URL construction, encoded patient IDs, JSON prediction requests, and strict API error propagation.
- CI includes frontend dependency installation, lint/type-check, unit tests and production build plus backend pytest.

## Verification result

Latest main CI: https://github.com/git-Abhihub/vitalpro/actions/runs/38552217294

Latest live Render smoke test: https://github.com/git-Abhihub/vitalpro/actions/runs/38552217384

| Check | Result |
| --- | --- |
| Frontend lint/type-check | Passed |
| Frontend unit tests | Passed — 32 tests |
| Frontend production build | Passed — 2,774 modules transformed |
| Backend tests | Passed — 25 tests |
| Live frontend asset check | Passed |
| Live API smoke checks | Passed — prediction, history, trends, quality, NEWS2 demo scoring, model evaluation/contributions, alert lifecycle/audit, and patient timeline |
| CI jobs | Both passed |

Non-blocking warnings remain: the production JavaScript bundle is approximately 792 kB before gzip (above Vite's 500 kB advisory threshold), and Starlette reports a TestClient/httpx deprecation warning.

## Remaining deployment action: link PostgreSQL

A Render PostgreSQL 16 database is provisioned at https://dashboard.render.com/d/dpg-db7ka849v7es73ccefsg-a, but it has not been linked to the backend environment.

The Render integration available to this workflow can list and inspect services/databases and set literal environment variables, but it does not expose a safe linked-database reference operation or the database connection secret. I have therefore **not guessed or hard-coded a database URL**.

To finish durable persistence:
1. Open the [backend Render service](https://dashboard.render.com/web/srv-db7kb0bbc2fs73fh4180).
2. In the service's private environment settings, add/link `DATABASE_URL` to the provisioned `vitalguard-ai-db` database using Render's native database connection option. Do not expose the connection string in source code.
3. Redeploy the backend.
4. Verify `/health` reports `storage_backend: postgresql` and `persistent_storage_configured: true`.
5. Run the [Render smoke workflow](https://github.com/git-Abhihub/vitalpro/actions/workflows/render-smoke.yml) again.

Until this is complete, hosted demo history is stored in SQLite on the service filesystem and may be lost on restart/redeploy.

## Remaining boundaries

- The demo classifier still trains on generated observations with heuristic labels.
- The NEWS2 endpoint is a prototype scoring implementation, not a clinically validated/approved tool.
- WebSocket fan-out is in memory for one backend process, not a durable multi-instance event stream.
- Local cohort fixtures, charts, and some alert cards remain distinct from persisted backend records; API mode makes that distinction explicit.
- There is no verified clinical outcome, clinical validation, staff authentication/role control, or production patient-record safeguard.

**Conclusion:** Phase 2 software integration is passing in CI and the public Render smoke test. PostgreSQL linkage and a post-link persistence test remain before hosted persistence can be considered durable. This prototype is not for real patient diagnosis, triage, or treatment.
