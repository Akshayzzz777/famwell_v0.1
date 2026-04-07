import axios, { AxiosError } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type UiRole = 'PATIENT' | 'DOCTOR';
export type BackendRole = 'USER' | 'DOCTOR';

export type SessionUser = {
  userId: string;
  email: string;
  role: BackendRole;
  fullName?: string | null;
  phoneNumber?: string | null;
  healthId?: string | null;
  createdAt?: string | null;
  isActive?: boolean | null;
};

export type AuthSession = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: SessionUser;
};

export type RecordItem = {
  record_id: string;
  user_id: string;
  record_type: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type RecordsPayload = {
  owner_user_id: string;
  records: RecordItem[];
};

export type ConnectionItem = {
  connection_id: string;
  follower_id: string;
  following_id: string;
  status: string;
  created_at: string;
  user: {
    email: string;
    role: BackendRole;
    full_name?: string | null;
    phone_number?: string | null;
    health_id?: string | null;
  };
};

export type ConnectionsPayload = {
  connections: ConnectionItem[];
};

export type InsightsPayload = {
  status: string;
  message: string;
};

export type HealthPayload = {
  status: string;
  environment?: string;
  api_version?: string;
  database?: string;
  authenticated?: boolean;
  role?: BackendRole | null;
  user?: {
    user_id?: string | null;
    email?: string | null;
    role?: BackendRole | null;
    health_id?: string | null;
    full_name?: string | null;
  } | null;
};

export type UploadResponse = {
  medical_record_id: string;
  user_id: string;
  file_url: string;
  file_name: string;
  record_type: string;
  upload_date: string;
};

export type JobStatusResponse = {
  job_id: string;
  file_id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  created_at: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  progress: number;
  retry_count?: number;
  error_message?: string | null;
};

export type JobResultResponse = {
  job_id: string;
  file_id: string;
  status: string;
  completed_at?: string | null;
  extracted_data?: {
    extraction_id: string;
    data: Record<string, unknown>;
    validation_status: string;
    extracted_at: string;
  };
  llm_result?: {
    result_id: string;
    response: string;
    structured_output?: Record<string, unknown> | null;
    processing_time_seconds: number;
    model_used: string;
    created_at: string;
  };
};

export type PickedPdf = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number | null;
  file?: File | null;
};

export type ApiErrorKind = 'unauthorized' | 'timeout' | 'network' | 'server' | 'unknown';

export type ApiFailure = {
  endpoint: string;
  message: string;
  kind: ApiErrorKind;
  retryable: boolean;
  status?: number;
  body?: unknown;
};

type PersistedAccess = {
  role: UiRole | null;
  token: string | null;
  user: SessionUser | null;
};

type SuccessEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

type ApiClientRequestConfig = {
  _apiCandidateIndex?: number;
  baseURL?: string;
  url?: string;
  headers?: {
    Authorization?: string;
  };
};

const memoryStorage = new Map<string, string>();
const TOKEN_KEY = 'famwell_access_token';
const ROLE_KEY = 'famwell_selected_role';
const USER_KEY = 'famwell_session_user';
const PRODUCTION_API_URL = Constants.expoConfig?.extra?.apiUrl ?? 'https://famwell-v0-1.onrender.com';
const PROJECT_DEFAULT_API_URLS = (Constants.expoConfig?.extra?.apiUrls as string[] | undefined) ?? [PRODUCTION_API_URL];

let unauthorizedHandler: ((failure: ApiFailure) => void) | null = null;

function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/$/, '');
}

function parseConfiguredApiUrls(raw?: string | null) {
  if (!raw) {
    return [] as string[];
  }

  return raw
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeBaseUrl);
}

function dedupeUrls(urls: string[]) {
  return [...new Set(urls)];
}

function getExpoConfiguredApiUrl() {
  const expoConfig = Constants.expoConfig as { extra?: { apiUrl?: string } } | null;
  const configured = expoConfig?.extra?.apiUrl?.trim();
  return configured ? normalizeBaseUrl(configured) : null;
}

function getExpoConfiguredApiUrls() {
  const expoConfig = Constants.expoConfig as { extra?: { apiUrls?: string[] | string } } | null;
  const configured = expoConfig?.extra?.apiUrls;

  if (Array.isArray(configured)) {
    return configured.map(normalizeBaseUrl);
  }

  return parseConfiguredApiUrls(configured);
}

