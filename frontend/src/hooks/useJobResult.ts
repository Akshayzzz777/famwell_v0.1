import { useCallback, useState } from 'react';
import { documentService } from '../services/documentService';

export const useJobResult = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getResult = useCallback(async (jobId: string) => {
    try {
      setLoading(true);
      setError(null);

      const data = await documentService.getJobResult(jobId);
      setResult(data);
      return data;
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Failed to fetch result';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, getResult };
};
