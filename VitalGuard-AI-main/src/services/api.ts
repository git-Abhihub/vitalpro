import { APP_CONFIG } from './config.ts';

export interface RiskPredictionInput {
  patient_id: string;
  age: number;
  heart_rate: number;
  spo2: number;
  systolic_bp: number;
  diastolic_bp: number;
  temperature: number;
  respiratory_rate: number;
}
export interface RiskPredictionResult {
  patient_id: string;
  observation_id: number | null;
  created_at: string | null;
  risk_score: number;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  model_probability: number;
  factors: Array<{ feature: string; observed_value: number; direction: 'increases-risk' | 'decreases-risk'; explanation: string }>;
  model_version: string;
  demo_only: true;
  disclaimer: string;
}
export interface ObservationRecord {
  id: number;
  patient_id: string;
  created_at: string;
  inputs: Omit<RiskPredictionInput, 'patient_id'>;
  prediction: RiskPredictionResult;
  model_version: string;
}
export interface DemoSimulationRequest {
  patient_id: string;
  scenario: 'stable' | 'worsening' | 'recovering';
  step: number;
}
export interface ObservationHistory {
  items: ObservationRecord[];
  count: number;
  limit: number;
  next_before_id: number | null;
  demo_only: true;
  disclaimer: string;
}
export interface BackendPatientSummary {
  patient_id: string;
  age: number | null;
  latest_observation_id: number;
  last_observed_at: string;
  observation_count: number;
  latest_inputs: Omit<RiskPredictionInput, 'patient_id'>;
  latest_prediction: RiskPredictionResult;
  model_version: string;
  demo_only: true;
}
export interface BackendPatientList {
  items: BackendPatientSummary[];
  count: number;
  limit: number;
  demo_only: true;
  disclaimer: string;
}
export interface PatientVitalRecord extends Omit<RiskPredictionInput, 'patient_id'> {
  observation_id: number;
  patient_id: string;
  timestamp: string;
  risk_score: number;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  model_probability: number;
  model_version: string;
  demo_only: true;
}
export interface PatientVitalsHistory {
  patient_id: string;
  items: PatientVitalRecord[];
  count: number;
  limit: number;
  demo_only: true;
  disclaimer: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  // JSON content type is only needed for requests with a body; setting it on
  // GET requests can cause an unnecessary CORS preflight.
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${APP_CONFIG.apiBaseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(8000),
    headers,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `API request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}
async function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export const api = {
  listPatients: (limit = 100) =>
    get<BackendPatientList>(`/api/v1/patients?limit=${limit}`),
  getPatient: (id: string) =>
    get<BackendPatientSummary>(`/api/v1/patients/${encodeURIComponent(id)}`),
  getVitals: (id: string, limit = 100) =>
    get<PatientVitalsHistory>(`/api/v1/patients/${encodeURIComponent(id)}/vitals?limit=${limit}`),
  getLatestVitals: (id: string) =>
    get<PatientVitalRecord>(`/api/v1/patients/${encodeURIComponent(id)}/vitals/latest`),
  predictRisk: (input: RiskPredictionInput) =>
    request<RiskPredictionResult>('/api/v1/risk/predict', { method: 'POST', body: JSON.stringify(input) }),
  submitDemoObservation: (input: DemoSimulationRequest) =>
    request<RiskPredictionResult>('/api/v1/demo/observations', { method: 'POST', body: JSON.stringify(input) }),
  listObservations: (patientId?: string, limit = 10) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (patientId) params.set('patient_id', patientId);
    return get<ObservationHistory>(`/api/v1/observations?${params.toString()}`);
  },
  health: () =>
    get<{ status: string; model_version: string; demo_only: boolean; storage_backend?: 'sqlite' | 'postgresql'; persistent_storage_configured?: boolean }>('/health'),
};
