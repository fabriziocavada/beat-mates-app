import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { useAuthStore } from '../src/store/authStore';

const LOADING_VIDEO_URL = 'https://customer-assets.emergentagent.com/job_4846b9df-52ad-4f93-b361-644907cb8b9c/artifacts/15uk85uk_loading.mp4';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, hasSelectedCategories, isLoading } = useAuthStore();
  
  useEffect(() => {
    if (isLoading) return;
    
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        if (hasSelectedCategories) {
          router.replace('/(main)/home');
        } else {
          router.replace('/(auth)/categories');
        }
      } else {
        router.replace('/(auth)/login');
      }
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated, hasSelectedCategories]);
  
  return (
    <View style={styles.container}>
      <Video
        source={{ uri: LOADING_VIDEO_URL }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
