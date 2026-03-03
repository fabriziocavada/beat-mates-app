import axios from 'axios';
import { Platform } from 'react-native';

const baseURL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: `${baseURL}/api`,
  timeout: 180000,
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

// Upload a file to the server - works on both web and native
export async function uploadFile(uri: string): Promise<string> {
  const token = api.defaults.headers.common['Authorization'] as string;
  const formData = new FormData();

  if (Platform.OS === 'web') {
    // Web: fetch the URI (blob: or data:) and append as Blob
    const res = await fetch(uri);
    const blob = await res.blob();
    const mimeType = blob.type || 'application/octet-stream';
    const ext = mimeType.includes('video') ? 'mp4' 
      : mimeType.includes('png') ? 'png' 
      : mimeType.includes('gif') ? 'gif' 
      : 'jpg';
    formData.append('file', blob, `upload.${ext}`);
  } else {
    // Native (iOS/Android): use file URI directly with RN FormData
    const isVideo = uri.toLowerCase().includes('.mp4') || uri.toLowerCase().includes('.mov') || uri.toLowerCase().includes('video');
    const ext = isVideo ? 'mp4' : 'jpg';
    const mimeType = isVideo ? 'video/mp4' : 'image/jpeg';
    formData.append('file', {
      uri: uri,
      type: mimeType,
      name: `upload.${ext}`,
    } as any);
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
  return data.url;
}

// Resolve a media path to a full URL (uses streaming endpoint for all media)
export function getMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) return path;
  if (path.startsWith('/api/uploads/')) {
    const filename = path.replace('/api/uploads/', '');
    return `${baseURL}/api/media/${filename}`;
  }
  if (path.startsWith('/api/')) return `${baseURL}${path}`;
  // Plain filename - construct full media URL
  return `${baseURL}/api/media/${path}`;
}

// Check if a media path is a video
export function isVideoUrl(path: string | null | undefined): boolean {
  if (!path) return false;
  const lower = path.toLowerCase();
  return lower.includes('.mp4') || lower.includes('.mov') || lower.includes('.webm') || lower.includes('video');
}

// Get thumbnail URL for a video file
export function getThumbnailUrl(mediaPath: string | null | undefined): string | null {
  if (!mediaPath) return null;
  // Extract filename from path like /api/uploads/xxx.mp4
  let filename = mediaPath;
  if (filename.includes('/api/uploads/')) {
    filename = filename.replace('/api/uploads/', '');
  } else if (filename.startsWith('/')) {
    filename = filename.split('/').pop() || '';
  }
  if (!filename) return null;
  return `${baseURL}/api/thumbnail/${filename}`;
}

export default api;
