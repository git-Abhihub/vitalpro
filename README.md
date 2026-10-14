# VitalGuard AI

> **Hackathon demonstration only · Synthetic data · Not for clinical use**

VitalGuard AI is a prototype for exploring patient-observation monitoring, synthetic deterioration-risk signals, and alert workflows. The included model uses generated data and heuristic labels; it is not clinically validated.

## Live demo

- **[Open VitalGuard AI](https://vitalguard-ai-frontend.onrender.com)**
- [Backend health](https://vitalguard-risk-api-9vie.onrender.com/health)
- [FastAPI documentation](https://vitalguard-risk-api-9vie.onrender.com/docs)
- [Model metadata and limitations](https://vitalguard-risk-api-9vie.onrender.com/api/v1/model/info)
- [Render deployment smoke-test workflow](https://github.com/git-Abhihub/vitalpro/actions/workflows/render-smoke.yml)

## Verification status

The repository now includes per-patient vital progress, backend-backed cohort analytics, and a full patient-detail explorer. Selecting a patient opens a fictional profile and history (conditions, mock medications/allergies, procedural/family/social history, illustrative test results), followed by latest vitals, saved observation history, and visual trend charts with latest/min/mean/max/change summaries. Both persisted API patients and local simulator patients have detailed views.

- [Latest main CI](https://github.com/git-Abhihub/vitalpro/actions/runs/38587858799) — frontend type-check, tests, production build, and backend tests passed.
- [Latest Render smoke test](https://github.com/git-Abhihub/vitalpro/actions/runs/38587858853) — passed after the backend profile-only endpoint deployed; checks profile/test-result structure, per-patient progress, and persisted history.
- [Phase 2 API integration pull request](https://github.com/git-Abhihub/vitalpro/pull/2)
- [Phase 3 live dashboard updates pull request](https://github.com/git-Abhihub/vitalpro/pull/3)
- [Phase 4 synthetic monitor stream pull request](https://github.com/git-Abhihub/vitalpro/pull/4)
- [Phase 1 stabilisation report](VitalGuard-AI-main/PHASE1_AUDIT.md)
- [Phase 2 integration report](VitalGuard-AI-main/PHASE2_INTEGRATION_REPORT.md)
- [Phase 4 synthetic monitor stream report](VitalGuard-AI-main/PHASE4_SYNTHETIC_STREAM_REPORT.md)
- [Patient progress and analytics report](VitalGuard-AI-main/PHASE5_PATIENT_PROGRESS_ANALYTICS.md)
- [Full synthetic patient history and detail explorer](VitalGuard-AI-main/PHASE6_PATIENT_HISTORY_EXPLORER.md)

## Persistence

The backend uses the configured Render PostgreSQL database in the current live deployment. The API health endpoint reports `storage_backend: postgresql` and `persistent_storage_configured: true`, and the live smoke workflow verifies that synthetic prediction records can be retrieved from persisted history. The configured free database is scheduled to expire on **November 13, 2026**, so long-term storage beyond that date still needs a plan. This connection is for synthetic demonstration records only, not production patient records.

The frontend can switch between the persisted backend mode and the local synthetic simulator in Settings. Do not enter real patient data or use this prototype to diagnose, triage, or guide treatment.

## Project sources

The full application and local setup instructions are in the [VitalGuard-AI-main project folder](VitalGuard-AI-main/README.md).