function getExpoHost() {
  const expoConfigHost = (Constants.expoConfig as { hostUri?: string } | null)?.hostUri;
  const manifestDebuggerHost = (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;
  const manifest2DebuggerHost = (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } }).manifest2?.extra?.expoGo?.debuggerHost;
  const hostSource = expoConfigHost || manifestDebuggerHost || manifest2DebuggerHost;

  if (!hostSource) {
    return null;
  }

  return hostSource.split(':')[0] || null;
}

function resolveApiBaseUrls() {
  const candidates: string[] = [];
  const configuredUrls = parseConfiguredApiUrls(process.env.EXPO_PUBLIC_API_URLS);
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();

  // Production URL always first — guaranteed reachable from any device
  candidates.push(PRODUCTION_API_URL);

  // Explicitly configured URLs from app.json
  candidates.push(...getExpoConfiguredApiUrls());

  const expoConfigured = getExpoConfiguredApiUrl();
  if (expoConfigured) {
    candidates.push(expoConfigured);
  }

  candidates.push(...configuredUrls);

  if (configured) {
    candidates.push(normalizeBaseUrl(configured));
  }

  candidates.push(...PROJECT_DEFAULT_API_URLS.map(normalizeBaseUrl));

  // Expo debug host (auto-detected LAN IP from Metro bundler) — dev only
  const expoHost = getExpoHost();
  if (expoHost && expoHost !== 'localhost' && expoHost !== '127.0.0.1') {
    candidates.push(`http://${expoHost}:8000`);
  }

  // On web, also try localhost
  if (Platform.OS === 'web') {
    candidates.push('http://127.0.0.1:8000');
  }

  // On Android emulator only — 10.0.2.2 maps to host machine localhost
  if (Platform.OS === 'android') {
    candidates.push('http://10.0.2.2:8000');
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
    candidates.push(`http://${host}:8000`);
  }

  return dedupeUrls(candidates);
}

export const API_BASE_URLS = resolveApiBaseUrls();
export const API_BASE_URL = API_BASE_URLS[0];

function readStorage(key: string) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {}

  return memoryStorage.get(key) ?? null;
}

function writeStorage(key: string, value: string) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {}

  memoryStorage.set(key, value);
}

function removeStorage(key: string) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return;
    }
  } catch {}

  memoryStorage.delete(key);
}

function parseUser(raw: string | null) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

function createFailure(
  endpoint: string,
  kind: ApiErrorKind,
  message: string,
  options?: Pick<ApiFailure, 'body' | 'retryable' | 'status'>
): ApiFailure {
  return {
    endpoint,
    kind,
    message,
    retryable: options?.retryable ?? false,
    status: options?.status,
    body: options?.body,
  };
}

function unwrapSuccess<T>(endpoint: string, payload: unknown) {
  if (payload && typeof payload === 'object' && 'success' in (payload as Record<string, unknown>)) {
    const envelope = payload as SuccessEnvelope<T>;
    if (!envelope.success) {
      throw createFailure(endpoint, 'unknown', envelope.message || 'Request failed.', {
        body: payload,
        retryable: false,
      });
    }

    return (envelope.data ?? null) as T;
  }

  return (payload ?? null) as T;
}

function normalizeError(endpoint: string, error: unknown): ApiFailure {
  const axiosError = error as AxiosError;
  const attemptedBaseUrl = axiosError.config?.baseURL || API_BASE_URL;
  const status = axiosError.response?.status;
  const body = axiosError.response?.data as { message?: string } | undefined;
  const message = body?.message || axiosError.message || 'Unexpected API error.';

  if (status === 401 || status === 403) {
    return createFailure(endpoint, 'unauthorized', message, { retryable: false, status, body });
  }

  if (axiosError.code === 'ECONNABORTED') {
    return createFailure(endpoint, 'timeout', message, { retryable: true, status, body });
  }

  if (status && status >= 500) {
    return createFailure(endpoint, 'server', message, { retryable: true, status, body });
  }

  if (axiosError.request && !axiosError.response) {
    return createFailure(
      endpoint,
      'network',
      `Network request failed. Attempted API base URL: ${attemptedBaseUrl}. Available API base URLs: ${API_BASE_URLS.join(', ')}`,
      {
      retryable: true,
      status,
      body,
      }
    );
  }

  return createFailure(endpoint, 'unknown', message, { retryable: false, status, body });
}

