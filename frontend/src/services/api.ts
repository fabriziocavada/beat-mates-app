import axios from 'axios';

const baseURL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: `${baseURL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Upload a file (base64 data URI or blob URI) to the server
export async function uploadFile(uri: string): Promise<string> {
  const token = api.defaults.headers.common['Authorization'] as string;
  const formData = new FormData();

  if (uri.startsWith('data:')) {
    // base64 data URI → convert to blob
    const res = await fetch(uri);
    const blob = await res.blob();
    const ext = blob.type?.split('/')[1] || 'jpg';
    formData.append('file', blob, `upload.${ext}`);
  } else {
    // blob: or http: URI → fetch as blob
    const res = await fetch(uri);
    const blob = await res.blob();
    const ext = blob.type?.split('/')[1]?.replace('quicktime', 'mov') || 'mp4';
    formData.append('file', blob, `upload.${ext}`);
  }

  const response = await fetch(`${baseURL}/api/upload`, {
    method: 'POST',
    headers: { 'Authorization': token },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Upload failed: ${err}`);
  }
  const data = await response.json();
  return data.url; // e.g. "/api/uploads/uuid.jpg"
}

// Resolve a media path to a full URL
export function getMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) return path;
  if (path.startsWith('/api/')) return `${baseURL}${path}`;
  return path;
}

export default api;
