import { useCallback, useEffect, useState } from 'react';

import { useRole } from '../context/RoleContext';
import { fetchConnections, type ApiFailure, type ConnectionItem } from '../services/api';

const simulatedError: ApiFailure = {
  endpoint: '/api/connections',
  kind: 'server',
  message: 'Simulated error state.',
  retryable: true,
};

export function useConnections() {
  const { devScenario, selectedRole } = useRole();
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);
  const [refreshSeed, setRefreshSeed] = useState(0);

  const refresh = useCallback(() => {
    setRefreshSeed((value) => value + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (selectedRole !== 'PATIENT') {
        setConnections([]);
        setError(null);
        setLoading(false);
        return;
      }

      if (devScenario === 'empty') {
        setConnections([]);
        setError(null);
        setLoading(false);
        return;
      }

      if (devScenario === 'error') {
        setConnections([]);
        setError(simulatedError);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const payload = await fetchConnections(selectedRole);
        if (!mounted) {
          return;
        }
        setConnections(payload?.connections ?? []);
      } catch (failure) {
        if (mounted) {
          setConnections([]);
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

  return { connections, loading, error, refresh };
}
