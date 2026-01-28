// React Expo Mobile App - Starter Template
// Copy this structure into your Expo project

// ============================================
// 1. services/api.ts
// ============================================

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Add token to all requests
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 (token expired)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      SecureStore.deleteItemAsync('auth_token');
    }
    return Promise.reject(error);
  }
);

export default api;

// ============================================
// 2. services/documentService.ts
// ============================================

import api from './api';
import * as DocumentPicker from 'expo-document-picker';

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

  // Pick PDF from device
  async pickPDF() {
    const document = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
    });

    if (document.canceled) {
      return null;
    }

    return document.assets[0];
  },
};

// ============================================
// 3. hooks/useFileUpload.ts
// ============================================

import { useState } from 'react';
import { documentService } from '../services/documentService';

export const useFileUpload = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async () => {
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
  };

  return { uploadFile, loading, error };
};

// ============================================
// 4. hooks/useJobStatus.ts
// ============================================

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

    let intervalId: NodeJS.Timeout;
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

// ============================================
// 5. hooks/useJobResult.ts
// ============================================

import { useState } from 'react';
import { documentService } from '../services/documentService';

export const useJobResult = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getResult = async (jobId: string) => {
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
  };

  return { result, loading, error, getResult };
};

// ============================================
// 6. screens/DocumentProcessorScreen.tsx
// ============================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useFileUpload } from '../hooks/useFileUpload';
import { useJobStatus } from '../hooks/useJobStatus';
import { useJobResult } from '../hooks/useJobResult';

export const DocumentProcessorScreen = () => {
  const { uploadFile, loading: uploading, error: uploadError } = useFileUpload();
  const { status, loading: statusLoading } = useJobStatus(jobId);
  const { result, loading: resultLoading, getResult } = useJobResult();
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const handleUploadPress = async () => {
    try {
      const uploadResult = await uploadFile();
      if (uploadResult) {
        setJobId(uploadResult.job_id);
        setFileName(uploadResult.filename);
      }
    } catch (error) {
      Alert.alert('Upload Failed', uploadError || 'Unable to upload file');
    }
  };

  const handleGetResults = async () => {
    if (!jobId) return;
    try {
      await getResult(jobId);
    } catch (error) {
      Alert.alert('Error', 'Unable to fetch results');
    }
  };

  const renderStatusBadge = () => {
    if (!status) return null;

    const statusColor = {
      PENDING: '#FFA500',
      PROCESSING: '#1E90FF',
      COMPLETED: '#00AA00',
      FAILED: '#FF0000',
    }[status.status];

    return (
      <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
        <Text style={styles.statusText}>{status.status}</Text>
      </View>
    );
  };

  const renderProgressBar = () => {
    if (!status) return null;
    return (
      <View style={styles.progressContainer}>
        <View
          style={[
            styles.progressBar,
            { width: `${status.progress}%` },
          ]}
        />
        <Text style={styles.progressText}>{status.progress}%</Text>
      </View>
    );
  };

  const renderExtractedData = () => {
    if (!result?.extracted_data) return null;

    const data = result.extracted_data.data;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Extracted Data</Text>
        <Text style={styles.label}>Document Type:</Text>
        <Text style={styles.value}>{data.document_type}</Text>
        <Text style={styles.label}>Extracted Text:</Text>
        <Text style={styles.value}>
          {data.extracted_text.substring(0, 200)}...
        </Text>
      </View>
    );
  };

  const renderLLMResult = () => {
    if (!result?.llm_result) return null;

    const llm = result.llm_result;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Analysis</Text>
        <Text style={styles.label}>Model:</Text>
        <Text style={styles.value}>{llm.model_used}</Text>
        <Text style={styles.label}>Processing Time:</Text>
        <Text style={styles.value}>{llm.processing_time_seconds}s</Text>
        <Text style={styles.label}>Response:</Text>
        <Text style={styles.value}>{llm.response.substring(0, 200)}...</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Document Processor</Text>

      {/* Upload Section */}
      <View style={styles.section}>
        <Button
          title={uploading ? 'Uploading...' : 'Select & Upload PDF'}
          onPress={handleUploadPress}
          disabled={uploading || !!jobId}
        />
        {uploadError && <Text style={styles.error}>{uploadError}</Text>}
      </View>

      {/* Status Section */}
      {jobId && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>File: {fileName}</Text>
          {renderStatusBadge()}
          {renderProgressBar()}

          {statusLoading && <ActivityIndicator size="large" />}

          {status && (
            <View style={styles.statusDetails}>
              <Text style={styles.label}>Job ID:</Text>
              <Text style={styles.value}>{jobId}</Text>
              <Text style={styles.label}>Created:</Text>
              <Text style={styles.value}>
                {new Date(status.created_at).toLocaleString()}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Results Section */}
      {status?.status === 'COMPLETED' && !result && (
        <View style={styles.section}>
          <Button
            title={resultLoading ? 'Loading Results...' : 'Get Results'}
            onPress={handleGetResults}
            disabled={resultLoading}
          />
        </View>
      )}

      {result && (
        <>
          {renderExtractedData()}
          {renderLLMResult()}
        </>
      )}

      {status?.status === 'FAILED' && (
        <View style={styles.errorSection}>
          <Text style={styles.error}>Processing Failed</Text>
          <Text>{status.error_message}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  progressContainer: {
    marginVertical: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#1E90FF',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusDetails: {
    marginTop: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  value: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  errorSection: {
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  error: {
    color: '#D32F2F',
    fontWeight: 'bold',
  },
});

export default DocumentProcessorScreen;

// ============================================
// 7. app.json
// ============================================

{
  "expo": {
    "name": "Document Processor",
    "slug": "document-processor-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTabletMode": true,
      "infoPlist": {
        "NSLocalNetworkUsageDescription": "Connect to API server",
        "NSBonjourServiceTypes": ["_http._tcp"]
      }
    },
    "android": {
      "usesCleartextTraffic": true,
      "permissions": ["android.permission.INTERNET"]
    },
    "web": {
      "bundler": "metro"
    },
    "plugins": [
      [
        "expo-secure-store",
        {
          "faceIDPermission": "Allow $(PRODUCT_NAME) to use Face ID"
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      }
    }
  }
}

// ============================================
// 8. .env.local
// ============================================

# API Configuration
EXPO_PUBLIC_API_URL=http://10.0.0.1:8000

# For iOS Simulator, use:
# EXPO_PUBLIC_API_URL=http://localhost:8000

# For Production, use:
# EXPO_PUBLIC_API_URL=https://api.yourdomain.com

// ============================================
// 9. package.json
// ============================================

{
  "name": "document-processor-mobile",
  "version": "1.0.0",
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "build": "eas build --platform all"
  },
  "dependencies": {
    "expo": "^50.0.0",
    "react": "18.2.0",
    "react-native": "0.73.0",
    "axios": "^1.6.0",
    "expo-secure-store": "^12.0.0",
    "expo-document-picker": "^11.0.0",
    "@react-native-community/netinfo": "^11.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "typescript": "^5.1.0"
  },
  "private": true
}
