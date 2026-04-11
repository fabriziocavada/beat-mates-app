/**
 * OptimizedMedia.tsx
 * Instagram/TikTok style optimized media components with:
 * - Image caching (expo-image with memory + disk cache)
 * - Pre-loading for smoother scrolling
 * - Placeholder shimmer while loading
 * - Progressive loading for large images
 */

import React, { memo, useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { Image } from 'expo-image';

// Shimmer placeholder for loading state
const ShimmerPlaceholder = memo(({ width, height }: { width: number | string; height: number }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.shimmer,
        { width: typeof width === 'number' ? width : '100%', height, opacity },
      ]}
    />
  );
});

interface OptimizedImageProps {
  uri: string | null | undefined;
  width: number | string;
  height: number;
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  priority?: 'low' | 'normal' | 'high';
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * OptimizedImage - Uses expo-image for:
 * - Automatic memory + disk caching
 * - Blurhash placeholders
 * - Progressive loading
 * - Better performance than RN Image
 */
export const OptimizedImage = memo(({
  uri,
  width,
  height,
  style,
  resizeMode = 'cover',
  priority = 'normal',
  placeholder,
  onLoad,
  onError,
}: OptimizedImageProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (!uri || hasError) {
    return (
      <View style={[styles.placeholder, { width, height }, style]}>
        <ActivityIndicator size="small" color="#666" />
      </View>
    );
  }

  return (
    <View style={[{ width, height }, style]}>
      {isLoading && <ShimmerPlaceholder width={width} height={height} />}
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { opacity: isLoading ? 0 : 1 }]}
        contentFit={resizeMode}
        transition={200}
        cachePolicy="memory-disk"
        priority={priority}
        placeholder={placeholder}
        onLoad={() => {
          setIsLoading(false);
          onLoad?.();
        }}
        onError={() => {
          setHasError(true);
          onError?.();
        }}
      />
    </View>
  );
});

/**
 * Pre-load multiple images in advance (call before showing)
 * Use this to pre-fetch the next few images in a list
 */
export const preloadImages = async (urls: (string | null | undefined)[]): Promise<void> => {
  const validUrls = urls.filter((url): url is string => !!url);
  if (validUrls.length === 0) return;

  try {
    await Promise.all(
      validUrls.map(url => Image.prefetch(url))
    );
  } catch (e) {
    // Silently fail - pre-loading is best effort
    console.log('[preloadImages] Some images failed to preload');
  }
};

/**
 * Pre-load a single image
 */
export const preloadImage = async (url: string | null | undefined): Promise<boolean> => {
  if (!url) return false;
  try {
    await Image.prefetch(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Clear image cache (call periodically or on memory warning)
 */
export const clearImageCache = async (): Promise<void> => {
  try {
    await Image.clearDiskCache();
    await Image.clearMemoryCache();
  } catch (e) {
    console.log('[clearImageCache] Error:', e);
  }
};

const styles = StyleSheet.create({
  shimmer: {
    backgroundColor: '#2a2a2a',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  placeholder: {
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default OptimizedImage;
