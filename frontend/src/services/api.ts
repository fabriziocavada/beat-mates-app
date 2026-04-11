import axios from 'axios';
import { Platform } from 'react-native';

// Production backend URL - OVH Server (FAST!)
const baseURL = 'https://api.beatmates.app';

// Bunny CDN URLs for global delivery
const BUNNY_CDN_URL = 'https://beatmates-cd.b-cdn.net';
const BUNNY_STREAM_EMBED = 'https://iframe.mediadelivery.net/embed/635479';

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

// Upload response type from backend
interface UploadResponse {
  url: string;
  filename: string;
  media_type: 'video' | 'image';
  thumbnail: string | null;
  cdn_type?: 'bunny_stream' | 'bunny_storage' | 'local';
  bunny_guid?: string;
  bunny_status?: string;
}

// Upload a file to the server - works on both web and native
// Now uploads to Bunny CDN for global delivery!
export async function uploadFile(uri: string): Promise<UploadResponse> {
  const token = api.defaults.headers.common['Authorization'] as string;
  const formData = new FormData();

  console.log('[uploadFile] Starting Bunny CDN upload for:', uri.substring(0, 60));

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
  const data: UploadResponse = await response.json();
  console.log('[uploadFile] SUCCESS - CDN URL:', data.url, 'Type:', data.cdn_type);
  return data;
}

// Legacy wrapper for backward compatibility (returns just URL string)
export async function uploadFileUrl(uri: string): Promise<string> {
  const result = await uploadFile(uri);
  return result.url;
}

// Check if a URL is from Bunny CDN
export function isBunnyCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('b-cdn.net') || url.includes('mediadelivery.net') || url.includes('bunnycdn.com');
}

// Check if a URL is a Bunny Stream embed
export function isBunnyStreamEmbed(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('iframe.mediadelivery.net/embed');
}

// Resolve a media path to a full URL
// Handles: local paths, Bunny CDN URLs, Bunny Stream embeds
export function getMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  
  // Already a full URL (including Bunny CDN)
  if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  
  // Local server paths
  if (path.startsWith('/api/uploads/')) {
    const filename = path.replace('/api/uploads/', '');
    return `${baseURL}/api/media/${filename}`;
  }
  if (path.startsWith('/api/')) {
    return `${baseURL}${path}`;
  }
  
  // Plain filename - construct full media URL
  return `${baseURL}/api/media/${path}`;
}

// Check if a media path is a video
export function isVideoUrl(path: string | null | undefined): boolean {
  if (!path) return false;
  const lower = path.toLowerCase();
  // Check for video file extensions or Bunny Stream embed URLs
  return lower.includes('.mp4') || 
         lower.includes('.mov') || 
         lower.includes('.webm') || 
         lower.includes('video') ||
         lower.includes('mediadelivery.net/embed');
}

// Get thumbnail URL for a video file
export function getThumbnailUrl(mediaPath: string | null | undefined): string | null {
  if (!mediaPath) return null;
  
  // Bunny Stream videos have auto-generated thumbnails
  // But they require signed URLs, so we skip for now
  
  // Local server thumbnails
  let filename = mediaPath;
  if (filename.includes('/api/uploads/')) {
    filename = filename.replace('/api/uploads/', '');
  } else if (filename.startsWith('/')) {
    filename = filename.split('/').pop() || '';
  }
  if (!filename) return null;
  return `${baseURL}/api/thumbnail/${filename}`;
}

// Get video player URL
// For Bunny Stream videos: returns the embed iframe URL
// For local videos: returns the server-side player URL
export function getVideoPlayerUrl(mediaUrlOrPath: string, options?: { controls?: boolean; muted?: boolean; autoplay?: boolean; fit?: 'cover' | 'contain' | 'auto'; loop?: boolean; poster?: string }): string {
  // If it's already a Bunny Stream embed URL, add query params
  if (isBunnyStreamEmbed(mediaUrlOrPath)) {
    const params = new URLSearchParams();
    if (options?.autoplay !== false) params.append('autoplay', 'true');
    if (options?.muted !== false) params.append('muted', 'true');
    if (options?.loop !== false) params.append('loop', 'true');
    const queryStr = params.toString();
    return queryStr ? `${mediaUrlOrPath}?${queryStr}` : mediaUrlOrPath;
  }
  
  // Local video - use server-side player
  let filename = mediaUrlOrPath;
  if (filename.includes('/api/media/')) {
    filename = filename.split('/api/media/').pop() || '';
  } else if (filename.includes('/api/uploads/')) {
    filename = filename.replace('/api/uploads/', '');
  } else if (filename.startsWith('http')) {
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
