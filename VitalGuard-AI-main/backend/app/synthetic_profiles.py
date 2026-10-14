"""Stable fictional patient-profile fixtures for the VitalGuard demonstration UI.

Profiles are generated from the synthetic patient ID only. They are not imported
from records and are never evidence about an actual person.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

FIRST_NAMES = (
    "Aarav", "Anaya", "Arjun", "Diya", "Ishaan", "Kavya", "Meera", "Neel",
    "Riya", "Vihaan", "Aditi", "Kabir", "Mira", "Reyansh", "Sana", "Vivaan",
)
LAST_NAMES = (
    "Rao", "Mehta", "Iyer", "Shah", "Reddy", "Kapoor", "Nair", "Patel",
    "Menon", "Verma", "Das", "Kulkarni", "Bose", "Malhotra", "Joshi", "Gupta",
)
SEXES = ("Female", "Male", "Female", "Male", "Non-binary")
BLOOD_GROUPS = ("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")
WARDS = ("North Ward", "South Ward", "Cardiac Observation", "Medical Unit", "Respiratory Unit", "General Care")
CONDITIONS = (
    ("Hypertension", "Long-term history", "Mock history entry for demonstration only."),
    ("Type 2 diabetes", "Long-term history", "Mock history entry for demonstration only."),
    ("Asthma", "History", "Mock history entry for demonstration only."),
    ("Migraine", "History", "Mock history entry for demonstration only."),
    ("Hypothyroidism", "Long-term history", "Mock history entry for demonstration only."),
    ("Iron-deficiency anaemia", "History", "Mock history entry for demonstration only."),
    ("Gastro-oesophageal reflux", "History", "Mock history entry for demonstration only."),
    ("Seasonal allergic rhinitis", "History", "Mock history entry for demonstration only."),
    ("Dyslipidaemia", "Long-term history", "Mock history entry for demonstration only."),
    ("No additional condition recorded", "Demo placeholder", "No clinical inference; fixture text only."),
)
ALLERGIES = ("Penicillin (mock entry)", "Latex (mock entry)", "Contrast agent (mock entry)", "Seasonal pollen (mock entry)", "No known allergies (mock entry)")
MEDICATIONS = (
    "Metformin — mock medication entry",
    "Amlodipine — mock medication entry",
    "Levothyroxine — mock medication entry",
    "Salbutamol inhaler — mock medication entry",
    "Atorvastatin — mock medication entry",
    "No medication listed — demo placeholder",
    "Omeprazole — mock medication entry",
    "Cetirizine — mock medication entry",
)
PROCEDURES = (
    "Routine observation review (mock entry)",
    "Illustrative outpatient follow-up (mock entry)",
    "Fictional history: prior diagnostic imaging",
    "No prior procedure listed — demo placeholder",
)
FAMILY_HISTORY = (
    "Mock family-history entry: cardiovascular history",
    "Mock family-history entry: diabetes",
    "Mock family-history entry: asthma/allergy",
    "No family history entered — demo placeholder",
)
LAB_SPECS = (
    ("Haemoglobin", "Complete blood count", "g/dL", 11.0, 15.5, 8.5, 17.5),
    ("White blood cells", "Complete blood count", "10^9/L", 4.0, 11.0, 2.0, 18.0),
    ("Platelets", "Complete blood count", "10^9/L", 150.0, 400.0, 80.0, 600.0),
    ("Glucose", "Metabolic panel", "mg/dL", 70.0, 140.0, 45.0, 260.0),
    ("Creatinine", "Renal panel", "mg/dL", 0.6, 1.3, 0.3, 3.0),
    ("Sodium", "Electrolytes", "mmol/L", 135.0, 145.0, 120.0, 160.0),
    ("Potassium", "Electrolytes", "mmol/L", 3.5, 5.1, 2.5, 6.5),
    ("C-reactive protein", "Inflammation panel", "mg/L", 0.0, 5.0, 0.0, 80.0),
)


def _parse_time(value: str | None) -> datetime:
    if value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed
        except (TypeError, ValueError):
            pass
    return datetime.now(timezone.utc)


def _stable_index(seed: int, index: int, length: int) -> int:
    return (seed >> (index * 3 % 24)) % length


def build_synthetic_profile(
    patient_id: str,
    age: int | None,
    first_observed_at: str | None,
    last_observed_at: str | None,
) -> dict[str, Any]:
    """Return a stable, explicitly fictional UI profile for a saved demo patient."""
    seed = int(hashlib.sha256(patient_id.encode("utf-8")).hexdigest()[:8], 16)
    first = _parse_time(first_observed_at)
    last = _parse_time(last_observed_at)
    name = f"{FIRST_NAMES[seed % len(FIRST_NAMES)]} {LAST_NAMES[(seed >> 8) % len(LAST_NAMES)]}"
    chosen_conditions = [
        CONDITIONS[(seed >> shift) % (len(CONDITIONS) - 1)]
        for shift in (1, 6)
    ]
    if seed % 4 == 0:
        chosen_conditions.append(CONDITIONS[(seed >> 12) % (len(CONDITIONS) - 1)])
    # Keep fixture condition names unique in case the deterministic indexes collide.
    unique_conditions = list(dict.fromkeys(chosen_conditions))
    if seed % 13 == 0:
        unique_conditions = [CONDITIONS[-1]]
    conditions = [
        {
            "name": name_value,
            "status": status,
            "noted_on": str(max(2000, first.year - 1 - ((seed >> (i + 2)) % 12))),
            "note": note,
            "source": "Synthetic fixture — not patient-reported",
        }
        for i, (name_value, status, note) in enumerate(unique_conditions)
    ]

    medication_count = 1 + (seed % 3)
    medications = [
        MEDICATIONS[(seed >> (i * 5 + 2)) % (len(MEDICATIONS) - 1)]
        for i in range(medication_count)
    ]
    if seed % 13 == 0:
        medications = [MEDICATIONS[-1]]

    allergies = [ALLERGIES[(seed >> 4) % (len(ALLERGIES) - 1)]]
    if seed % 5 == 0:
        allergies = [ALLERGIES[-1]]

    test_results = []
    for i, (test_name, panel, unit, demo_low, demo_high, generation_low, generation_high) in enumerate(LAB_SPECS):
        fraction = ((_stable_index(seed, i + 4, 997) % 997) / 996)
        result = round(generation_low + fraction * (generation_high - generation_low), 1)
        test_results.append({
            "test_id": f"DEMO-LAB-{i + 1:02d}",
            "name": test_name,
            "panel": panel,
            "result": result,
            "unit": unit,
            "illustrative_band": f"{demo_low:g}–{demo_high:g} {unit}",
            "illustrative_low": demo_low,
            "illustrative_high": demo_high,
            "display_min": generation_low,
            "display_max": generation_high,
            "collected_at": last.isoformat(),
            "source": "Generated synthetic lab result",
        })

    admission = first - timedelta(days=1 + seed % 13)
    return {
        "patient_id": patient_id,
        "full_name": name,
        "age": age,
        "sex": SEXES[(seed >> 5) % len(SEXES)],
        "blood_group": BLOOD_GROUPS[(seed >> 10) % len(BLOOD_GROUPS)],
        "height_cm": 150 + (seed % 41),
        "weight_kg": round(48 + ((seed >> 11) % 470) / 10, 1),
        "ward": WARDS[(seed >> 13) % len(WARDS)],
        "bed": f"{1 + ((seed >> 17) % 42):02d}",
        "admission_date": admission.date().isoformat(),
        "last_reviewed_at": last.isoformat(),
        "admission_reason": (
            "Fictional admission summary created for interface demonstration; "
            "not derived from the vital signs."
        ),
        "conditions": conditions,
        "past_medical_history": [
            item["name"] for item in conditions if item["status"] != "Demo placeholder"
        ],
        "medications": medications,
        "allergies": allergies,
        "procedures": [
            PROCEDURES[(seed >> 14) % len(PROCEDURES)],
            PROCEDURES[(seed >> 19) % len(PROCEDURES)],
        ],
        "family_history": [FAMILY_HISTORY[(seed >> 7) % len(FAMILY_HISTORY)]],
        "social_history": "Fictional profile note: not supplied by a real patient.",
        "care_notes": [
            "Demonstration note: review the displayed timeline and trend charts.",
            "Demonstration note: confirm data freshness before interpreting a visualisation.",
            "This note is generated placeholder text, not a care recommendation.",
        ],
        "test_results": test_results,
        "profile_notice": (
            "Every profile field on this page (name, demographics, conditions, "
            "medications, allergies, history and laboratory values) is fictional "
            "synthetic content generated for the UI demo. None of it is a real "
            "medical record or clinical assessment. The displayed lab bands are "
            "illustrative UI references only, not diagnostic reference intervals."
        ),
        "demo_only": True,
        "clinically_validated": False,
    }