function mapSessionUser(payload: any): SessionUser {
  return {
    userId: payload?.user_id,
    email: payload?.email,
    role: payload?.role,
    fullName: payload?.full_name ?? null,
    phoneNumber: payload?.phone_number ?? null,
    healthId: payload?.health_id ?? null,
    createdAt: payload?.created_at ?? null,
    isActive: payload?.is_active ?? null,
  };
}

function ensureRole(role: UiRole | null, endpoint: string) {
  if (!role) {
    throw createFailure(endpoint, 'unauthorized', 'Select a role to continue.', { retryable: false });
  }
}

function ensureAllowedRole(role: UiRole | null, endpoint: string, allowedRoles: UiRole[]) {
  ensureRole(role, endpoint);

  if (role && !allowedRoles.includes(role)) {
    throw createFailure(endpoint, 'unauthorized', 'The selected role cannot access this feature.', {
      retryable: false,
    });
  }
}

function ensureToken(endpoint: string) {
  const persisted = loadPersistedAccess();
  if (!persisted.token) {
    throw createFailure(endpoint, 'unauthorized', 'Login is required to continue.', { retryable: false });
  }

  return persisted.token;
}

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const requestConfig = config as typeof config & ApiClientRequestConfig;
  const persisted = loadPersistedAccess();

  const baseUrlIndex = requestConfig._apiCandidateIndex ?? 0;
  requestConfig._apiCandidateIndex = baseUrlIndex;
  config.baseURL = API_BASE_URLS[baseUrlIndex] ?? API_BASE_URL;

  if (persisted.token) {
    config.headers.Authorization = `Bearer ${persisted.token}`;
  }

  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const endpoint = error.config?.url ?? 'unknown';
    const requestConfig = error.config as (typeof error.config & ApiClientRequestConfig) | undefined;
    const failure = normalizeError(endpoint, error);

    if (failure.kind === 'network' && requestConfig) {
      const currentIndex = requestConfig._apiCandidateIndex ?? 0;
      const nextIndex = currentIndex + 1;
      // On web, FormData with File blobs cannot be replayed after stream is consumed.
      // On native, FormData uses {uri, name, type} references which are safe to retry.
      const isWebFileUpload = Platform.OS === 'web' && requestConfig.data instanceof FormData;

      if (!isWebFileUpload && nextIndex < API_BASE_URLS.length) {
        requestConfig._apiCandidateIndex = nextIndex;
        requestConfig.baseURL = API_BASE_URLS[nextIndex];
        return client.request(requestConfig);
      }
    }

    if (failure.kind === 'unauthorized' && !endpoint.includes('/api/auth/')) {
      clearPersistedAccess();
      unauthorizedHandler?.(failure);
    }

    return Promise.reject(failure);
  }
);

export function loadPersistedAccess(): PersistedAccess {
  const role = readStorage(ROLE_KEY);

  return {
    role: role === 'PATIENT' || role === 'DOCTOR' ? role : null,
    token: readStorage(TOKEN_KEY),
    user: parseUser(readStorage(USER_KEY)),
  };
}

export function persistSelectedRole(role: UiRole) {
  writeStorage(ROLE_KEY, role);
}

export function persistAccessToken(token: string) {
  writeStorage(TOKEN_KEY, token);
}

export function persistSessionUser(user: SessionUser) {
  writeStorage(USER_KEY, JSON.stringify(user));
}

export function clearPersistedAccess() {
  removeStorage(ROLE_KEY);
  removeStorage(TOKEN_KEY);
  removeStorage(USER_KEY);
}

export function setUnauthorizedHandler(handler: ((failure: ApiFailure) => void) | null) {
  unauthorizedHandler = handler;
}

export async function healthCheck() {
  const response = await client.get('/health');
  return unwrapSuccess<HealthPayload>('/health', response.data);
}

export async function loginUser(input: { email: string; password: string; role: UiRole }) {
  const response = await client.post('/api/auth/login', {
    email: input.email.trim().toLowerCase(),
    password: input.password,
    selected_role: input.role,
  });

  const data = unwrapSuccess<any>('/api/auth/login', response.data);
  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
    user: mapSessionUser(data.user),
  } as AuthSession;
}

