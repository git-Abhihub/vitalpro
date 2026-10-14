import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api.ts';
import { APP_CONFIG } from '../services/config.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('backend API client', () => {
  it('requests the correct patient-list URL and limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], count: 0, limit: 17, demo_only: true, disclaimer: 'Synthetic only.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.listPatients(17);

    expect(result.limit).toBe(17);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(`${APP_CONFIG.apiBaseUrl}/api/v1/patients?limit=17`);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).has('Content-Type')).toBe(false);
  });

  it('URL-encodes patient IDs in the patient history endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ patient_id: 'DEMO/001', items: [], count: 0, limit: 12, demo_only: true, disclaimer: 'Synthetic only.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.getVitals('DEMO/001', 12);

    expect(fetchMock.mock.calls[0][0]).toBe(`${APP_CONFIG.apiBaseUrl}/api/v1/patients/DEMO%2F001/vitals?limit=12`);
  });

  it('sends prediction payload as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ patient_id: 'DEMO-001', risk_score: 12, demo_only: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const input = {
      patient_id: 'DEMO-001', age: 58, heart_rate: 82, spo2: 98,
      systolic_bp: 122, diastolic_bp: 78, temperature: 37, respiratory_rate: 16,
    };

    await api.predictRisk(input);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual(input);
  });

  it('propagates backend errors instead of silently returning demo data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service unavailable',
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.listPatients()).rejects.toThrow('Service unavailable');
  });
});
