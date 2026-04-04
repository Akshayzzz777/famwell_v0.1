import axios, { AxiosError } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type UiRole = 'DOCTOR' | 'PATIENT';
type BackendRole = 'DOCTOR' | 'USER';

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
  status: 'pending' | 'accepted' | 'rejected';
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

export type PendingRequestsPayload = {
  requests: ConnectionItem[];
};

export type InsightsPayload = {
  status: string;
  message: string;
};

export type ChatMessage = {
  message_id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type ChatResponse = {
  conversation_id: string;
  message: ChatMessage;
};

export type ConversationItem = {
  conversation_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message?: string | null;
  message_count?: number;
};

export type ConversationsPayload = {
  conversations: ConversationItem[];
};

export type ChatHistoryPayload = {
  conversation_id: string;
  messages: ChatMessage[];
};

export type MedicalRecordItem = {
  medical_record_id: string;
  user_id: string;
  file_url: string;
  file_name: string;
  record_type: string;
  upload_date: string;
};

export type MedicalRecordsPayload = {
  records: MedicalRecordItem[];
};

export type MetricDetail = {
  value: string | number;
  unit?: string;
  normal_range?: string;
  status?: 'normal' | 'borderline' | 'abnormal' | 'slightly elevated' | string;
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

export type ApiErrorKind =
  | 'unauthorized'
  | 'timeout'
  | 'network'
  | 'server'
  | 'empty'
  | 'unknown';

export type ApiFailure = {
  body?: unknown;
  endpoint: string;
  kind: ApiErrorKind;
  message: string;
  retryable: boolean;
  status?: number;
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

const PRODUCTION_API_URL = 'https://famwell-v0-1.onrender.com';
const PROJECT_DEFAULT_API_URLS = [PRODUCTION_API_URL, 'http://10.15.54.74:8000'];

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
  if (!hostSource) return null;
  return hostSource.split(':')[0] || null;
}

function resolveApiBaseUrls() {
  const configuredUrls = parseConfiguredApiUrls(process.env.EXPO_PUBLIC_API_URLS);
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  const candidates: string[] = [];

  // Production URL always first — guaranteed reachable from any device
  candidates.push(PRODUCTION_API_URL);

  candidates.push(...configuredUrls);

  if (configured) {
    candidates.push(normalizeBaseUrl(configured));
  }

  // Read URLs from app.json expo.extra
  candidates.push(...getExpoConfiguredApiUrls());
  const expoConfigured = getExpoConfiguredApiUrl();
  if (expoConfigured) {
    candidates.push(expoConfigured);
  }

  candidates.push(...PROJECT_DEFAULT_API_URLS.map(normalizeBaseUrl));

  // Expo dev server host → backend on same machine (dev only)
  const expoHost = getExpoHost();
  if (expoHost && expoHost !== 'localhost' && expoHost !== '127.0.0.1') {
    candidates.push(`http://${expoHost}:8000`);
  }

  if (Platform.OS === 'web') {
    candidates.push('http://127.0.0.1:8000');
  }

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
const ACCESS_TOKEN_KEY = 'auth_token';
const SELECTED_ROLE_KEY = 'selected_role';
const SESSION_USER_KEY = 'session_user';

const memoryStorage = new Map<string, string>();

let unauthorizedHandler: ((failure: ApiFailure) => void) | null = null;

function readStorage(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch (error) {
    console.log('[RESPONSE]', { status: null, data: { message: 'Storage read fallback', key, error } });
  }

  return memoryStorage.get(key) ?? null;
}

function writeStorage(key: string, value: string) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch (error) {
    console.log('[RESPONSE]', { status: null, data: { message: 'Storage write fallback', key, error } });
  }

  memoryStorage.set(key, value);
}

function removeStorage(key: string) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return;
    }
  } catch (error) {
    console.log('[RESPONSE]', { status: null, data: { message: 'Storage remove fallback', key, error } });
  }

  memoryStorage.delete(key);
}

function parseUser(raw: string | null): SessionUser | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function loadPersistedAccess(): PersistedAccess {
  const storedRole = readStorage(SELECTED_ROLE_KEY);
  const storedToken = readStorage(ACCESS_TOKEN_KEY);
  const storedUser = parseUser(readStorage(SESSION_USER_KEY));

  return {
    role: storedRole === 'DOCTOR' || storedRole === 'PATIENT' ? storedRole : null,
    token: storedToken,
    user: storedUser,
  };
}

export function persistSelectedRole(role: UiRole) {
  writeStorage(SELECTED_ROLE_KEY, role);
}

export function persistAccessToken(token: string) {
  writeStorage(ACCESS_TOKEN_KEY, token);
}

export function persistSessionUser(user: SessionUser) {
  writeStorage(SESSION_USER_KEY, JSON.stringify(user));
}

export function clearPersistedRole() {
  removeStorage(SELECTED_ROLE_KEY);
}

