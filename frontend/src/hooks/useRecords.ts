import { useCallback, useEffect, useState } from 'react';

import { useRole } from '../context/RoleContext';
import { fetchRecords, type ApiFailure, type RecordItem } from '../services/api';

const simulatedError: ApiFailure = {
  endpoint: '/api/records',
  kind: 'server',
  message: 'Simulated error state.',
  retryable: true,
};

export function useRecords(userId?: string) {
  const { devScenario, selectedRole } = useRole();
  const [records, setRecords] = useState<RecordItem[]>([]);
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
        setRecords([]);
        setError(null);
        setLoading(false);
        return;
      }

      if (devScenario === 'error') {
        setRecords([]);
        setError(simulatedError);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const payload = await fetchRecords(selectedRole, userId);
        if (!mounted) {
          return;
        }
        setRecords(payload?.records ?? []);
      } catch (failure) {
        if (mounted) {
          setRecords([]);
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
  }, [devScenario, refreshSeed, selectedRole, userId]);

  return { records, loading, error, refresh };
}
