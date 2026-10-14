# VitalGuard AI — Phase 1 Stabilisation Report

Date: 2026-10-14

## Scope

Phase 1 establishes a reproducible CI baseline for the existing application without changing product logic or the UI. This is a software-quality check, not clinical validation or a full browser/deployment sign-off.

## Findings

- The application is stored inside `VitalGuard-AI-main/`, not at the repository root.
- GitHub Actions only discovers workflow definitions under the repository-root `.github/workflows/` directory. The previously nested workflow files were not being discovered automatically, and the repository had no recorded workflow runs at the time of inspection.
- Local verification attempts against the packaged environment had previously failed because a platform-specific Rollup optional dependency was missing; a clean dependency installation had timed out in that environment.
- The `lint` script type-checks both the application project and the Vite configuration project.
- The current production bundle succeeds but emits a warning that its JavaScript chunk is larger than 500 kB.
- Frontend tests also log a chart-size warning in the test DOM. Backend tests emit a Starlette/httpx deprecation warning. These are non-fatal and should be tracked for later cleanup.

## Changes in Phase 1 branch

- Added a repository-root workflow at `.github/workflows/phase1-ci.yml` so GitHub can detect and run the checks despite the nested application directory.
- Configured the workflow to run frontend dependency installation, type-check/lint, unit tests, and production build from `VitalGuard-AI-main/`.
- Configured the workflow to install backend dependencies and run the backend API/simulator tests from the correct nested path.
- Kept the application features and visual design unchanged.

## Verification

GitHub Actions run: https://github.com/git-Abhihub/vitalpro/actions/runs/38536005870

| Check | Result |
| --- | --- |
| Frontend `npm ci` | Passed |
| Frontend `npm run lint` | Passed |
| Frontend `npm test` | Passed — 28 tests across 7 files |
| Frontend `npm run build` | Passed — 2,772 modules transformed |
| Backend dependency installation | Passed |
| Backend `pytest backend/tests -q` | Passed — 17 tests |

The backend run reported one non-fatal Starlette/httpx deprecation warning. The frontend build reported a >500 kB JavaScript chunk warning, and UI tests emitted chart-dimension warnings.

## Not yet verified

- Render deployment from the current Phase 1 branch.
- A real-browser end-to-end run from the current branch.
- Live frontend-to-backend operation against a freshly deployed backend.
- Persistent hosted PostgreSQL configuration.

## Deferred to later phases

- Risk score still comes from a synthetic model trained on heuristic-generated labels.
- The clinical validity of NEWS2 scoring is not established by Phase 1.
- Some dashboard cohort data still comes from local synthetic fixtures.
- Server-side identity/role controls and production clinical safeguards are not present.

**Conclusion:** the Phase 1 CI baseline is green. The project should not be described as clinically validated or production-ready on the basis of these software tests.