export function clearPersistedAccess() {
  removeStorage(SELECTED_ROLE_KEY);
  removeStorage(ACCESS_TOKEN_KEY);
  removeStorage(SESSION_USER_KEY);
}

export function setUnauthorizedHandler(handler: ((failure: ApiFailure) => void) | null) {
  unauthorizedHandler = handler;
}

export function mapUiRoleToBackendRole(role: UiRole): BackendRole {
  return role === 'PATIENT' ? 'USER' : 'DOCTOR';
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

function isWrappedResponse<T>(payload: unknown): payload is SuccessEnvelope<T> {
  return Boolean(payload && typeof payload === 'object' && 'success' in (payload as Record<string, unknown>));
}

function unwrapSuccess<T>(endpoint: string, payload: unknown): T {
  if (isWrappedResponse<T>(payload)) {
    if (!payload.success) {
      throw createFailure(endpoint, 'unknown', payload.message || 'Request failed.', {
        body: payload,
        retryable: false,
      });
    }

    return (payload.data ?? null) as T;
  }

  return (payload ?? null) as T;
}

function ensureRole(role: UiRole | null, endpoint: string) {
  if (!role) {
    throw createFailure(endpoint, 'unauthorized', 'Select a role to continue.', {
      retryable: false,
    });
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
  const { token } = loadPersistedAccess();

  if (!token) {
    throw createFailure(endpoint, 'unauthorized', 'No stored bearer token was found.', {
      retryable: false,
    });
  }

  return token;
}

function normalizeError(endpoint: string, error: unknown): ApiFailure {
  const axiosError = error as AxiosError;
  const attemptedBaseUrl = axiosError.config?.baseURL || API_BASE_URL;
  const status = axiosError.response?.status;
  const body = axiosError.response?.data as SuccessEnvelope<unknown> | undefined;
  const message = body?.message || axiosError.message || 'Unexpected API error.';

  if (status === 401 || status === 403) {
    return createFailure(endpoint, 'unauthorized', message, {
      body,
      retryable: false,
      status,
    });
  }

  if (axiosError.code === 'ECONNABORTED') {
    return createFailure(endpoint, 'timeout', message || 'The request timed out.', {
      body,
      retryable: true,
      status,
    });
  }

  if (status && status >= 500) {
    return createFailure(endpoint, 'server', message || 'The server returned an error.', {
      body,
      retryable: true,
      status,
    });
  }

  if (axiosError.request && !axiosError.response) {
    return createFailure(
      endpoint,
      'network',
      `The network request failed. Attempted API base URL: ${attemptedBaseUrl}. Available API base URLs: ${API_BASE_URLS.join(', ')}`,
      {
      retryable: true,
      status,
      }
    );
  }

  return createFailure(endpoint, 'unknown', message, {
    body,
    retryable: false,
    status,
  });
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

function isAuthRoute(url: string) {
  return url.includes('/api/auth/login') || url.includes('/api/auth/register');
}

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const requestConfig = config as typeof config & ApiClientRequestConfig;
  const { token } = loadPersistedAccess();
  const baseUrlIndex = requestConfig._apiCandidateIndex ?? 0;

  requestConfig._apiCandidateIndex = baseUrlIndex;
  config.baseURL = API_BASE_URLS[baseUrlIndex] ?? API_BASE_URL;

  const url = `${config.baseURL ?? ''}${config.url ?? ''}`;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  console.log('[REQUEST]', {
    url,
    method: (config.method ?? 'get').toUpperCase(),
    payload: config.data ?? config.params ?? null,
  });

  return config;
});

client.interceptors.response.use(
  (response) => {
    console.log('[RESPONSE]', {
      status: response.status,
      data: response.data ?? null,
    });

    return response;
  },
  async (error) => {
    console.log('[RESPONSE]', {
      status: error.response?.status ?? null,
      data: error.response?.data ?? null,
    });

    const endpoint = error.config?.url ?? 'unknown';
    const requestConfig = error.config as (typeof error.config & ApiClientRequestConfig) | undefined;
    const failure = normalizeError(endpoint, error);

    if (failure.kind === 'network' && requestConfig) {
      const currentIndex = requestConfig._apiCandidateIndex ?? 0;
      const nextIndex = currentIndex + 1;
      const isWebFileUpload = Platform.OS === 'web' && requestConfig.data instanceof FormData;

      if (!isWebFileUpload && nextIndex < API_BASE_URLS.length) {
        requestConfig._apiCandidateIndex = nextIndex;
        requestConfig.baseURL = API_BASE_URLS[nextIndex];
        return client.request(requestConfig);
      }
    }

    if (failure.kind === 'unauthorized' && !isAuthRoute(endpoint)) {
      clearPersistedAccess();
      unauthorizedHandler?.(failure);
    }

    return Promise.reject(failure);
  }
);

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
  role?: UiRole;
}) {
  const response = await client.post('/api/auth/register', {
    full_name: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    phone_number: input.phoneNumber.trim(),
    password: input.password,
    selected_role: input.role ?? 'PATIENT',
  });
  const data = unwrapSuccess<any>('/api/auth/register', response.data);

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

export async function uploadPdf(role: UiRole | null, file: { name: string; type: string; uri: string }) {
  ensureRole(role, '/api/medical-records/upload');
  ensureToken('/api/medical-records/upload');

  const formData = new FormData();
  formData.append('file', {
    name: file.name,
    type: file.type,
    uri: file.uri,
  } as never);
  formData.append('record_type', 'general');

  const response = await client.post('/api/medical-records/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  const payload = response.data?.data ?? response.data;
  return payload || null;
}

export async function fetchJobStatus(role: UiRole | null, jobId: string) {
  ensureRole(role, `/api/status/${jobId}`);
  ensureToken(`/api/status/${jobId}`);

  const response = await client.get(`/api/status/${jobId}`);
  return response.data || null;
}

export async function fetchJobResult(role: UiRole | null, jobId: string) {
  ensureRole(role, `/api/result/${jobId}`);
  ensureToken(`/api/result/${jobId}`);

  const response = await client.get(`/api/result/${jobId}`);
  return response.data || null;
}

// ── Follow / Connection endpoints ──

export async function sendFollowRequest(role: UiRole | null, healthId: string) {
  ensureRole(role, '/api/follow');
  ensureToken('/api/follow');

  const response = await client.post('/api/follow', {
    health_id: healthId.trim().toUpperCase(),
  });

  return unwrapSuccess<ConnectionItem>('/api/follow', response.data);
}

export async function respondToFollowRequest(
  role: UiRole | null,
  connectionId: string,
  action: 'accepted' | 'rejected'
) {
  ensureRole(role, '/api/follow-action');
  ensureToken('/api/follow-action');

  const response = await client.post('/api/follow-action', {
    connection_id: connectionId,
    action,
  });

  return unwrapSuccess<ConnectionItem>('/api/follow-action', response.data);
}

export async function fetchPendingRequests(role: UiRole | null) {
  ensureRole(role, '/api/connections/pending');
  ensureToken('/api/connections/pending');

  const response = await client.get('/api/connections/pending');
  return unwrapSuccess<PendingRequestsPayload>('/api/connections/pending', response.data);
}

// ── Chat endpoints ──

export async function sendChatMessage(
  role: UiRole | null,
  message: string,
  conversationId?: string
) {
  ensureRole(role, '/api/chat');
  ensureToken('/api/chat');

  const response = await client.post('/api/chat', {
    message,
    conversation_id: conversationId,
  });

  return unwrapSuccess<ChatResponse>('/api/chat', response.data);
}

export async function fetchConversations(role: UiRole | null) {
  ensureRole(role, '/api/chat/conversations');
  ensureToken('/api/chat/conversations');

  const response = await client.get('/api/chat/conversations');
  return unwrapSuccess<ConversationsPayload>('/api/chat/conversations', response.data);
}

export async function fetchChatHistory(role: UiRole | null, conversationId: string) {
  ensureRole(role, `/api/chat/history/${conversationId}`);
  ensureToken(`/api/chat/history/${conversationId}`);

  const response = await client.get(`/api/chat/history/${conversationId}`);
  return unwrapSuccess<ChatHistoryPayload>(`/api/chat/history/${conversationId}`, response.data);
}

// ── Medical Record endpoints ──

export async function uploadMedicalRecord(
  role: UiRole | null,
  file: { name: string; type: string; uri: string },
  recordType: string = 'general'
) {
  ensureRole(role, '/api/medical-records/upload');
  ensureToken('/api/medical-records/upload');

  const formData = new FormData();
  formData.append('file', {
    name: file.name,
    type: file.type,
    uri: file.uri,
  } as never);
  formData.append('record_type', recordType);

  const response = await client.post('/api/medical-records/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return unwrapSuccess<MedicalRecordItem>('/api/medical-records/upload', response.data);
}

export async function fetchMedicalRecords(role: UiRole | null) {
  ensureRole(role, '/api/medical-records');
  ensureToken('/api/medical-records');

  const response = await client.get('/api/medical-records');
  return unwrapSuccess<MedicalRecordsPayload>('/api/medical-records', response.data);
}

export async function analyzeMedicalRecord(role: UiRole | null, recordId: string) {
  ensureRole(role, `/api/medical-records/${recordId}/analyze`);
  ensureToken(`/api/medical-records/${recordId}/analyze`);

  const response = await client.post(`/api/medical-records/${recordId}/analyze`);
  return unwrapSuccess<HealthAnalysis>(`/api/medical-records/${recordId}/analyze`, response.data);
}

// ── Health Insights endpoints ──

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

