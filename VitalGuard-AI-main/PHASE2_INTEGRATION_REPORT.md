# VitalGuard AI — Phase 2 Integration Report

Date: 2026-10-14

## Status

**Code and automated CI checks pass on branch `phase-2-api-integration`.** Render production deployment verification is still pending because the current Render services deploy from `main` and the PostgreSQL connection has not yet been linked to the backend environment.

- Phase 2 CI run: https://github.com/git-Abhihub/vitalpro/actions/runs/38550837702
- Live frontend: https://vitalguard-ai-frontend.onrender.com
- API health: https://vitalguard-risk-api-9vie.onrender.com/health
- API docs: https://vitalguard-risk-api-9vie.onrender.com/docs

## Changes implemented

### Frontend/API integration
- Added typed frontend API models for persisted patient summaries and vital observations.
- Fixed patient-list query parameter construction.
- Added a backend-sourced patient directory and patient detail view, including the latest persisted observation, its history, a timeline, and descriptive observation trends.
- API mode now shows request failures rather than silently replacing backend data with local demo fixtures.
- Data source preference persists across browser refreshes and honors `VITE_DEMO_MODE` as the default.
- Empty backend patient directories include a direct link to Settings → Risk Engine to create a synthetic prediction.

### Backend
- Added patient directory, patient detail, latest-vitals, vital-history, and unified timeline endpoints based on persisted observations.
- Added descriptive trend and freshness/completeness endpoints.
- Added persistent demo alert creation, listing, acknowledgement/resolution transitions, and audit events.
- Added a single-process WebSocket event hub at `/api/v1/live`, including connected/ping-pong frames and broadcasts for persisted observations and alerts.
- Prediction and simulator routes now broadcast events and create demo alerts when the synthetic score crosses configured demo bands.
- Added deterministic synthetic holdout metrics and logistic-regression coefficient-contribution endpoints.
- Added a NEWS2 parameter-score demonstration endpoint with an explicit restriction gate for SpO2 Scale 2. This implementation is not clinically validated or approved.

### Tests
- Added backend integration tests for patient summaries/history, trend and data-quality APIs, timeline, synthetic evaluation/contributions, NEWS2, alert lifecycle/audit, and WebSocket events.
- Added frontend API-client tests for URL construction, encoded patient IDs, JSON prediction requests, and strict API error propagation.
- CI includes frontend dependency installation, lint/type-check, unit tests and production build plus backend pytest.

## Verification result

GitHub Actions run: https://github.com/git-Abhihub/vitalpro/actions/runs/38550837702

| Check | Result |
| --- | --- |
| Frontend lint/type-check | Passed |
| Frontend unit tests | Passed — 32 tests |
| Frontend production build | Passed — 2,774 modules transformed |
| Backend tests | Passed — 25 tests |
| CI jobs | Both passed |

Non-blocking warnings remain: the production JavaScript bundle is approximately 792 kB before gzip (above Vite's 500 kB advisory threshold), and Starlette reports a TestClient/httpx deprecation warning.

## Deployment actions still required

1. Merge this branch only after the code review/CI checks remain green.
2. Allow the Render frontend and API services to redeploy from `main`.
3. Run the updated Render smoke workflow against the deployed services. It exercises API health, model metadata, CORS, prediction persistence, NEWS2, trend/data quality, alert lifecycle/audit, and other demo endpoints.
4. Link the existing Render PostgreSQL database to the backend service using Render's private environment settings. The available Render integration can provision/query the database and edit literal environment values, but it does not expose a safe linked-database environment-variable operation or the database connection secret. Therefore `DATABASE_URL` is **not yet configured on the hosted service**. Until an operator links it in Render, the backend falls back to SQLite and hosted history may be lost on restart/redeploy.
5. Verify `/health` reports PostgreSQL storage after the link, and rerun the live smoke workflow.

## Remaining boundaries

- The demo classifier still trains on generated observations with heuristic labels.
- The NEWS2 endpoint is a prototype scoring implementation and not a validated clinical tool.
- WebSocket fan-out is in memory for one backend process, not a durable multi-instance event stream.
- Local cohort fixtures, charts, and some alert cards remain distinct from persisted backend records; the new API mode makes that distinction explicit.
- There is no verified clinical outcome, clinical validation, staff authentication/role control, or production patient-record safeguard.

**Conclusion:** Phase 2 software integration checks are green in CI. Phase 2 should be called fully deployed only after the merged Render release smoke test passes and PostgreSQL linkage is verified.