export async function registerUser(input: {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: UiRole;
}) {
  const response = await client.post('/api/auth/register', {
    full_name: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    phone_number: input.phoneNumber.trim(),
    password: input.password,
    selected_role: input.role,
  });

  const data = unwrapSuccess<any>('/api/auth/register', response.data);
  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
    user: mapSessionUser(data.user),
  } as AuthSession;
}

export async function googleSignIn(input: { token: string; role: UiRole }) {
  const response = await client.post('/api/auth/google', {
    token: input.token,
    selected_role: input.role,
  });

  const data = unwrapSuccess<any>('/api/auth/google', response.data);
  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
    user: mapSessionUser(data.user),
  } as AuthSession;
}

export async function fetchRecords(role: UiRole | null, userId?: string) {
  ensureRole(role, '/api/records');
  ensureToken('/api/records');

  const response = await client.get('/api/records', {
    params: userId ? { user_id: userId } : undefined,
  });

  return unwrapSuccess<RecordsPayload>('/api/records', response.data);
}

export async function createRecord(
  role: UiRole | null,
  input: { recordType: string; data: Record<string, unknown>; userId?: string }
) {
  ensureRole(role, '/api/records');
  ensureToken('/api/records');

  const response = await client.post('/api/records', {
    record_type: input.recordType,
    data: input.data,
    user_id: input.userId,
  });

  return unwrapSuccess<RecordItem>('/api/records', response.data);
}

export async function fetchConnections(role: UiRole | null) {
  ensureAllowedRole(role, '/api/connections', ['PATIENT']);
  ensureToken('/api/connections');

  const response = await client.get('/api/connections');
  return unwrapSuccess<ConnectionsPayload>('/api/connections', response.data);
}

export async function followByHealthId(role: UiRole | null, healthId: string) {
  ensureAllowedRole(role, '/api/follow', ['PATIENT']);
  ensureToken('/api/follow');

  const response = await client.post('/api/follow', {
    health_id: healthId.trim().toUpperCase(),
  });

  return unwrapSuccess<ConnectionItem>('/api/follow', response.data);
}

export async function fetchInsights(role: UiRole | null) {
  ensureRole(role, '/api/insights');
  ensureToken('/api/insights');

  const response = await client.get('/api/insights');
  return unwrapSuccess<InsightsPayload>('/api/insights', response.data);
}

export async function uploadPdf(role: UiRole | null, file: PickedPdf) {
  ensureRole(role, '/api/medical-records/upload');
  const token = ensureToken('/api/medical-records/upload');

  const formData = new FormData();

  if (Platform.OS === 'web' && file.file) {
    formData.append('file', file.file);
  } else {
    // On Android, ensure the URI has a file:// scheme
    let fileUri = file.uri;
    if (Platform.OS === 'android' && fileUri && !fileUri.startsWith('file://') && !fileUri.startsWith('content://')) {
      fileUri = `file://${fileUri}`;
    }
    formData.append('file', {
      uri: fileUri,
      name: file.name,
      type: file.mimeType || 'application/pdf',
    } as never);
  }
  formData.append('record_type', 'general');

  // Use XMLHttpRequest for file uploads — it is the most reliable
  // transport for multipart FormData with file URIs on React Native.
  const base = API_BASE_URLS[0] ?? API_BASE_URL;
  const url = `${base}/api/medical-records/upload`;

  console.log('[uploadPdf] uploading to', url, 'file:', file.uri, 'name:', file.name);

  return new Promise<UploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.timeout = 120_000; // 2 min for large PDFs

    xhr.onload = () => {
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        reject(createFailure('/api/medical-records/upload', 'server',
          `Non-JSON response: ${xhr.responseText?.slice(0, 100)}`,
          { status: xhr.status, retryable: false }));
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        const envelope = json as SuccessEnvelope<UploadResponse>;
        resolve((envelope.data ?? json) as UploadResponse);
      } else {
        reject(createFailure('/api/medical-records/upload', 'server',
          ((json?.detail || json?.message || `Upload failed (${xhr.status})`) as string),
          { status: xhr.status, body: json, retryable: false }));
      }
    };

    xhr.onerror = () => {
      console.warn('[uploadPdf] XHR error on', url, 'status:', xhr.status, 'response:', xhr.responseText);
      reject(createFailure('/api/medical-records/upload', 'network',
        `Network request failed. URL: ${url}`,
        { retryable: true }));
    };

    xhr.ontimeout = () => {
      reject(createFailure('/api/medical-records/upload', 'timeout',
        `Upload timed out after 120s. URL: ${url}`,
        { retryable: true }));
    };

    xhr.send(formData);
  });
}

