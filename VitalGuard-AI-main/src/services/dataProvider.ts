import { APP_CONFIG } from './config.ts';
import { api } from './api.ts';
import { demoDataService } from './demoDataService.ts';

// Demo and backend modes are explicit. Backend failures intentionally propagate
// so a failed API call can never silently appear to be live backend data.
export type DataSource = 'demo' | 'api';

export function resolveDataSource(override?: DataSource): DataSource {
  return override ?? (APP_CONFIG.demoMode ? 'demo' : 'api');
}

export function isDemoMode(override?: DataSource): boolean {
  return resolveDataSource(override) === 'demo';
}

export async function fetchPatients(override?: DataSource) {
  if (isDemoMode(override)) return demoDataService.listPatients();
  return (await api.listPatients()).items;
}

export const dataProvider = { fetchPatients, demo: demoDataService, api };
