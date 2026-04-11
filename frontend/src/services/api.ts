import axios from 'axios';
import { Platform } from 'react-native';

// Production backend URL - OVH Server (FAST!)
const baseURL = 'https://api.beatmates.app';

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

  console.log('[uploadFile] Starting upload for:', uri.substring(0, 60));

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
    const lowerUri = uri.toLowerCase();
    const isVideo = lowerUri.includes('.mp4') || lowerUri.includes('.mov') || lowerUri.includes('video');
    const isPng = lowerUri.includes('.png');
    const isGif = lowerUri.includes('.gif');
    
    let ext = 'jpg';
    let mimeType = 'image/jpeg';
    
    if (isVideo) {
      ext = 'mp4';
      mimeType = 'video/mp4';
    } else if (isPng) {
      ext = 'png';
      mimeType = 'image/png';
    } else if (isGif) {
      ext = 'gif';
      mimeType = 'image/gif';
    }
    
    console.log('[uploadFile] Native upload - ext:', ext, 'mimeType:', mimeType);
    
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
    console.error('[uploadFile] FAILED:', err);
    throw new Error(`Upload failed: ${err}`);
  }
  const data = await response.json();
  console.log('[uploadFile] SUCCESS - Server URL:', data.url);
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

// Get server-side video player URL (WebView loads this as a real page, same origin as video)
export function getVideoPlayerUrl(mediaUrlOrPath: string, options?: { controls?: boolean; muted?: boolean; autoplay?: boolean; fit?: 'cover' | 'contain' | 'auto'; loop?: boolean; poster?: string }): string {
  let filename = mediaUrlOrPath;
  // Extract filename from various path formats
  if (filename.includes('/api/media/')) {
    filename = filename.split('/api/media/').pop() || '';
  } else if (filename.includes('/api/uploads/')) {
    filename = filename.replace('/api/uploads/', '');
  } else if (filename.startsWith('http')) {
    // Full URL - extract filename from end
    const parts = filename.split('/');
    filename = parts[parts.length - 1] || '';
  }
  if (!filename) return mediaUrlOrPath;
  const ctrl = options?.controls ? '1' : '0';
  const mt = options?.muted !== false ? '1' : '0';
  const ap = options?.autoplay !== false ? '1' : '0';
  const fit = options?.fit || 'auto';
  const lp = options?.loop !== false ? '1' : '0';
  let url = `${baseURL}/api/video-player/${filename}?controls=${ctrl}&muted=${mt}&autoplay=${ap}&fit=${fit}&loop=${lp}`;
  if (options?.poster) url += `&poster=${encodeURIComponent(options.poster)}`;
  return url;
}

export default api;
