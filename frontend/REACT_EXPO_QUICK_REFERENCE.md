# React Expo Quick Reference

## ✅ Yes - Fully Compatible!

Your FastAPI backend is **100% React Expo friendly**. Here's the quick reference:

## 3 Key Reasons

1. **RESTful API** - Expo's `fetch()` and `axios` work perfectly
2. **CORS Enabled** - Already configured for cross-origin mobile requests
3. **No Dependencies** - Backend doesn't require any mobile framework

## API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/health` | Health check |
| `POST` | `/api/upload` | Upload PDF file |
| `GET` | `/api/status/{job_id}` | Check processing status |
| `GET` | `/api/result/{job_id}` | Get final results |

## Authentication

```typescript
// All requests except /health require:
headers: {
  Authorization: `Bearer ${jwtToken}`
}
```

## Quick Integration (3 Steps)

### 1. Create API Service

```typescript
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const api = axios.create({
  baseURL: 'http://10.0.0.1:8000', // Use this for Android emulator
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

### 2. Upload PDF

```typescript
import * as DocumentPicker from 'expo-document-picker';

const uploadFile = async () => {
  const doc = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
  
  const formData = new FormData();
  formData.append('file', {
    uri: doc.assets[0].uri,
    name: doc.assets[0].name,
    type: 'application/pdf',
  });

  const response = await api.post('/api/upload', formData);
  return response.data; // { file_id, job_id, ... }
};
```

### 3. Poll Status

```typescript
const checkStatus = async (jobId) => {
  const response = await api.get(`/api/status/${jobId}`);
  return response.data; // { status, progress, ... }
};

// Poll every 3 seconds
useEffect(() => {
  const interval = setInterval(() => {
    checkStatus(jobId);
  }, 3000);
  return () => clearInterval(interval);
}, [jobId]);
```

## Mobile-Friendly Configuration

```typescript
// .env.local
EXPO_PUBLIC_API_URL=http://10.0.0.1:8000  // Android emulator
// EXPO_PUBLIC_API_URL=http://localhost:8000  // iOS simulator
// EXPO_PUBLIC_API_URL=https://api.yourserver.com  // Production
```

## Required Dependencies

```bash
npm install axios expo-secure-store expo-document-picker
```

## Backend Requirements (Already Met!)

- ✅ REST API
- ✅ CORS enabled
- ✅ JWT authentication
- ✅ Multipart file upload
- ✅ JSON responses
- ✅ Error handling

## Network URLs by Platform

| Platform | URL | Note |
|----------|-----|------|
| iOS Simulator | `http://localhost:8000` | Direct localhost |
| Android Emulator | `http://10.0.0.1:8000` | Gateway IP |
| Physical Device | `http://192.168.x.x:8000` | Your machine IP |
| Production | `https://api.yourdomain.com` | HTTPS required |

## Example Response Format

```json
{
  "job_id": "j_abc123",
  "file_id": "f_xyz789",
  "status": "COMPLETED",
  "progress": 100,
  "extracted_data": {
    "document_type": "invoice",
    "extracted_text": "...",
    "tables": [],
    "metadata": {}
  },
  "llm_result": {
    "response": "...",
    "structured_output": {...},
    "processing_time_seconds": 2.5
  }
}
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED` | Use `10.0.0.1` for Android emulator, not `localhost` |
| `CORS error` | Update `CORS_ORIGINS` in `.env` to include your app domain |
| `401 Unauthorized` | Store and send JWT token in `Authorization` header |
| `File upload fails` | Use `multipart/form-data` Content-Type |
| `Timeout errors` | Increase timeout: `api.defaults.timeout = 30000` |

## Security Best Practices

```typescript
// ✅ DO: Store token securely
await SecureStore.setItemAsync('auth_token', token);

// ❌ DON'T: Store in AsyncStorage (not secure)
AsyncStorage.setItem('auth_token', token);

// ✅ DO: Use HTTPS in production
// ❌ DON'T: Use HTTP in production
```

## Performance Tips

```typescript
// Cancel requests on unmount
useEffect(() => {
  const source = axios.CancelToken.source();
  api.get('/api/status/123', { cancelToken: source.token });
  return () => source.cancel();
}, []);

// Set reasonable timeout
const api = axios.create({ timeout: 10000 });

// Handle network state
import NetInfo from '@react-native-community/netinfo';
NetInfo.addEventListener(state => {
  if (!state.isConnected) {
    // Show offline message
  }
});
```

## Full Example Screen

```typescript
import React, { useState } from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import api from '../services/api';

export default function DocumentScreen() {
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    try {
      setLoading(true);
      const doc = await DocumentPicker.getDocumentAsync({ 
        type: 'application/pdf' 
      });

      const formData = new FormData();
      formData.append('file', {
        uri: doc.assets[0].uri,
        name: doc.assets[0].name,
        type: 'application/pdf',
      });

      const response = await api.post('/api/upload', formData);
      setJobId(response.data.job_id);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Poll status every 3 seconds
  React.useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/api/status/${jobId}`);
        setStatus(response.data);
      } catch (error) {
        console.error('Status check failed:', error);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobId]);

  return (
    <View style={{ padding: 20 }}>
      <Button
        title={loading ? 'Uploading...' : 'Upload PDF'}
        onPress={handleUpload}
        disabled={loading}
      />

      {status && (
        <View style={{ marginTop: 20 }}>
          <Text>Status: {status.status}</Text>
          <Text>Progress: {status.progress}%</Text>
          {status.status === 'COMPLETED' && (
            <Text>Document Type: {status.extracted_data?.data?.document_type}</Text>
          )}
        </View>
      )}

      {loading && <ActivityIndicator />}
    </View>
  );
}
```

## Environment Setup

```bash
# Create Expo app
npx create-expo-app document-processor-mobile

# Install dependencies
cd document-processor-mobile
npm install axios expo-secure-store expo-document-picker @react-native-community/netinfo

# Create .env.local
echo 'EXPO_PUBLIC_API_URL=http://10.0.0.1:8000' > .env.local

# Start
npm start
```

## Deployment

### Local Testing
```bash
# Terminal 1: Backend
python -m uvicorn api.main:app --reload

# Terminal 2: Expo
npm start
# Press 'a' for Android or 'i' for iOS
```

### Production Deployment
1. Update `CORS_ORIGINS` in backend `.env`
2. Set `ENABLE_HTTPS=true`
3. Use EAS Build: `eas build --platform all`
4. Deploy to Expo servers

## API Comparison

| Scenario | Code |
|----------|------|
| **Fetch** | `const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })` |
| **Axios** | `const res = await api.get(url)` (with interceptors) |
| **React Query** | `const { data } = useQuery('jobs', () => api.get('/api/jobs'))` |
| **SWR** | `const { data } = useSWR('/api/jobs', api.get)` |

## Useful Libraries

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "expo": "^50.0.0",
    "react-native": "^0.73.0",
    "expo-secure-store": "^12.0.0",
    "expo-document-picker": "^11.0.0",
    "@react-native-community/netinfo": "^11.0.0",
    "react-query": "^3.39.0"
  }
}
```

---

## Summary

✅ **Backend**: Ready for Expo  
✅ **Authentication**: JWT with SecureStore  
✅ **File Upload**: Multipart FormData  
✅ **Real-time Status**: Polling implementation included  
✅ **Error Handling**: Robust error responses  
✅ **Security**: HTTPS, CORS, Rate limiting built-in  

**Start building your React Expo app today!** 🚀

For detailed integration guide, see: `REACT_EXPO_INTEGRATION.md`
