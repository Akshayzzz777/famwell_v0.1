import { useCallback, useState } from 'react';
import { documentService } from '../services/documentService';

export const useFileUpload = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Pick file
      const file = await documentService.pickPDF();
      if (!file) return null;

      // Upload
      const result = await documentService.uploadPDF(file.uri, file.name);
      return result;
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Upload failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { uploadFile, loading, error };
};
