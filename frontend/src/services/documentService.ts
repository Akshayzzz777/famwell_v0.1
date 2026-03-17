import api from './api';

export const documentService = {
  // Upload PDF
  async uploadPDF(fileUri: string, fileName: string) {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: 'application/pdf',
    } as any);

    const response = await api.post('/api/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data; // { file_id, job_id, upload_url, filename }
  },

  // Check job status
  async getJobStatus(jobId: string) {
    const response = await api.get(`/api/status/${jobId}`);
    return response.data; // { status, progress, ... }
  },

  // Get processing result
  async getJobResult(jobId: string) {
    const response = await api.get(`/api/result/${jobId}`);
    return response.data; // { extracted_data, llm_result, ... }
  },

  // Simple file mock (since expo-document-picker not available)
  async pickPDF() {
    console.log('Note: File picker requires native build. Using mock data.');
    return {
      uri: 'file:///mock/document.pdf',
      name: 'document.pdf',
      size: 1024,
      type: 'application/pdf',
    };
  },
};
