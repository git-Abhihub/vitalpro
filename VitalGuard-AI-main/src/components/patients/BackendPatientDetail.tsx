import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowLeft, Clock3, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Shell } from '../layout/Shell.tsx';
import { EmptyState } from '../ui/States.tsx';
import { RiskBadge } from '../ui/Badges.tsx';
import { api, type BackendPatientSummary, type PatientVitalsHistory } from '../../services/api.ts';
import { BackendPatientTimeline } from './BackendPatientTimeline.tsx';
import { PatientProfileSections } from './PatientProfileSections.tsx';
import { PatientVitalsAnalytics } from './PatientVitalsAnalytics.tsx';
import { BackendObservationTrends } from './BackendObservationTrends.tsx';

function fmtTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Timestamp unavailable' : date.toLocaleString();
}

export function BackendPatientDetail({ patientId }: { patientId: string }) {
  const [patient, setPatient] = useState<BackendPatientSummary | null>(null);
  const [history, setHistory] = useState<PatientVitalsHistory | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, vitals] = await Promise.all([
        api.getPatient(patientId),
        api.getVitals(patientId, 100),
      ]);
      setPatient(summary);
      setHistory(vitals);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load backend patient records.');
      setPatient(null);
      setHistory(null);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !patient) {
    return <Shell title="Backend patient" subtitle="Persisted synthetic observations"><EmptyState title="Loading backend patient history…" /></Shell>;
  }

  if (error || !patient || !history) {
    return <Shell title="Backend patient unavailable" subtitle="Persisted API data">
      <EmptyState title={`No persisted backend observations found for ${patientId}.`}
        hint={error || 'Create a synthetic prediction through Settings → Risk Engine or the API docs.'}
        action={<Link to="/dashboard" className="btn-primary">Back to dashboard</Link>} />
    </Shell>;
  }

  const inputs = patient.latest_inputs;
  const prediction = patient.latest_prediction;
  const vitals = [
    { label: 'Heart rate', value: inputs.heart_rate, unit: 'bpm' },
    { label: 'SpO₂', value: inputs.spo2, unit: '%' },
    { label: 'Systolic BP', value: inputs.systolic_bp, unit: 'mmHg' },
    { label: 'Diastolic BP', value: inputs.diastolic_bp, unit: 'mmHg' },
    { label: 'Temperature', value: inputs.temperature, unit: '°C' },
    { label: 'Respiratory rate', value: inputs.respiratory_rate, unit: '/min' },
  ];

  return (
    <Shell title={`Backend patient ${patientId}`} subtitle="Persisted synthetic API observations">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Full synthetic patient history</p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold mt-1">{patient.profile?.full_name ?? patientId}</h1>
          <p className="text-sm text-slate-500 mt-1">Patient ID {patientId} · Age {patient.age ?? 'not recorded'} · {patient.observation_count} saved observation(s) · fictional demo record</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
          <Link to="/dashboard" className="btn-secondary"><ArrowLeft size={14} /> Dashboard</Link>
        </div>
      </div>

      {patient.profile && <PatientProfileSections profile={patient.profile} />}

      <section className="card mt-4 p-4 sm:p-5" aria-label="Latest backend observation">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow flex items-center gap-1.5"><Clock3 size={13} /> Latest persisted observation</p>
            <p className="text-xs text-slate-500 mt-1">{fmtTimestamp(patient.last_observed_at)} · record #{patient.latest_observation_id}</p>
          </div>
          <RiskBadge level={prediction.risk_level} score={prediction.risk_score} />
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          {vitals.map((vital) => <article key={vital.label} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <p className="text-xs text-slate-500">{vital.label}</p>
            <p className="metric text-xl mt-1">{vital.value}<span className="text-xs font-normal text-slate-500 ml-1">{vital.unit}</span></p>
          </article>)}
        </div>
        <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5"><Activity size={12} /> Model {patient.model_version}. This is a synthetic model output, not validated clinical risk.</p>
      </section>

      <PatientVitalsAnalytics history={history} />

      <section className="card mt-4 p-4 sm:p-5" aria-labelledby="backend-history-heading">
        <h2 id="backend-history-heading" className="font-display text-xl font-extrabold">Saved observation history</h2>
        <p className="text-xs text-slate-500 mt-1">Chronological values actually returned by the backend.</p>
        {history.items.length === 0 ? <p className="text-sm text-slate-500 mt-4">No observation history returned.</p> :
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead><tr className="table-head"><th>Observed</th><th>HR</th><th>SpO₂</th><th>BP</th><th>Temp</th><th>RR</th><th>Score</th><th>Level</th></tr></thead>
              <tbody>{history.items.slice(-20).slice().reverse().map((item) => <tr key={item.observation_id} className="table-row">
                <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtTimestamp(item.timestamp)}</td>
                <td className="px-3 py-3 tabular-nums">{item.heart_rate}</td>
                <td className="px-3 py-3 tabular-nums">{item.spo2}%</td>
                <td className="px-3 py-3 tabular-nums">{item.systolic_bp}/{item.diastolic_bp}</td>
                <td className="px-3 py-3 tabular-nums">{item.temperature}</td>
                <td className="px-3 py-3 tabular-nums">{item.respiratory_rate}</td>
                <td className="px-3 py-3 font-bold tabular-nums">{item.risk_score}/100</td>
                <td className="px-3 py-3 capitalize">{item.risk_level}</td>
              </tr>)}</tbody>
            </table>
          </div>}
      </section>

      <BackendPatientTimeline patientId={patientId} />
      <BackendObservationTrends patientId={patientId} />
      <p className="text-[11px] text-slate-400 mt-3">Demo only · synthetic observations · not a medical record or clinical workflow. No real patient data should be entered.</p>
    </Shell>
  );
}
