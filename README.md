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

Deployment smoke tests last passed on 2026-10-14 against the public Render URLs below; the links are stable unless the Render services are recreated.

The current `main` deployment's Phase 1 checks passed **28 frontend tests** and **17 backend tests**. The Phase 2 integration branch has since passed **32 frontend tests**, **25 backend tests**, type-checking, and production build. Phase 2 changes are not live until they are merged and Render redeploys.

- [Successful Phase 1 CI run](https://github.com/git-Abhihub/vitalpro/actions/runs/38540954917)
- [Successful Phase 1 Render smoke test](https://github.com/git-Abhihub/vitalpro/actions/runs/38540954959)
- [Phase 2 integration CI run](https://github.com/git-Abhihub/vitalpro/actions/runs/38550837702)
- [Phase 1 stabilisation report](VitalGuard-AI-main/PHASE1_AUDIT.md)
- [Phase 2 integration report](VitalGuard-AI-main/PHASE2_INTEGRATION_REPORT.md)

## Current deployment limitation

The backend currently uses SQLite on the hosted service's local filesystem. A Render PostgreSQL database has been provisioned but has **not yet been linked to the backend**; hosted demo history may be lost across restarts or redeploys. PostgreSQL persistence will be connected and tested in a subsequent phase.

The application is currently deployed in synthetic demo mode. Do not enter real patient data or use this prototype to diagnose, triage, or guide treatment.

## Project sources

The full application and local setup instructions are in the [VitalGuard-AI-main project folder](VitalGuard-AI-main/README.md).
