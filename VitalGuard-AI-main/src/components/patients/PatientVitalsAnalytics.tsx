import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, LineChart as LineChartIcon } from 'lucide-react';
import { SectionCard } from '../ui/Primitives.tsx';
import { VitalLine } from '../charts/Vitals.tsx';
import { CHART_COLORS } from '../../theme/tokens.ts';
import type { PatientVitalsHistory, PatientVitalRecord } from '../../services/api.ts';

type MetricSpec = {
  key: keyof PatientVitalRecord;
  name: string;
  description: string;
  unit: string;
  color: string;
  digits?: number;
};

const METRICS: MetricSpec[] = [
  { key: 'heart_rate', name: 'Heart rate', description: 'Recorded beats per minute across saved samples', unit: 'bpm', color: CHART_COLORS.heartRate },
  { key: 'spo2', name: 'Oxygen saturation (SpO₂)', description: 'Recorded peripheral oxygen saturation values', unit: '%', color: CHART_COLORS.spo2 },
  { key: 'systolic_bp', name: 'Systolic blood pressure', description: 'Upper blood-pressure value at each observation', unit: 'mmHg', color: CHART_COLORS.systolic },
  { key: 'diastolic_bp', name: 'Diastolic blood pressure', description: 'Lower blood-pressure value at each observation', unit: 'mmHg', color: CHART_COLORS.diastolic },
  { key: 'temperature', name: 'Temperature', description: 'Recorded temperature values', unit: '°C', color: CHART_COLORS.temperature, digits: 1 },
  { key: 'respiratory_rate', name: 'Respiratory rate', description: 'Recorded breaths per minute', unit: '/min', color: CHART_COLORS.respiratoryRate },
  { key: 'risk_score', name: 'Synthetic model score', description: 'Output from the unvalidated demo model, not a vital sign', unit: '/100', color: CHART_COLORS.risk, digits: 0 },
];

function fmt(value: number, digits = 1) {
  return Number(value.toFixed(digits)).toString();
}

function describeChange(values: number[], digits = 1) {
  if (values.length < 2) return 'Need at least 2 samples to describe change';
  const delta = values[values.length - 1] - values[0];
  if (Math.abs(delta) < 0.00001) return 'No change between first and latest saved samples';
  return `${delta > 0 ? '+' : ''}${fmt(delta, digits)} from first to latest sample`;
}

function MetricChart({ metric, rows, values, sampleCount }: {
  metric: MetricSpec;
  rows: Record<string, unknown>[];
  values: number[];
  sampleCount: number;
}) {
  const latest = values[values.length - 1];
  const min = values.length ? Math.min(...values) : null;
  const max = values.length ? Math.max(...values) : null;
  const mean = values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : null;
  const direction = values.length < 2 ? 'insufficient' : latest > values[0] ? 'up' : latest < values[0] ? 'down' : 'flat';
  const DirectionIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : ArrowRight;
  return (
    <SectionCard title={metric.name} hint={metric.description} label={`${metric.name} time series`}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Latest saved value</p>
          <p className="metric text-3xl mt-1">{latest == null ? '—' : fmt(latest, metric.digits ?? 1)}<span className="text-sm font-medium text-slate-500 ml-1">{metric.unit}</span></p>
        </div>
        <span className="rounded-xl p-2" style={{ color: metric.color, background: `${metric.color}18` }}><LineChartIcon size={19} /></span>
      </div>
      <div className="mt-3">
        {sampleCount === 0
          ? <p className="text-sm text-slate-500 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4">No saved values for this series.</p>
          : <VitalLine data={rows} lines={[{ key: String(metric.key), color: metric.color, name: metric.name }]} height={190} unit={metric.unit} />}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {[
          { label: 'Minimum', value: min },
          { label: 'Average', value: mean },
          { label: 'Maximum', value: max },
        ].map((stat) => <div key={stat.label} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">{stat.label}</p>
          <p className="text-sm font-bold tabular-nums mt-1">{stat.value == null ? '—' : fmt(stat.value, metric.digits ?? 1)} <span className="text-[10px] font-normal text-slate-500">{metric.unit}</span></p>
        </div>)}
      </div>
      <p className={`mt-3 text-xs flex items-center gap-1.5 ${direction === 'up' ? 'text-amber-700 dark:text-amber-300' : direction === 'down' ? 'text-teal-700 dark:text-teal-300' : 'text-slate-500'}`}>
        {direction === 'insufficient' ? <Activity size={13} /> : <DirectionIcon size={13} />}
        {describeChange(values, metric.digits ?? 1)}
      </p>
      <p className="text-[10px] text-slate-400 mt-1">{sampleCount} saved sample(s) · descriptive history only; no interpretation</p>
    </SectionCard>
  );
}

export function PatientVitalsAnalytics({ history }: { history: PatientVitalsHistory }) {
  const chronological = history.items;
  const rows = chronological.map((item, index) => ({
    t: `#${index + 1} · ${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    heart_rate: item.heart_rate,
    spo2: item.spo2,
    systolic_bp: item.systolic_bp,
    diastolic_bp: item.diastolic_bp,
    temperature: item.temperature,
    respiratory_rate: item.respiratory_rate,
    risk_score: item.risk_score,
  }));
  const numericValues = (key: keyof PatientVitalRecord) => chronological
    .map((item) => item[key])
    .filter((value): value is number => typeof value === 'number');
  return (
    <section className="mt-5" aria-labelledby="patient-vital-analytics-title">
      <div className="mb-3">
        <p className="eyebrow flex items-center gap-1.5"><Activity size={13} /> Descriptive analytics</p>
        <h2 id="patient-vital-analytics-title" className="font-display text-2xl font-extrabold mt-1">Vital tracking and trends</h2>
        <p className="text-sm text-slate-500 mt-1">Every chart is built from saved observations for this patient, in chronological order. Each card reports the latest, minimum, mean, maximum and first-to-latest change.</p>
      </div>
      {chronological.length < 2 && <div className="rounded-xl border border-sky-200 bg-sky-50 dark:bg-sky-950/25 dark:border-sky-900 p-3 text-xs text-sky-900 dark:text-sky-100 mb-3">
        Only {chronological.length} saved observation(s) are available. The current point and descriptive values are shown; a meaningful time trend requires more samples. Use the dashboard's synthetic stream to add more fictional readings.
      </div>}
      <div className="grid xl:grid-cols-2 gap-4 items-start">
        {METRICS.map((metric) => <MetricChart key={String(metric.key)} metric={metric} rows={rows} values={numericValues(metric.key)} sampleCount={chronological.length} />)}
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-start gap-2">
        <Activity size={15} className="text-slate-500 mt-0.5 shrink-0" />
        <p className="text-[11px] text-slate-500">Trend direction describes changes in the saved synthetic sample only. It is not a diagnosis, forecast, clinical threshold, or treatment recommendation. Missing or sparse values should not be interpreted as reassuring.</p>
      </div>
    </section>
  );
}
