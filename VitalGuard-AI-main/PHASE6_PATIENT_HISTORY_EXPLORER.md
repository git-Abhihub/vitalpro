# Phase 6 — Full Synthetic Patient History and Detail Explorer

**Status:** Implemented on `main` and deployed to Render on October 14, 2026. Frontend CI and the live deployment smoke workflow passed after the backend rollout completed.

## Patient detail workspace

Selecting a patient from the directory opens a detailed patient interface with:

- **Profile and identity:** fictional full name, patient ID, age, sex, blood group, height, weight, ward/bed, admission date, and profile-review timestamp.
- **Medical-history sections:** mock admission reason, conditions/problem list, past medical history, medications, allergies, procedures/encounters, family history, social-history note, and demo notes.
- **Illustrative test results:** eight generated lab-style results across complete blood count, metabolic panel, renal panel, electrolytes, and inflammation. Each result is drawn on a horizontal visual scale with a clearly marked *illustrative UI band*. These bands are not diagnostic reference intervals.
- **Latest vitals:** heart rate, SpO₂, systolic/diastolic blood pressure, temperature, and respiratory rate, with the saved model signal and observation time.
- **Saved-observation history:** API mode continues to show the chronological values actually returned by the backend, along with alert/timeline and descriptive-trend sections.
- **Local-simulator history:** the local demo mode also displays a generated profile and visual vital analytics; its charts use the local simulator's fictional sample series.

## Vital graphs and analysis

The patient detail view now visualises separate time series for heart rate, oxygen saturation, systolic BP, diastolic BP, temperature, respiratory rate, and the synthetic model score. Each graph includes the latest value, min/mean/max across displayed observations, first-to-latest change, sample count, and a plain-language description of whether the observed series increased, decreased, stayed level, or lacks sufficient history.

The model-score series is labelled separately from measured vital signs. These summaries describe the displayed synthetic sample only; they do not forecast health or assign a diagnosis.

## Backend and test coverage

- `GET /api/v1/patients/{patient_id}` returns a persisted patient's vitals summary, progress history and fictional profile fixture.
- `GET /api/v1/patient-profiles/{patient_id}?age=...` creates a profile fixture for a local/demo patient even when no observation is yet persisted. The endpoint does not create a patient record or save a medical history.
- Frontend API-client test covers the unpersisted synthetic-profile request.
- Backend tests cover profile fields, generated lab values/visualisation bands, the persisted patient profile response, and the profile-only route.
- [Main CI — frontend lint/type-check, unit tests/build and backend tests](https://github.com/git-Abhihub/vitalpro/actions/runs/38587858799) — passed.
- [Live Render smoke test — patient progress, profile/test details and persistence](https://github.com/git-Abhihub/vitalpro/actions/runs/38587858853) — passed after the new backend route deployed. The first smoke attempt ran before that route reached Render and returned 404; the failed job was rerun after deployment and passed.

## Data-integrity and safety notes

Names, demographic details beyond the saved demo age, condition lists, medical/social/family history, medications, allergies, procedures, notes, and laboratory values are **fictional generated fixtures**. They are intentionally not saved into the database and are not derived from readings. A lab-style result is not an actual test result, and any displayed band is only a visual teaching aid. The live observation history contains synthetic observations. Do not enter real patient information or use VitalGuard AI for diagnosis, triage, or treatment decisions; the risk model and NEWS2 demonstration are not clinically validated.
