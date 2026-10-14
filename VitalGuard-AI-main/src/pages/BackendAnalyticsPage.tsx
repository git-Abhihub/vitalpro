import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Clock3, Database, RefreshCw, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Shell } from '../components/layout/Shell.tsx';
import { PageHeader, SectionCard } from '../components/ui/Primitives.tsx';
import { DemoPill } from '../components/ui/Badges.tsx';
import { RiskDonut } from '../components/charts/Donut.tsx';
import { MiniBars, VitalSpark } from '../components/charts/Vitals.tsx';
import { api, type BackendAlertList, type BackendObservationQuality, type BackendPatientList, type BackendPatientSummary } from '../services/api.ts';
import { useBackendLiveEvents } from '../hooks/useBackendLiveEvents.ts';
import type { LiveEvent } from '../services/liveEvents.ts';

type AnalyticsSnapshot = {
  patients: BackendPatientList;
  alerts: BackendAlertList;
  quality: BackendObservationQuality;
};

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function fmtAverage(value: number | null, digits = 1) {
  return value == null ? '—' : value.toFixed(digits);
}

function riskTone(level: string) {
  if (level === 'critical' || level === 'high') return '#e11d48';
  if (level === 'moderate') return '#d97706';
  return '#0d9488';
}

function directionLabel(patient: BackendPatientSummary) {
  const direction = patient.progress?.risk_direction;
  if (direction === 'increasing') return { label: 'Rising', icon: TrendingUp, tone: 'text-amber-700 dark:text-amber-300' };
  if (direction === 'decreasing') return { label: 'Falling', icon: TrendingDown, tone: 'text-teal-700 dark:text-teal-300' };
  if (direction === 'stable') return { label: 'Stable', icon: Activity, tone: 'text-slate-500' };
  return { label: 'Need more samples', icon: Clock3, tone: 'text-slate-400' };
}