export async function fetchJobStatus(role: UiRole | null, jobId: string) {
  ensureRole(role, `/api/status/${jobId}`);
  ensureToken(`/api/status/${jobId}`);

  const response = await client.get(`/api/status/${jobId}`);
  return response.data as JobStatusResponse;
}

export async function fetchJobResult(role: UiRole | null, jobId: string) {
  ensureRole(role, `/api/result/${jobId}`);
  ensureToken(`/api/result/${jobId}`);

  const response = await client.get(`/api/result/${jobId}`);
  return response.data as JobResultResponse;
}

// ── Health Insights ──

export type MetricDetail = {
  value: string | number;
  unit?: string;
  normal_range?: string;
  status?: string;
};

export type StructuredInsight = {
  id: string;
  title: string;
  description: string;
  category: string;
};

export type InsightItem = string | StructuredInsight;

export type HealthAnalysis = {
  health_score: number | null;
  stress_score: number | null;
  metrics: Record<string, MetricDetail | string | number>;
  risks: string[];
  insights: InsightItem[];
  recommendations: InsightItem[];
};

export async function fetchHealthInsights(role: UiRole | null, recordId: string) {
  ensureRole(role, `/api/health-insights/${recordId}`);
  ensureToken(`/api/health-insights/${recordId}`);

  const response = await client.get(`/api/health-insights/${recordId}`);
  return unwrapSuccess<HealthAnalysis>(`/api/health-insights/${recordId}`, response.data);
}

export async function fetchLatestHealthInsights(role: UiRole | null) {
  ensureRole(role, '/api/health-insights/latest');
  ensureToken('/api/health-insights/latest');

  const response = await client.get('/api/health-insights/latest');
  return unwrapSuccess<HealthAnalysis>('/api/health-insights/latest', response.data);
}

// ── Health Insights History & Ask AI ──

export type HistoryEntry = {
  record_id: string;
  file_name: string | null;
  upload_date: string | null;
  analyzed_at: string | null;
  health_score: number | null;
  stress_score: number | null;
  metrics: Record<string, MetricDetail | string | number>;
  insights: InsightItem[];
  recommendations: InsightItem[];
  risks: string[];
};

export type HealthHistoryPayload = {
  history: HistoryEntry[];
  count: number;
};

export type AskAiResponse = {
  explanation: string;
  trend: 'improving' | 'worsening' | 'stable' | 'insufficient_data';
  trend_summary: string;
  recommendations: string[];
  risks: string[];
  confidence: 'high' | 'medium' | 'low';
  parameter: string;
  conversation_id?: string;
};

export async function fetchHealthHistory(role: UiRole | null, limit = 10) {
  ensureRole(role, '/api/health-insights/history');
  ensureToken('/api/health-insights/history');

  const response = await client.get('/api/health-insights/history', { params: { limit } });
  return unwrapSuccess<HealthHistoryPayload>('/api/health-insights/history', response.data);
}

export async function askAiInsight(role: UiRole | null, parameter: string, conversationId?: string) {
  ensureRole(role, '/api/health-insights/ask-ai');
  ensureToken('/api/health-insights/ask-ai');

  const response = await client.post('/api/health-insights/ask-ai', {
    parameter,
    conversation_id: conversationId,
  });
  return unwrapSuccess<AskAiResponse>('/api/health-insights/ask-ai', response.data);
}

// ── Doctor Recommendations ──

export type DoctorItem = {
  id: string;
  name: string;
  specialization: string;
  experience: string;
  rating: number;
  health_id: string;
  avatar_url: string | null;
  reason: string;
};

export type RecommendedDoctorsPayload = {
  doctors: DoctorItem[];
  matched_specializations: string[];
};

export type DoctorSearchPayload = {
  doctors: DoctorItem[];
};

