# VitalGuard AI

> **Hackathon demonstration only · Synthetic data · Not for clinical use**

VitalGuard AI is a prototype for exploring patient-observation monitoring, synthetic deterioration-risk signals, and alert workflows. The included model uses generated data and heuristic labels; it is not clinically validated.

## Live demo

- **[Open VitalGuard AI](https://vitalguard-ai-frontend.onrender.com)**
- [Backend health](https://vitalguard-risk-api-9vie.onrender.com/health)
- [FastAPI documentation](https://vitalguard-risk-api-9vie.onrender.com/docs)
- [Model metadata and limitations](https://vitalguard-risk-api-9vie.onrender.com/api/v1/model/info)
- [Render deployment smoke-test results](https://github.com/git-Abhihub/vitalpro/actions/workflows/render-smoke.yml)

## Verification status

**Phases 2–4 are merged into `main`; the Phase 4 frontend bundle is deployed to Render.** The latest main CI passed frontend type-check, tests and production build plus backend tests. The latest Render smoke workflow passed frontend asset checks and backend regression checks for synthetic predictions, history, NEWS2 demo scoring, trends, data quality, alerts/audit, and patient timelines.

- [Latest successful main CI run](https://github.com/git-Abhihub/vitalpro/actions/runs/38558871128)
- [Latest successful Render smoke test](https://github.com/git-Abhihub/vitalpro/actions/runs/38558871163)
- [Phase 2 API integration pull request](https://github.com/git-Abhihub/vitalpro/pull/2)
- [Phase 3 live dashboard updates pull request](https://github.com/git-Abhihub/vitalpro/pull/3)
- [Phase 4 synthetic monitor stream pull request](https://github.com/git-Abhihub/vitalpro/pull/4)
- [Phase 1 stabilisation report](VitalGuard-AI-main/PHASE1_AUDIT.md)
- [Phase 2 integration report](VitalGuard-AI-main/PHASE2_INTEGRATION_REPORT.md)
- [Phase 4 synthetic monitor stream report](VitalGuard-AI-main/PHASE4_SYNTHETIC_STREAM_REPORT.md)

## Current deployment limitation

The backend is **still using SQLite on the hosted service's local filesystem**. A Render PostgreSQL database has been provisioned but is not linked to the backend's `DATABASE_URL` yet. Hosted demo history may therefore be lost across restarts or redeploys. PostgreSQL linkage and a post-link smoke test are the remaining deployment tasks.

The frontend is configured to start in backend API mode; users can switch to local synthetic demo data in Settings. Do not enter real patient data or use this prototype to diagnose, triage, or guide treatment.

## Project sources

The full application and local setup instructions are in the [VitalGuard-AI-main project folder](VitalGuard-AI-main/README.md).
