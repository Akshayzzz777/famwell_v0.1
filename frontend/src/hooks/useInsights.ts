import { useCallback, useEffect, useState } from 'react';

import { useRole } from '../context/RoleContext';
import { fetchInsights, type ApiFailure, type InsightsPayload } from '../services/api';

const simulatedError: ApiFailure = {
  endpoint: '/api/insights',
  kind: 'server',
  message: 'Simulated error state.',
  retryable: true,
};

export function useInsights() {
  const { devScenario, selectedRole } = useRole();
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);
  const [refreshSeed, setRefreshSeed] = useState(0);

  const refresh = useCallback(() => {
    setRefreshSeed((value) => value + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (devScenario === 'empty') {
        setInsights(null);
        setError(null);
        setLoading(false);
        return;
      }

      if (devScenario === 'error') {
        setInsights(null);
        setError(simulatedError);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const payload = await fetchInsights(selectedRole);
        if (!mounted) {
          return;
        }
        setInsights(payload);
      } catch (failure) {
        if (mounted) {
          setInsights(null);
          setError(failure as ApiFailure);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [devScenario, refreshSeed, selectedRole]);

  return { insights, loading, error, refresh };
}