export async function fetchRecommendedDoctors(role: UiRole | null, recordId?: string) {
  ensureRole(role, '/api/doctors/recommended');
  ensureToken('/api/doctors/recommended');

  const response = await client.get('/api/doctors/recommended', {
    params: recordId ? { record_id: recordId } : undefined,
  });
  return unwrapSuccess<RecommendedDoctorsPayload>('/api/doctors/recommended', response.data);
}

export async function searchDoctors(role: UiRole | null, query: string) {
  ensureRole(role, '/api/doctors/search');
  ensureToken('/api/doctors/search');

  const response = await client.get('/api/doctors/search', {
    params: { q: query },
  });
  return unwrapSuccess<DoctorSearchPayload>('/api/doctors/search', response.data);
}

// ── User Search & Connection Management ──

export type UserSearchItem = {
  user_id: string;
  role: string;
  full_name: string | null;
  health_id: string | null;
  connection_status: 'none' | 'pending' | 'accepted' | 'rejected';
  connection_id: string | null;
};

export type UserSearchPayload = {
  users: UserSearchItem[];
};

export async function searchUserByHealthId(role: UiRole | null, healthId: string) {
  ensureRole(role, '/api/users/search');
  ensureToken('/api/users/search');

  const response = await client.get('/api/users/search', {
    params: { health_id: healthId.trim() },
  });
  return unwrapSuccess<UserSearchPayload>('/api/users/search', response.data);
}

export async function searchUserByName(role: UiRole | null, query: string) {
  ensureRole(role, '/api/users/search');
  ensureToken('/api/users/search');

  const response = await client.get('/api/users/search', {
    params: { q: query.trim() },
  });
  return unwrapSuccess<UserSearchPayload>('/api/users/search', response.data);
}

export async function fetchPendingRequests(role: UiRole | null) {
  ensureAllowedRole(role, '/api/connections/pending', ['PATIENT']);
  ensureToken('/api/connections/pending');

  const response = await client.get('/api/connections/pending');
  return unwrapSuccess<ConnectionsPayload>('/api/connections/pending', response.data);
}

export async function actionConnection(role: UiRole | null, connectionId: string, action: 'accepted' | 'rejected') {
  ensureAllowedRole(role, '/api/follow-action', ['PATIENT']);
  ensureToken('/api/follow-action');

  const response = await client.post('/api/follow-action', {
    connection_id: connectionId,
    action,
  });
  return unwrapSuccess<ConnectionItem>('/api/follow-action', response.data);
}

export async function seedUsers(role: UiRole | null) {
  ensureRole(role, '/api/users/seed');
  ensureToken('/api/users/seed');

  const response = await client.post('/api/users/seed');
  return unwrapSuccess<{ seeded: number; message: string }>('/api/users/seed', response.data);
}

// ── Doctor Dashboard & Profile ──

export type DoctorAppointment = {
  appointment_id: string;
  date: string;
  time: string;
  type: string;
  status: string;
  notes: string | null;
  patient_name: string | null;
  patient_health_id: string | null;
};

export type DoctorPatient = {
  connection_id: string;
  user_id: string;
  full_name: string | null;
  health_id: string | null;
  email: string;
  phone_number: string | null;
  connected_at?: string;
  created_at?: string;
};

export type DoctorDashboardPayload = {
  appointments: DoctorAppointment[];
  patients: DoctorPatient[];
  stats: {
    total_patients: number;
    completed_appointments: number;
  };
};

export type DoctorProfilePayload = {
  user_id: string;
  email: string;
  full_name: string | null;
  health_id: string | null;
  role: string;
  phone_number: string | null;
  specialization: string | null;
  experience: string | null;
  hospital_affiliation: string | null;
  education: string | null;
  created_at: string;
  patient_count: number;
  rating: number;
};

export type AppointmentItem = {
  appointment_id: string;
  date: string;
  time: string;
  type: string;
  status: string;
  notes: string | null;
  created_at: string;
  other_name: string | null;
  other_health_id: string | null;
  other_user_id: string | null;
};

export type PrescriptionItem = {
  prescription_id: string;
  medication: string;
  dosage: string;
  duration: string;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  patient_name?: string | null;
  patient_health_id?: string | null;
  doctor_name?: string | null;
  doctor_health_id?: string | null;
};

