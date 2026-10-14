import { useMemo } from 'react';
import type { Patient, RiskSignal, VitalReading } from '../../types/index.ts';
import type { PatientVitalsHistory } from '../../services/api.ts';
import { createLocalSyntheticProfile } from '../../services/syntheticProfile.ts';
import { PatientProfileSections } from './PatientProfileSections.tsx';
import { PatientVitalsAnalytics } from './PatientVitalsAnalytics.tsx';

export function LocalPatientDetailExtras({ patient, readings, risk }: {
  patient: Patient;
  readings: VitalReading[];
  risk: RiskSignal;
}) {
  const firstObservedAt = readings[0]?.timestamp ?? patient.updatedAt;
  const profile = useMemo(
    () => createLocalSyntheticProfile(patient, firstObservedAt, firstObservedAt),
    [patient.id, patient.age, patient.sex, patient.ward, patient.bed, firstObservedAt],
  );

  const history = useMemo<PatientVitalsHistory>(() => {
    const visible = readings.slice(-40);
    const trajectory = risk.trajectory.length ? risk.trajectory : [risk.score];
    const items = visible.map((reading, index) => {
      const trajectoryIndex = visible.length <= 1
        ? trajectory.length - 1
        : Math.round(index * (trajectory.length - 1) / (visible.length - 1));
      return {
        observation_id: index + 1,
        patient_id: patient.id,
        age: patient.age,
        timestamp: reading.timestamp,
        heart_rate: reading.heartRate,
        spo2: reading.spo2,
        systolic_bp: reading.systolicBp,
        diastolic_bp: reading.diastolicBp,
        temperature: reading.temperature,
        respiratory_rate: reading.respiratoryRate,
        risk_score: trajectory[trajectoryIndex] ?? risk.score,
        risk_level: risk.level,
        model_probability: risk.probability,
        model_version: 'local-synthetic-simulator',
        demo_only: true as const,
      };
    });
    return {
      patient_id: patient.id,
      items,
      count: items.length,
      limit: 100,
      demo_only: true,
      disclaimer: 'Local synthetic simulator readings only.',
    };
  }, [patient.id, patient.age, readings, risk.trajectory, risk.score, risk.level, risk.probability]);

  return (
    <>
      <PatientProfileSections profile={profile} />
      <PatientVitalsAnalytics history={history} />
    </>
  );
}