export function BackendAnalyticsPage() {
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [patients, alerts, quality] = await Promise.all([
        api.listPatients(100),
        api.listAlerts(100),
        api.getObservationQuality(300, 100),
      ]);
      setSnapshot({ patients, alerts, quality });
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load backend analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLiveEvent = useCallback((event: LiveEvent) => {
    if (event.type === 'observation.created' || event.type === 'alert.created') {
      void load();
    }
  }, [load]);
  const liveStatus = useBackendLiveEvents(handleLiveEvent);
  useEffect(() => { void load(); }, [load]);

  const patients = snapshot?.patients.items ?? [];
  const alerts = snapshot?.alerts.items ?? [];
  const quality = snapshot?.quality.items ?? [];

  const derived = useMemo(() => {
    const scores = patients.map((patient) => patient.latest_prediction.risk_score);
    const inputs = patients.map((patient) => patient.latest_inputs);
    const countByRisk = (level: string) => patients.filter((patient) => patient.latest_prediction.risk_level === level).length;
    const directionCounts = [
      { name: 'Rising score', value: patients.filter((p) => p.progress?.risk_direction === 'increasing').length },
      { name: 'Falling score', value: patients.filter((p) => p.progress?.risk_direction === 'decreasing').length },
      { name: 'Stable score', value: patients.filter((p) => p.progress?.risk_direction === 'stable').length },
      { name: 'Need history', value: patients.filter((p) => !p.progress || p.progress.risk_direction === 'insufficient_data').length },
    ];
    const alertStatus = [
      { name: 'Open', value: alerts.filter((alert) => alert.status === 'open').length },
      { name: 'Acknowledged', value: alerts.filter((alert) => alert.status === 'acknowledged').length },
      { name: 'Resolved', value: alerts.filter((alert) => alert.status === 'resolved').length },
    ];
    const freshness = [
      { name: 'Fresh', value: quality.filter((item) => item.status === 'fresh').length },
      { name: 'Stale', value: quality.filter((item) => item.status === 'stale').length },
      { name: 'Incomplete', value: quality.filter((item) => item.status === 'incomplete').length },
      { name: 'Unknown', value: quality.filter((item) => item.status === 'unknown').length },
    ];
    const volumes = [...patients]
      .sort((a, b) => b.observation_count - a.observation_count)
      .slice(0, 8)
      .map((patient) => ({ name: patient.patient_id.length > 12 ? patient.patient_id.slice(0, 12) + '…' : patient.patient_id, value: patient.observation_count }));
    const topScores = [...patients]
      .sort((a, b) => b.latest_prediction.risk_score - a.latest_prediction.risk_score)
      .slice(0, 8)
      .map((patient) => ({ name: patient.patient_id.length > 12 ? patient.patient_id.slice(0, 12) + '…' : patient.patient_id, value: patient.latest_prediction.risk_score }));
    return {
      avgScore: average(scores),
      totalObservations: patients.reduce((sum, patient) => sum + patient.observation_count, 0),
      elevatedScores: patients.filter((patient) => patient.latest_prediction.risk_score >= 65).length,
      riskDistribution: [
        { name: 'Critical', value: countByRisk('critical') },
        { name: 'High', value: countByRisk('high') },
        { name: 'Moderate', value: countByRisk('moderate') },
        { name: 'Low', value: countByRisk('low') },
      ],
      directionCounts,
      alertStatus,
      freshness,
      volumes,
      topScores,
      averageVitals: [
        { label: 'Heart rate', value: average(inputs.map((v) => v.heart_rate)), unit: 'bpm', digits: 1 },
        { label: 'SpO₂', value: average(inputs.map((v) => v.spo2)), unit: '%', digits: 1 },
        { label: 'Systolic BP', value: average(inputs.map((v) => v.systolic_bp)), unit: 'mmHg', digits: 1 },
        { label: 'Temperature', value: average(inputs.map((v) => v.temperature)), unit: '°C', digits: 1 },
        { label: 'Respiratory rate', value: average(inputs.map((v) => v.respiratory_rate)), unit: '/min', digits: 1 },
      ],
    };
  }, [patients, alerts, quality]);

  const progressRows = [...patients]
    .sort((a, b) => b.latest_prediction.risk_score - a.latest_prediction.risk_score)
    .slice(0, 12);

  return (
    <Shell title="Backend Analytics" subtitle="Analytics from persisted synthetic observations">
      <PageHeader
        eyebrow="Persisted cohort intelligence"
        title="Patient analytics"
        subtitle="Cohort summaries, per-patient vital tracking progress, alert status and data freshness computed from saved backend records."
        crumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Analytics' }]}
        actions={<><DemoPill label="SYNTHETIC DATA" /><button className="btn-secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button></>}
      />

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500" aria-live="polite">
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${liveStatus === 'connected' ? 'bg-emerald-500' : liveStatus === 'reconnecting' ? 'bg-amber-500' : 'bg-slate-400'}`} />
        {liveStatus === 'connected' ? 'Live backend events connected' : liveStatus === 'reconnecting' ? 'Reconnecting to updates…' : 'Automatic updates unavailable; use Refresh'}
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200">Analytics could not be refreshed: {error}</p>}
      {loading && !snapshot ? <div className="card mt-4 p-6 text-sm text-slate-500">Loading patient, alert and data-quality summaries…</div> : !snapshot ? <div className="card mt-4 p-6"><p className="font-semibold">No backend analytics available.</p><button className="btn-primary mt-3" onClick={() => void load()}>Try again</button></div> : <>
        <div className="mt-4 grid grid-cols-2 xl:grid-cols-4 gap-3 stagger">
          {[
            { label: 'Patients tracked', value: patients.length, note: 'Distinct IDs with saved observations', icon: Users },
            { label: 'Saved observations', value: derived.totalObservations, note: 'Across returned patient summaries', icon: Database },
            { label: 'Mean demo score', value: fmtAverage(derived.avgScore, 0), note: 'Latest score per patient · /100', icon: Activity },
            { label: 'Scores ≥ 65', value: derived.elevatedScores, note: 'Demo review band only, not a clinical threshold', icon: AlertTriangle },
          ].map((item) => {
            const Icon = item.icon;
            return <article key={item.label} className="card card-hover p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2"><p className="eyebrow">{item.label}</p><Icon size={16} className="text-teal-600" /></div>
              <p className="metric text-3xl mt-2">{item.value}</p>
              <p className="text-[11px] text-slate-400 mt-1">{item.note}</p>
            </article>;
          })}
        </div>

        <div className="mt-4 grid xl:grid-cols-2 gap-4 items-start">
          <SectionCard eyebrow="Latest values" title="Synthetic score distribution" hint="One latest model signal per persisted patient" label="Backend risk distribution">
            {patients.length ? <RiskDonut items={derived.riskDistribution} /> : <p className="text-sm text-slate-500">No observations have been saved yet.</p>}
          </SectionCard>
          <SectionCard eyebrow="Observed change" title="Per-patient score direction" hint="Direction between each patient's two most recent available samples" label="Patient score direction">
            <MiniBars data={derived.directionCounts} colors={['#d97706', '#0d9488', '#64748b', '#94a3b8']} />
            <p className="text-[11px] text-slate-400">Rising/falling describes the synthetic model score only. It does not diagnose or predict patient deterioration.</p>
          </SectionCard>
          <SectionCard eyebrow="Monitoring" title="Alert lifecycle" hint="Persisted demonstration alert states" label="Backend alert status">
            <MiniBars data={derived.alertStatus} colors={['#e11d48', '#d97706', '#0d9488']} />
          </SectionCard>
          <SectionCard eyebrow="Feed quality" title="Data freshness" hint="Latest observation age and required-field completeness" label="Backend data freshness">
            <MiniBars data={derived.freshness} colors={['#0d9488', '#d97706', '#e11d48', '#94a3b8']} />
            <p className="text-[11px] text-slate-400">Freshness window: {snapshot.quality.stale_after_seconds} seconds. Counts refer only to stored demo data.</p>
          </SectionCard>
        </div>

        <div className="mt-4 grid xl:grid-cols-2 gap-4 items-start">
          <SectionCard eyebrow="Cohort activity" title="Observation count by patient" hint="Most frequently updated patient IDs (top 8)" label="Observation volume by patient">
            {derived.volumes.length ? <MiniBars data={derived.volumes} colors={derived.volumes.map(() => '#0891b2')} /> : <p className="text-sm text-slate-500">No observations to chart yet.</p>}
          </SectionCard>
          <SectionCard eyebrow="Latest signal" title="Highest current demo scores" hint="Sorted by latest synthetic score, not clinical priority" label="Highest demo scores">
            {derived.topScores.length ? <MiniBars data={derived.topScores} colors={derived.topScores.map((item) => item.value >= 85 ? '#e11d48' : item.value >= 65 ? '#d97706' : '#0d9488')} /> : <p className="text-sm text-slate-500">No scores to chart yet.</p>}
          </SectionCard>
        </div>

        <div className="mt-4">
          <SectionCard eyebrow="Vital sign context" title="Latest cohort averages" hint="Arithmetic means for each patient's latest stored reading; ranges and thresholds are intentionally not labelled as clinical targets" label="Latest cohort vital averages">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
              {derived.averageVitals.map((vital) => <article key={vital.label} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-xs text-slate-500">{vital.label}</p>
                <p className="metric text-xl mt-1">{fmtAverage(vital.value, vital.digits)}<span className="text-[11px] font-normal text-slate-500 ml-1">{vital.unit}</span></p>
                <p className="text-[10px] text-slate-400 mt-1">Latest sample per patient</p>
              </article>)}
            </div>
          </SectionCard>
        </div>

        <div className="mt-4">
          <SectionCard eyebrow="Individual tracking" title="Patient progress comparison" hint="Recent risk-score trend, latest vitals, and change from each patient's previous sample" label="Individual patient progress table">
            {progressRows.length === 0 ? <p className="text-sm text-slate-500">No patients have persisted synthetic observations yet. Use the dashboard's synthetic monitor stream to create records.</p> : <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-sm">
                <thead><tr className="table-head"><th>Patient</th><th>Latest vitals</th><th>Saved samples</th><th>Score history</th><th>Latest score</th><th>Change</th><th>Last observed</th></tr></thead>
                <tbody>{progressRows.map((patient) => {
                  const score = patient.latest_prediction.risk_score;
                  const direction = directionLabel(patient);
                  const Icon = direction.icon;
                  const color = riskTone(patient.latest_prediction.risk_level);
                  const vitals = patient.latest_inputs;
                  return <tr key={patient.patient_id} className="table-row">
                    <td className="px-3 py-3 font-semibold"><Link className="hover:text-teal-700 hover:underline" to={`/patients/${encodeURIComponent(patient.patient_id)}`}>{patient.patient_id}</Link><p className="text-[10px] font-normal text-slate-400 mt-0.5">{direction.label}</p></td>
                    <td className="px-3 py-3 tabular-nums text-xs">
                      <div>HR {vitals.heart_rate} · SpO₂ {vitals.spo2}%</div>
                      <div className="text-slate-500 mt-1">BP {vitals.systolic_bp}/{vitals.diastolic_bp} · {vitals.temperature}°C · RR {vitals.respiratory_rate}</div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{patient.observation_count}</td>
                    <td className="px-3 py-3 min-w-[170px]">
                      <VitalSpark data={patient.progress?.risk_scores?.length ? patient.progress.risk_scores : [score]} color={color} height={38} />
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: color }} /></div>
                    </td>
                    <td className="px-3 py-3 font-bold tabular-nums">{score}/100 <span className="block text-[10px] font-normal uppercase text-slate-400">{patient.latest_prediction.risk_level}</span></td>
                    <td className={`px-3 py-3 tabular-nums text-xs ${direction.tone}`}><Icon size={13} className="inline mr-1" />{patient.progress?.risk_delta == null ? '—' : `${patient.progress.risk_delta > 0 ? '+' : ''}${patient.progress.risk_delta}`}</td>
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{new Date(patient.last_observed_at).toLocaleString()}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>}
            <p className="text-[11px] text-slate-400 mt-3">Showing up to 12 patients by latest demo score. Open any patient to review their persisted history and individual vital-sign trends.</p>
          </SectionCard>
        </div>
      </>}
      <p className="text-[11px] text-slate-400 mt-4">DEMO ONLY · synthetic observations and model outputs · not clinically validated. No real patient data should be entered; this dashboard must not be used for diagnosis, triage or treatment decisions.</p>
    </Shell>
  );
}
