import { Activity, ClipboardList, FileHeart, FlaskConical, HeartPulse, ShieldAlert, UserRound } from 'lucide-react';
import { SectionCard } from '../ui/Primitives.tsx';
import type { SyntheticPatientProfile } from '../../services/api.ts';

function dateLabel(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

function PanelList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (!items.length) return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  return <ul className="space-y-2">{items.map((item, index) =>
    <li key={`${item}-${index}`} className="rounded-xl border border-slate-200/80 dark:border-slate-700 px-3 py-2 text-sm">{item}</li>
  )}</ul>;
}

function LabResultCard({ result }: { result: SyntheticPatientProfile['test_results'][number] }) {
  const span = Math.max(0.0001, result.display_max - result.display_min);
  const bandLeft = Math.max(0, Math.min(100, ((result.illustrative_low - result.display_min) / span) * 100));
  const bandRight = Math.max(0, Math.min(100, ((result.illustrative_high - result.display_min) / span) * 100));
  const marker = Math.max(0, Math.min(100, ((result.result - result.display_min) / span) * 100));
  const withinBand = result.result >= result.illustrative_low && result.result <= result.illustrative_high;
  return (
    <article className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm">{result.name}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{result.panel}</p>
        </div>
        <span className="text-[10px] rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-slate-500 whitespace-nowrap">Mock lab</span>
      </div>
      <p className="metric text-2xl mt-3">{result.result}<span className="font-normal text-xs text-slate-500 ml-1">{result.unit}</span></p>
      <div className="mt-3">
        <div className="relative h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" role="img" aria-label={`${result.name}: synthetic value ${result.result} ${result.unit}; illustrative UI band ${result.illustrative_band}`}>
          <div className="absolute inset-y-0 rounded-full bg-teal-200/90 dark:bg-teal-900/80" style={{ left: `${bandLeft}%`, width: `${Math.max(0, bandRight - bandLeft)}%` }} />
          <div className={`absolute top-[-2px] h-3 w-1.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${withinBand ? 'bg-teal-700' : 'bg-amber-600'}`} style={{ left: `calc(${marker}% - 3px)` }} />
        </div>
        <div className="flex justify-between gap-2 text-[10px] text-slate-400 mt-1">
          <span>{result.display_min}</span><span>Illustrative band: {result.illustrative_band}</span><span>{result.display_max}</span>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 mt-2">Collected {dateLabel(result.collected_at)} · synthetic value only</p>
    </article>
  );
}

export function PatientProfileSections({ profile }: { profile: SyntheticPatientProfile }) {
  const initials = profile.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const demographicItems = [
    { label: 'Age', value: profile.age == null ? 'Not recorded' : `${profile.age} years` },
    { label: 'Sex', value: profile.sex },
    { label: 'Blood group', value: profile.blood_group },
    { label: 'Height', value: `${profile.height_cm} cm` },
    { label: 'Weight', value: `${profile.weight_kg} kg` },
    { label: 'Ward / bed', value: `${profile.ward} · ${profile.bed}` },
    { label: 'Admission date', value: dateLabel(profile.admission_date) },
    { label: 'Last profile review', value: dateLabel(profile.last_reviewed_at) },
  ];
  return (
    <>
      <section className="card mt-4 overflow-hidden" aria-labelledby="synthetic-profile-title">
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950 text-white">
          <div className="flex flex-wrap items-center gap-4">
            <div className="h-16 w-16 shrink-0 rounded-2xl border border-white/15 bg-white/10 grid place-items-center text-2xl font-extrabold">{initials || <UserRound />}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-200">Fictional patient profile</p>
              <h2 id="synthetic-profile-title" className="font-display text-2xl sm:text-3xl font-extrabold mt-1">{profile.full_name}</h2>
              <p className="text-xs text-slate-300 mt-1">Patient ID: <span className="font-semibold text-white">{profile.patient_id}</span></p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/30 bg-amber-300/10 px-3 py-1.5 text-[11px] font-bold text-amber-100"><ShieldAlert size={13} /> Synthetic record</span>
          </div>
          <p className="text-sm text-slate-300 mt-4 max-w-4xl">{profile.admission_reason}</p>
        </div>
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {demographicItems.map((item) => <article key={item.label} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.label}</p>
              <p className="text-sm font-semibold mt-1 break-words">{item.value}</p>
            </article>)}
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/25 dark:border-amber-900 p-3 flex gap-2.5">
            <ShieldAlert size={17} className="text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-100">{profile.profile_notice}</p>
          </div>
        </div>
      </section>

      <div className="mt-4 grid xl:grid-cols-2 gap-4 items-start">
        <SectionCard eyebrow="Problem list" title="Conditions and disease history" hint="Fictional examples attached to this demo profile" label="Synthetic conditions">
          <div className="space-y-2">
            {profile.conditions.map((condition, index) => <article key={`${condition.name}-${index}`} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-sm">{condition.name}</p>
                <span className="text-[10px] rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1">{condition.status}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{condition.note}</p>
              <p className="text-[10px] text-slate-400 mt-1">Mock entry · noted {condition.noted_on}</p>
            </article>)}
          </div>
          <div className="mt-4">
            <p className="eyebrow mb-2">Past medical history</p>
            <PanelList items={profile.past_medical_history} emptyLabel="No sample history listed." />
          </div>
        </SectionCard>

        <SectionCard eyebrow="Laboratory" title="Test results explorer" hint="Synthetic values with illustrative chart bands; not diagnostic ranges" label="Synthetic lab test results">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-3"><FlaskConical size={14} /> {profile.test_results.length} generated test results · no source lab data</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {profile.test_results.map((result) => <LabResultCard key={result.test_id} result={result} />)}
          </div>
          <p className="text-[11px] text-slate-400 mt-3">The horizontal band is a visual demonstration only; marker placement must not be used to infer a diagnosis or treatment.</p>
        </SectionCard>

        <SectionCard eyebrow="Reconciliation" title="Medications and allergies" hint="Generated profile entries only" label="Mock medications and allergies">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5"><FileHeart size={13} /> Medication list</p>
              <PanelList items={profile.medications} emptyLabel="No medication entries." />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5"><ShieldAlert size={13} /> Allergy list</p>
              <PanelList items={profile.allergies} emptyLabel="No allergy entries." />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">Not a medication reconciliation or verified allergy record.</p>
        </SectionCard>

        <SectionCard eyebrow="History and notes" title="Procedures, family and social history" hint="Illustrative medical-history sections" label="Additional synthetic history">
          <div className="space-y-4">
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Procedures / encounters</p><PanelList items={profile.procedures} emptyLabel="No procedure entries." /></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Family history</p><PanelList items={profile.family_history} emptyLabel="No family history entries." /></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Social history</p><p className="text-sm text-slate-600 dark:text-slate-300">{profile.social_history}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5"><ClipboardList size={13} /> Demo notes</p><PanelList items={profile.care_notes} emptyLabel="No notes." /></div>
          </div>
        </SectionCard>
      </div>
      <p className="text-[11px] text-slate-400 mt-3 flex items-start gap-1.5"><HeartPulse size={13} className="shrink-0 mt-0.5" /> Profile fields are generated consistently for each demo patient ID. They are not medical facts, patient reports, clinical findings, or a care plan.</p>
    </>
  );
}
