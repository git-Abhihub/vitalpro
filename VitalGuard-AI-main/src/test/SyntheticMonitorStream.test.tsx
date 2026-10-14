import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api.ts';
import { SyntheticMonitorStream } from '../components/dashboard/SyntheticMonitorStream.tsx';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SyntheticMonitorStream', () => {
  it('sends one fictional observation and displays the backend acknowledgement', async () => {
    const submit = vi.spyOn(api, 'submitDemoObservation').mockResolvedValue({
      patient_id: 'DEMO-LIVE-001',
      observation_id: 91,
      created_at: '2026-10-14T11:00:00Z',
      risk_score: 18,
      risk_level: 'low',
      model_probability: 0.18,
      factors: [],
      model_version: 'synthetic-test',
      demo_only: true,
      disclaimer: 'Synthetic only.',
    });

    render(<SyntheticMonitorStream />);
    fireEvent.click(screen.getByRole('button', { name: /send one sample/i }));

    await waitFor(() => expect(submit).toHaveBeenCalledWith({
      patient_id: 'DEMO-LIVE-001',
      scenario: 'stable',
      step: 0,
    }));
    expect(await screen.findByText('low')).toBeInTheDocument();
    expect(screen.getByText('1', { selector: 'p' })).toBeInTheDocument();
  });
});
