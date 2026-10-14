# Phase 5 — Patient Vital Progress and Data Analytics

**Status:** Implemented on `main`; CI and the live Render smoke workflow passed on October 14, 2026.

## Delivered

### Per-patient progress in the persisted patient directory

- Latest values for heart rate, SpO₂, blood pressure, temperature, and respiratory rate are visible alongside each patient's latest synthetic model score.
- A risk-score sparkline and progress bar summarise the recent sample series.
- The directory displays sample count, latest observation time, the previous-to-current score change when two or more samples exist, and a descriptive score direction.
- The backend patient and patient-detail APIs add a compact `progress` payload with up to 12 most recent saved observations in oldest-to-newest order: risk scores, heart rates, SpO₂, systolic blood pressure, timestamps, previous score, score delta, and direction. It is derived from persisted records using a single grouped query, not client-side mock data.
- The patient detail route continues to provide full saved history and descriptive vital-trend cards.

### Persisted-data analytics page

In backend API mode, **Analytics** now uses the backend patient, alert, and data-quality endpoints rather than displaying the local simulator cohort. It includes:
- patient count, returned saved-observation count, average latest synthetic score, and count of scores in the demo review band;
- score distribution and per-patient score direction;
- persisted alert lifecycle and data freshness/completeness charts;
- observation counts by patient, highest latest demo scores, and means of latest vital readings;
- an individual progress table with recent score trends, latest vitals, sample count, score delta, direction and last-observed time;
- manual refresh plus refresh-on-live-observation/alert-created events.

The local simulator analytics remain available when the frontend is switched to local demo mode.

### Verification

- Frontend type-check, unit tests and production build: [latest CI](https://github.com/git-Abhihub/vitalpro/actions/runs/38579449086) — passed.
- Backend test suite: same CI run — passed.
- Live deployment smoke workflow: [latest smoke run](https://github.com/git-Abhihub/vitalpro/actions/runs/38579449227) — passed. It creates two fictional observations, checks that the patient progress response contains the expected two-sample vital and risk series, and confirms both observation IDs are available from persisted history.
- Render deployment of frontend and backend at commit `446045b7a50aaffb9f0e6ee1fbdcce20468e1076`: both deploys reached `live`. A following workflow-only commit added stricter smoke coverage.

## Interpretation and limitations

This is tracking and descriptive analytics over **synthetic demo observations**. A rising or falling synthetic risk score is not a diagnosis, not a forecast of deterioration, and not a validated clinical threshold. Means and charts describe the stored sample, not medical reference ranges. The underlying model uses synthetic training labels and is not clinically validated. Do not enter real patient data or use this prototype for diagnosis, triage, or treatment decisions.

The configured Render PostgreSQL database is on a free plan scheduled to expire on November 13, 2026; a long-term database plan remains necessary. Authentication/authorization, real bedside-device ingestion, multi-instance event delivery and production healthcare security controls are outside this phase.
