// Type definitions for the Document Processor API

export interface UploadResponse {
  file_id: string;
  job_id: string;
  upload_url: string;
  expires_in_seconds: number;
  filename: string;
}

export interface JobStatus {
  job_id: string;
  file_id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress: number;
  retry_count: number;
  error_message?: string;
}

export interface ExtractedData {
  extraction_id: string;
  data: {
    document_type: string;
    extracted_text: string;
    tables: any[];
    metadata: Record<string, any>;
  };
  validation_status: string;
}

export interface LLMResult {
  result_id: string;
  response: string;
  structured_output: Record<string, any>;
  processing_time_seconds: number;
  model_used: string;
  created_at: string;
}

export interface JobResult {
  job_id: string;
  file_id: string;
  status: 'COMPLETED' | 'FAILED';
  completed_at: string;
  extracted_data?: ExtractedData;
  llm_result?: LLMResult;
}

export interface Document {
  uri: string;
  name: string;
  size: number;
  type: string;
  lastModified?: number;
}

export interface ApiError {
  detail?: string;
  error?: string;
  message?: string;
  status?: number;
}
