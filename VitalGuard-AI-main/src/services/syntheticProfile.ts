import type { Patient } from '../types/index.ts';
import type { SyntheticPatientProfile } from './api.ts';

const FIRST = ['Aarav', 'Anaya', 'Arjun', 'Diya', 'Ishaan', 'Kavya', 'Meera', 'Neel', 'Riya', 'Vihaan', 'Aditi', 'Kabir', 'Mira', 'Reyansh', 'Sana', 'Vivaan'];
const LAST = ['Rao', 'Mehta', 'Iyer', 'Shah', 'Reddy', 'Kapoor', 'Nair', 'Patel', 'Menon', 'Verma', 'Das', 'Kulkarni', 'Bose', 'Malhotra', 'Joshi', 'Gupta'];
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CONDITIONS = [
  'Hypertension', 'Type 2 diabetes', 'Asthma', 'Migraine', 'Hypothyroidism',
  'Iron-deficiency anaemia', 'Gastro-oesophageal reflux', 'Seasonal allergic rhinitis',
  'Dyslipidaemia', 'No additional condition recorded',
];
const MEDICATIONS = [
  'Metformin — mock medication entry', 'Amlodipine — mock medication entry',
  'Levothyroxine — mock medication entry', 'Salbutamol inhaler — mock medication entry',
  'Atorvastatin — mock medication entry', 'No medication listed — demo placeholder',
  'Omeprazole — mock medication entry', 'Cetirizine — mock medication entry',
];
const ALLERGIES = [
  'Penicillin (mock entry)', 'Latex (mock entry)', 'Contrast agent (mock entry)',
  'Seasonal pollen (mock entry)', 'No known allergies (mock entry)',
];
const PANELS = [
  { name: 'Haemoglobin', panel: 'Complete blood count', unit: 'g/dL', low: 11, high: 15.5, min: 8.5, max: 17.5 },
  { name: 'White blood cells', panel: 'Complete blood count', unit: '10^9/L', low: 4, high: 11, min: 2, max: 18 },
  { name: 'Platelets', panel: 'Complete blood count', unit: '10^9/L', low: 150, high: 400, min: 80, max: 600 },
  { name: 'Glucose', panel: 'Metabolic panel', unit: 'mg/dL', low: 70, high: 140, min: 45, max: 260 },
  { name: 'Creatinine', panel: 'Renal panel', unit: 'mg/dL', low: 0.6, high: 1.3, min: 0.3, max: 3 },
  { name: 'Sodium', panel: 'Electrolytes', unit: 'mmol/L', low: 135, high: 145, min: 120, max: 160 },
  { name: 'Potassium', panel: 'Electrolytes', unit: 'mmol/L', low: 3.5, high: 5.1, min: 2.5, max: 6.5 },
  { name: 'C-reactive protein', panel: 'Inflammation panel', unit: 'mg/L', low: 0, high: 5, min: 0, max: 80 },
];

function hash(value: string) {
  let seed = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    seed ^= value.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function dateOf(value?: string) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function createLocalSyntheticProfile(
  patient: Patient,
  firstObservedAt?: string,
  lastObservedAt?: string,
): SyntheticPatientProfile {
  const seed = hash(patient.id);
  const pick = (offset: number, length: number) => ((seed >>> (offset % 24)) + offset * 13) % length;
  const first = dateOf(firstObservedAt);
  const last = dateOf(lastObservedAt ?? first.toISOString());
  const uniqueConditions = [...new Set([CONDITIONS[pick(2, 9)], CONDITIONS[pick(7, 9)]])];
  if (seed % 4 === 0) uniqueConditions.push(CONDITIONS[pick(13, 9)]);
  const conditions = seed % 13 === 0 ? ['No additional condition recorded'] : [...new Set(uniqueConditions)];
  const medicationCount = 1 + seed % 3;
  const medications = seed % 13 === 0
    ? [MEDICATIONS[5]]
    : Array.from({ length: medicationCount }, (_, index) => MEDICATIONS[pick(index * 5 + 2, 7)]);
  const allergies = [seed % 5 === 0 ? ALLERGIES[4] : ALLERGIES[pick(4, 4)]];
  const testResults = PANELS.map((spec, index) => {
    const value = Math.round((spec.min + (((pick(index * 3 + 2, 997) % 997) / 996) * (spec.max - spec.min))) * 10) / 10;
    return {
      test_id: `DEMO-LAB-${String(index + 1).padStart(2, '0')}`,
      name: spec.name,
      panel: spec.panel,
      result: value,
      unit: spec.unit,
      illustrative_band: `${spec.low}–${spec.high} ${spec.unit}`,
      illustrative_low: spec.low,
      illustrative_high: spec.high,
      display_min: spec.min,
      display_max: spec.max,
      collected_at: last.toISOString(),
      source: 'Generated synthetic lab result',
    };
  });
  const yearsBack = 1 + seed % 12;
  const admissionDate = new Date(first);
  admissionDate.setUTCDate(admissionDate.getUTCDate() - (1 + seed % 13));
  const conditionDetails = conditions.map((name, index) => ({
    name,
    status: name === 'No additional condition recorded' ? 'Demo placeholder' : index === 0 ? 'Long-term history' : 'History',
    noted_on: String(Math.max(2000, first.getUTCFullYear() - yearsBack + index)),
    note: 'Mock history entry for demonstration only.',
    source: 'Synthetic fixture — not patient-reported',
  }));
  const wardLabel = patient.ward;
  return {
    patient_id: patient.id,
    full_name: `${FIRST[seed % FIRST.length]} ${LAST[(seed >>> 8) % LAST.length]}`,
    age: patient.age,
    sex: patient.sex === 'M' ? 'Male' : 'Female',
    blood_group: BLOOD[(seed >>> 10) % BLOOD.length],
    height_cm: 150 + seed % 41,
    weight_kg: Math.round((48 + ((seed >>> 11) % 470) / 10) * 10) / 10,
    ward: wardLabel,
    bed: patient.bed,
    admission_date: admissionDate.toISOString().slice(0, 10),
    last_reviewed_at: last.toISOString(),
    admission_reason: 'Fictional admission summary created for interface demonstration; not derived from the vital signs.',
    conditions: conditionDetails,
    past_medical_history: conditions.filter((name) => name !== 'No additional condition recorded'),
    medications,
    allergies,
    procedures: [
      'Routine observation review (mock entry)',
      seed % 2 ? 'Fictional history: prior diagnostic imaging' : 'Illustrative outpatient follow-up (mock entry)',
    ],
    family_history: [seed % 2 ? 'Mock family-history entry: diabetes' : 'Mock family-history entry: cardiovascular history'],
    social_history: 'Fictional profile note: not supplied by a real patient.',
    care_notes: [
      'Demonstration note: review the displayed timeline and trend charts.',
      'Demonstration note: confirm data freshness before interpreting a visualisation.',
      'This note is generated placeholder text, not a care recommendation.',
    ],
    test_results: testResults,
    profile_notice: 'Every profile field (name, demographics, conditions, medications, allergies, history and laboratory values) is fictional synthetic content generated for the UI demo. None of it is a real medical record or clinical assessment. The displayed lab bands are illustrative UI references only, not diagnostic reference intervals.',
    demo_only: true,
    clinically_validated: false,
  };
}
