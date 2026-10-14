import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertCircle, CircleStop, Play, Radio, Send } from 'lucide-react';
import { api, type RiskPredictionResult } from '../../services/api.ts';

type Scenario = 'stable' | 'worsening' | 'recovering';

function formatTimestamp(value: string | null) {
  if (!value) return 'Waiting for first sample';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Timestamp unavailable' : date.toLocaleTimeString();
}

const riskTone: Record<RiskPredictionResult['risk_level'], string> = {
  low: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
  moderate: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  high: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  critical: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
};

/**
 * Generates fictional monitor observations through the existing demo API.
 * It is a presentation/test tool, not a connection to a physical bedside device.
 */
export function SyntheticMonitorStream() {
  const [patientId, setPatientId] = useState('DEMO-LIVE-001');
  const [scenario, setScenario] = useState<Scenario>('stable');
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const [latest, setLatest] = useState<RiskPredictionResult | null>(null);
  const [error, setError] = useState('');
  const stepRef = useRef(0);
  const inFlightRef = useRef(false);

  const sendSample = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await api.submitDemoObservation({
        patient_id: patientId.trim() || 'DEMO-LIVE-001',
        scenario,
        step: stepRef.current,
      });
      stepRef.current += 1;
      setLatest(result);
      setSampleCount((count) => count + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send the synthetic monitor sample.');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }, [patientId, scenario]);

  useEffect(() => {
    if (!streaming) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pump = async () => {
      await sendSample();
      if (!stopped) timer = setTimeout(() => void pump(), 5000);
    };
    void pump();
    return () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [streaming, sendSample]);

  const startStream = () => {
    stepRef.current = 0;
    setSampleCount(0);
    setLatest(null);
    setError('');
    setStreaming(true);
  };

  return (
    <section className="card mt-4 p-4 sm:p-5" aria-labelledby="synthetic-monitor-stream-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><Radio size={13} /> Live ingestion demo</p>
          <h2 id="synthetic-monitor-stream-heading" className="font-display text-xl font-extrabold mt-1">Synthetic Monitor Stream</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Emits a fictional observation immediately and then every 5 seconds while running. New observations are saved by the backend and broadcast to dashboard subscribers.
          </p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${streaming ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${streaming ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          {streaming ? 'Stream running' : 'Stream paused'}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_190px_auto] xl:items-end">
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
          Fictional patient ID
          <input
            className="input-field mt-1.5 w-full"
            value={patientId}
            onChange={(event) => setPatientId(event.target.value.slice(0, 64))}
            maxLength={64}
            aria-describedby="synthetic-monitor-help"
            disabled={streaming}
            placeholder="DEMO-LIVE-001"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
          Stream scenario
          <select className="input-field mt-1.5 w-full" value={scenario}
            onChange={(event) => setScenario(event.target.value as Scenario)} disabled={streaming}>
            <option value="stable">Stable observations</option>
            <option value="worsening">Worsening trend</option>
            <option value="recovering">Recovering trend</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          {streaming ? (
            <button type="button" className="btn-secondary" onClick={() => setStreaming(false)}>
              <CircleStop size={15} aria-hidden /> Pause stream
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={startStream} disabled={busy}>
              <Play size={15} aria-hidden /> Start stream
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={() => void sendSample()} disabled={busy || streaming}>
            <Send size={14} aria-hidden /> Send one sample
          </button>
        </div>
      </div>
      <p id="synthetic-monitor-help" className="mt-2 text-[11px] text-slate-400">
        Demo identifiers only. Do not enter names, medical record numbers, or real patient information.
      </p>

      {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>Stream request failed: {error}. The stream will retry on its next cycle.</span>
      </p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <p className="text-xs text-slate-500 flex items-center gap-1.5"><Activity size={13} /> Samples accepted</p>
          <p className="metric mt-1 text-2xl tabular-nums">{sampleCount}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <p className="text-xs text-slate-500">Latest synthetic score</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="metric text-2xl tabular-nums">{latest ? latest.risk_score : '—'}<span className="text-sm text-slate-400">/100</span></p>
            {latest && <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${riskTone[latest.risk_level]}`}>{latest.risk_level}</span>}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <p className="text-xs text-slate-500">Last backend acknowledgement</p>
          <p className="mt-2 text-sm font-semibold tabular-nums">{formatTimestamp(latest?.created_at ?? null)}</p>
          {busy && <p className="mt-1 text-xs text-slate-500">Sending sample…</p>}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        Synthetic simulation only; the score is not a validated deterioration probability. This panel demonstrates the ingestion-to-dashboard software path, not physical-monitor connectivity or a clinical alarm system.
      </p>
    </section>
  );
}
