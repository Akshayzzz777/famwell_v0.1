import { useCallback, useEffect, useState } from 'react';
import { fetchMedicalRecords, type MedicalRecordItem } from '../services/api';
import { useRole } from '../context/RoleContext';

export function useMedicalRecords() {
  const { selectedRole } = useRole();
  const [records, setRecords] = useState<MedicalRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMedicalRecords(selectedRole);
      setRecords(data.records);
    } catch (err: any) {
      setError({ message: err?.message || 'Failed to load medical records' });
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => {
    load();
  }, [load]);

  return { records, loading, error, reload: load };
}
