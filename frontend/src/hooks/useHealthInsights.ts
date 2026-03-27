import { useCallback, useEffect, useState } from 'react';

import { useRole } from '../context/RoleContext';
import {
  fetchLatestHealthInsights,
  fetchHealthInsights,
  type ApiFailure,
  type HealthAnalysis,
} from '../services/api';

export function useHealthInsights(recordId?: string) {
  const { selectedRole } = useRole();
  const [data, setData] = useState<HealthAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);
  const [refreshSeed, setRefreshSeed] = useState(0);

  const refresh = useCallback(() => {
    setRefreshSeed((v) => v + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const payload = recordId
          ? await fetchHealthInsights(selectedRole, recordId)
          : await fetchLatestHealthInsights(selectedRole);
        if (!mounted) return;
        setData(payload);
      } catch (failure) {
        if (mounted) {
          setData(null);
          setError(failure as ApiFailure);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => { mounted = false; };
  }, [selectedRole, recordId, refreshSeed]);

  return { data, loading, error, refresh };
}
