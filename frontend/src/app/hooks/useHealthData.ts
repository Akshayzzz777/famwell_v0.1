import { useQuery } from '@tanstack/react-query';

import {
  fetchLatestHealthInsights,
  fetchHealthInsights,
  type HealthAnalysis,
} from '../lib/api';
import { useApp } from '../state/AppContext';

const HEALTH_DATA_KEY = 'healthData';

export function useHealthData(recordId?: string) {
  const { selectedRole } = useApp();

  return useQuery<HealthAnalysis>({
    queryKey: [HEALTH_DATA_KEY, selectedRole, recordId ?? 'latest'],
    queryFn: () =>
      recordId
        ? fetchHealthInsights(selectedRole, recordId)
        : fetchLatestHealthInsights(selectedRole),
    enabled: Boolean(selectedRole),
  });
}
