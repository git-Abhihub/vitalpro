import { useCallback, useEffect, useState } from 'react';
import { Activity, Clock3, RefreshCw, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, type BackendPatientList } from '../../services/api.ts';
import { VitalSpark } from '../charts/Vitals.tsx';
import { useBackendLiveEvents } from '../../hooks/useBackendLiveEvents.ts';
import type { LiveEvent } from '../../services/liveEvents.ts';

function fmtTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Timestamp unavailable' : date.toLocaleString();
}

export function BackendPatientDirectory() {
  const [data, setData] = useState<BackendPatientList | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listPatients(100);
      setData(result);
      setError('');
    } catch {
      // Explicitly surface the error; never substitute local demo patients here.
      setError('Backend patient data is unavailable. Check the API deployment and database connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLiveEvent = useCallback((event: LiveEvent) => {
    if (event.type === 'observation.created') void load();
  }, [load]);
  const liveStatus = useBackendLiveEvents(handleLiveEvent);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="card mt-4 p-4 sm:p-5" aria-labelledby="backend-patient-directory-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><Users size={13} /> Persisted backend data</p>
          <h2 id="backend-patient-directory-heading" className="font-display text-xl font-extrabold mt-1">Backend patient observations</h2>
          <p className="text-xs text-slate-500 mt-1">Patient IDs are derived from synthetic observations saved through the API. This list is separate from the local simulator cohort.</p>
          <p className="text-xs mt-2 flex items-center gap-2" aria-live="polite">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${liveStatus === 'connected' ? 'bg-emerald-500' : liveStatus === 'reconnecting' ? 'bg-amber-500' : 'bg-slate-400'}`} />
            {liveStatus === 'connected' ? 'Live demo stream connected' : liveStatus === 'reconnecting' ? 'Reconnecting to live updates…' : liveStatus === 'connecting' ? 'Connecting to live updates…' : 'Live stream offline; manual refresh is available'}
          </p>
        </div>
        <button className="btn-secondary" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200">{error}</p>}
      {loading && !data ? <p className="text-sm text-slate-500 mt-4">Loading persisted patient summaries…</p> :
        data && data.items.length === 0 ? <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
          <p className="text-sm text-slate-500">No backend patient observations yet. Create a fictional observation to populate this view.</p>
          <Link to="/settings" className="btn-primary inline-flex mt-3">Open Risk Engine</Link>
        </div> :
        data && <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[1320px] text-sm">
            <thead><tr className="table-head"><th>Demo patient</th><th>Age</th><th>Latest demo score</th><th>Latest vitals</th><th>Signal progress</th><th>Observations</th><th>Last observed</th><th><span className="sr-only">Open</span></th></tr></thead>
            <tbody>{data.items.map((patient) => {
              const prediction = patient.latest_prediction;
              const levelClass = prediction.risk_level === 'critical' || prediction.risk_level === 'high'
                ? 'bg-rose-50 text-rose-700' : prediction.risk_level === 'moderate'
                  ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700';
              return <tr key={patient.patient_id} className="table-row">
                <td className="px-3 py-3 font-semibold">{patient.patient_id}</td>
                <td className="px-3 py-3 tabular-nums">{patient.age ?? '—'}</td>
                <td className="px-3 py-3">
                  <span className="font-bold tabular-nums">{prediction.risk_score}/100</span>
                  <span className={`ml-2 rounded-md px-2 py-1 text-[10px] uppercase font-bold ${levelClass}`}>{prediction.risk_level}</span>
                </td>
                <td className="px-3 py-3 min-w-[220px]">
                  <p className="text-xs font-semibold tabular-nums">HR {patient.latest_inputs.heart_rate} bpm · SpO₂ {patient.latest_inputs.spo2}%</p>
                  <p className="text-[11px] text-slate-500 mt-1 tabular-nums">BP {patient.latest_inputs.systolic_bp}/{patient.latest_inputs.diastolic_bp} · {patient.latest_inputs.temperature}°C · RR {patient.latest_inputs.respiratory_rate}</p>
                </td>
                <td className="px-3 py-3 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <div className="w-24 shrink-0">
                      <VitalSpark
                        data={patient.progress?.risk_scores?.length ? patient.progress.risk_scores : [prediction.risk_score]}
                        color={prediction.risk_level === 'critical' || prediction.risk_level === 'high' ? '#e11d48' : prediction.risk_level === 'moderate' ? '#d97706' : '#0d9488'}
                        height={34}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {patient.progress?.risk_direction === 'increasing' ? 'Rising' : patient.progress?.risk_direction === 'decreasing' ? 'Falling' : patient.progress?.risk_direction === 'stable' ? 'Stable' : 'Collecting history'}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1.5 overflow-hidden" aria-label={`Latest synthetic score ${prediction.risk_score} out of 100`}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, prediction.risk_score))}%`, background: prediction.risk_level === 'critical' || prediction.risk_level === 'high' ? '#e11d48' : prediction.risk_level === 'moderate' ? '#d97706' : '#0d9488' }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
                    {patient.progress?.risk_delta == null ? 'Need 2+ samples for change' : `${patient.progress.previous_risk_score} → ${prediction.risk_score} · ${patient.progress.risk_delta > 0 ? '+' : ''}${patient.progress.risk_delta}`}
                  </p>
                </td>
                <td className="px-3 py-3 tabular-nums">{patient.observation_count}</td>
                <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap"><Clock3 size={12} className="inline mr-1" />{fmtTimestamp(patient.last_observed_at)}</td>
                <td className="px-3 py-3 text-right"><Link className="btn-secondary !py-1.5 !text-xs" to={`/patients/${encodeURIComponent(patient.patient_id)}`}>Inspect <Activity size={12} className="inline ml-1" /></Link></td>
              </tr>;
            })}</tbody>
          </table>
          <p className="text-[11px] text-slate-400 mt-3">{data.count} distinct demo patient ID(s) in this API response · list limit {data.limit}.</p>
        </div>}
      <p className="text-[11px] text-slate-400 mt-2">Synthetic data only. The score is a model output, not a clinically validated deterioration probability.</p>
    </section>
  );
}
