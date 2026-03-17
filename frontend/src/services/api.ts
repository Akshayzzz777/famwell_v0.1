import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Add token to all requests (mock for now)
api.interceptors.request.use(async (config) => {
  // In Expo Go, token storage requires native build
  // For now, using localStorage mock
  try {
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('auth_token')
      : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    console.log('Token not available in Expo Go');
  }
  return config;
});

// Handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log('Unauthorized - token expired');
    }
    return Promise.reject(error);
  }
);

export default api;
