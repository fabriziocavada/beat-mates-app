import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
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
      {/* Logo from Figma design */}
      <Image
        source={require('../assets/images/splash-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      
      {/* Loading video */}
      <Video
        source={{ uri: LOADING_VIDEO_URL }}
        style={styles.loader}
        resizeMode={ResizeMode.CONTAIN}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 280,
    height: 280,
    marginBottom: 20,
  },
  loader: {
    width: 80,
    height: 80,
    marginTop: 30,
  },
});
