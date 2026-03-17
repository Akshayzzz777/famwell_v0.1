import { useState, useEffect } from 'react';
import { documentService } from '../services/documentService';

interface JobStatus {
  job_id: string;
  file_id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export const useJobStatus = (jobId: string | null, pollInterval = 3000) => {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let intervalId: ReturnType<typeof setInterval> | undefined;
    let mounted = true;

    const checkStatus = async () => {
      try {
        if (!mounted) return;
        setLoading(true);

        const data = await documentService.getJobStatus(jobId);
        if (mounted) {
          setStatus(data);

          // Stop polling when complete
          if (data.status === 'COMPLETED' || data.status === 'FAILED') {
            if (intervalId) clearInterval(intervalId);
          }
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.response?.data?.detail || 'Status check failed');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Check immediately
    checkStatus();

    // Poll at interval
    intervalId = setInterval(checkStatus, pollInterval);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, pollInterval]);

  return { status, loading, error };
};
