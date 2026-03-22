import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../src/store/authStore';

const LOADING_VIDEO_URL = 'https://customer-assets.emergentagent.com/job_4846b9df-52ad-4f93-b361-644907cb8b9c/artifacts/15uk85uk_loading.mp4';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

export default function SplashScreenComponent() {
  const router = useRouter();
  const { isAuthenticated, hasSelectedCategories, isLoading, loadUser } = useAuthStore();
  const [videoFinished, setVideoFinished] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [appIsReady, setAppIsReady] = useState(false);
  
  // Load user data and hide native splash
  useEffect(() => {
    async function prepare() {
      await loadUser();
      setIsReady(true);
      // Hide native splash screen
      await SplashScreen.hideAsync();
      setAppIsReady(true);
    }
    prepare();
  }, []);
  
  // Handle video end
  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded && status.didJustFinish && !videoFinished) {
      setVideoFinished(true);
    }
  }, [videoFinished]);
  
  // Navigate after video finishes AND data is ready
  useEffect(() => {
    if (!videoFinished || !isReady || isLoading) return;
    
    if (isAuthenticated) {
      if (hasSelectedCategories) {
        router.replace('/(main)/home');
      } else {
        router.replace('/(auth)/categories');
      }
    } else {
      router.replace('/(auth)/login');
    }
  }, [videoFinished, isReady, isLoading, isAuthenticated, hasSelectedCategories]);
  
  // Don't show anything until app is ready (native splash is hidden)
  if (!appIsReady) {
    return null;
  }
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Video
        source={{ uri: LOADING_VIDEO_URL }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping={false}
        isMuted
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
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