export async function fetchDoctorDashboard(role: UiRole | null) {
  ensureAllowedRole(role, '/api/doctor/dashboard', ['DOCTOR']);
  ensureToken('/api/doctor/dashboard');

  const response = await client.get('/api/doctor/dashboard');
  return unwrapSuccess<DoctorDashboardPayload>('/api/doctor/dashboard', response.data);
}

export async function fetchDoctorPatients(role: UiRole | null) {
  ensureAllowedRole(role, '/api/doctor/patients', ['DOCTOR']);
  ensureToken('/api/doctor/patients');

  const response = await client.get('/api/doctor/patients');
  return unwrapSuccess<{ patients: DoctorPatient[] }>('/api/doctor/patients', response.data);
}

export async function fetchDoctorProfile(role: UiRole | null) {
  ensureAllowedRole(role, '/api/doctor/profile', ['DOCTOR']);
  ensureToken('/api/doctor/profile');

  const response = await client.get('/api/doctor/profile');
  return unwrapSuccess<DoctorProfilePayload>('/api/doctor/profile', response.data);
}

export async function updateDoctorProfile(
  role: UiRole | null,
  updates: {
    specialization?: string;
    experience?: string;
    hospital_affiliation?: string;
    education?: string;
    full_name?: string;
    phone_number?: string;
  }
) {
  ensureAllowedRole(role, '/api/doctor/profile', ['DOCTOR']);
  ensureToken('/api/doctor/profile');

  const response = await client.patch('/api/doctor/profile', updates);
  return unwrapSuccess<Record<string, unknown>>('/api/doctor/profile', response.data);
}

export async function fetchAppointments(role: UiRole | null, statusFilter?: string) {
  ensureRole(role, '/api/appointments');
  ensureToken('/api/appointments');

  const response = await client.get('/api/appointments', {
    params: statusFilter ? { status: statusFilter } : undefined,
  });
  return unwrapSuccess<{ appointments: AppointmentItem[] }>('/api/appointments', response.data);
}

export async function createAppointment(
  role: UiRole | null,
  input: { patient_id: string; date: string; time: string; type?: string; notes?: string }
) {
  ensureRole(role, '/api/appointments');
  ensureToken('/api/appointments');

  const response = await client.post('/api/appointments', input);
  return unwrapSuccess<AppointmentItem>('/api/appointments', response.data);
}

export async function updateAppointmentStatus(
  role: UiRole | null,
  appointmentId: string,
  newStatus: string
) {
  ensureAllowedRole(role, `/api/appointments/${appointmentId}`, ['DOCTOR']);
  ensureToken(`/api/appointments/${appointmentId}`);

  const response = await client.patch(`/api/appointments/${appointmentId}`, {
    appointment_id: appointmentId,
    status: newStatus,
  });
  return unwrapSuccess<AppointmentItem>(`/api/appointments/${appointmentId}`, response.data);
}

export async function fetchPrescriptions(role: UiRole | null, statusFilter?: string) {
  ensureRole(role, '/api/prescriptions');
  ensureToken('/api/prescriptions');

  const response = await client.get('/api/prescriptions', {
    params: statusFilter ? { status: statusFilter } : undefined,
  });
  return unwrapSuccess<{ prescriptions: PrescriptionItem[] }>('/api/prescriptions', response.data);
}

export async function createPrescription(
  role: UiRole | null,
  input: { patient_id: string; medication: string; dosage: string; duration: string; notes?: string }
) {
  ensureAllowedRole(role, '/api/prescriptions', ['DOCTOR']);
  ensureToken('/api/prescriptions');

  const response = await client.post('/api/prescriptions', input);
  return unwrapSuccess<PrescriptionItem>('/api/prescriptions', response.data);
}

export async function updatePrescriptionStatus(
  role: UiRole | null,
  prescriptionId: string,
  newStatus: string
) {
  ensureAllowedRole(role, `/api/prescriptions/${prescriptionId}`, ['DOCTOR']);
  ensureToken(`/api/prescriptions/${prescriptionId}`);

  const response = await client.patch(`/api/prescriptions/${prescriptionId}`, {
    prescription_id: prescriptionId,
    status: newStatus,
  });
  return unwrapSuccess<PrescriptionItem>(`/api/prescriptions/${prescriptionId}`, response.data);
}
