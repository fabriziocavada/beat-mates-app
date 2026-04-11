import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

export interface CompressionProgress {
  progress: number;
  stage: 'compressing' | 'uploading';
}

// Dynamic import for react-native-compressor (only works in native builds, not Expo Go)
let VideoCompressor: any = null;
try {
  // This will fail in Expo Go but work in native builds
  VideoCompressor = require('react-native-compressor').Video;
} catch (e) {
  console.log('Video compression not available (Expo Go mode)');
}

/**
 * Compress image before upload (Instagram-style)
 * Target: Max 1200px, 70% quality, ~150KB output
 */
export async function compressImageForUpload(uri: string): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      return uri; // Web handles compression differently
    }

    console.log('[compressImage] Starting compression for:', uri.substring(0, 50));
    
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }], // Max 1200px width
      { 
        compress: 0.7, // 70% quality (Instagram uses ~70-80%)
        format: ImageManipulator.SaveFormat.JPEG 
      }
    );

    console.log('[compressImage] Compressed successfully:', result.uri.substring(0, 50));
    return result.uri;
  } catch (error) {
    console.warn('[compressImage] Compression failed, using original:', error);
    return uri;
  }
}

/**
 * Compress multiple images in parallel
 */
export async function compressImagesForUpload(uris: string[]): Promise<string[]> {
  return Promise.all(uris.map(uri => compressImageForUpload(uri)));
}

/**
 * Compress video before upload for faster uploads and server processing
 * Target: < 10MB for quick uploads, iOS-compatible format
 * Note: Compression only works in native builds, not Expo Go
 */
export async function compressVideoForUpload(
  uri: string,
  onProgress?: (progress: CompressionProgress) => void
): Promise<string> {
  try {
    // Skip compression on web or if compressor not available
    if (Platform.OS === 'web' || !VideoCompressor) {
      console.log('Video compression skipped (web or Expo Go mode)');
      return uri;
    }

    console.log('Starting video compression for:', uri);
    
    const compressedUri = await VideoCompressor.compress(
      uri,
      {
        compressionMethod: 'auto',
        maxSize: 720, // Max 720p resolution
        bitrate: 2000000, // 2 Mbps - good quality, small size
      },
      (progress: number) => {
        console.log('Compression progress:', Math.round(progress * 100) + '%');
        onProgress?.({
          progress: Math.round(progress * 100),
          stage: 'compressing'
        });
      }
    );

    console.log('Video compressed successfully:', compressedUri);
    return compressedUri;
  } catch (error) {
    console.warn('Video compression failed, using original:', error);
    // If compression fails, return original URI
    return uri;
  }
}

/**
 * Compress video with more aggressive settings for very large files
 */
export async function compressVideoAggressive(
  uri: string,
  onProgress?: (progress: CompressionProgress) => void
): Promise<string> {
  try {
    if (Platform.OS === 'web' || !VideoCompressor) {
      return uri;
    }

    console.log('Starting aggressive video compression for:', uri);
    
    const compressedUri = await VideoCompressor.compress(
      uri,
      {
        compressionMethod: 'manual',
        maxSize: 480, // Max 480p for very small files
        bitrate: 1000000, // 1 Mbps
      },
      (progress: number) => {
        onProgress?.({
          progress: Math.round(progress * 100),
          stage: 'compressing'
        });
      }
    );

    return compressedUri;
  } catch (error) {
    console.warn('Aggressive compression failed, trying auto:', error);
    return compressVideoForUpload(uri, onProgress);
  }
}
