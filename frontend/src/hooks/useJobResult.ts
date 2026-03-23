import { useCallback, useState } from 'react';

import { useRole } from '../context/RoleContext';
import { fetchJobResult, type ApiFailure } from '../services/api';

export const useJobResult = () => {
  const { selectedRole } = useRole();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);

  const getResult = useCallback(
    async (jobId: string) => {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchJobResult(selectedRole, jobId);
        setResult(data);
        return data;
      } catch (failure) {
        setError(failure as ApiFailure);
        throw failure;
      } finally {
        setLoading(false);
      }
    },
    [selectedRole]
  );

  return { result, loading, error, getResult };
};
