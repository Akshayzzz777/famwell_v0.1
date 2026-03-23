import { useEffect, useState } from 'react';

import { useRole } from '../context/RoleContext';
import { fetchJobStatus, type ApiFailure } from '../services/api';

interface JobStatus {
  job_id: string;
  file_id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export const useJobStatus = (jobId: string | null, pollInterval = 3000, refreshSeed = 0) => {
  const { selectedRole } = useRole();
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);

  useEffect(() => {
    if (!jobId) {
      setStatus(null);
      setError(null);
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | undefined;
    let mounted = true;

    const checkStatus = async () => {
      try {
        if (!mounted) {
          return;
        }

        setLoading(true);
        setError(null);

        const data = await fetchJobStatus(selectedRole, jobId);
        if (!mounted) {
          return;
        }

        setStatus(data);

        if (data?.status === 'COMPLETED' || data?.status === 'FAILED') {
          if (intervalId) {
            clearInterval(intervalId);
          }
        }
      } catch (failure) {
        if (mounted) {
          setError(failure as ApiFailure);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkStatus();
    intervalId = setInterval(checkStatus, pollInterval);

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [jobId, pollInterval, refreshSeed, selectedRole]);

  return { status, loading, error };
};
