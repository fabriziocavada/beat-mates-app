import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useAuthStore } from '../src/store/authStore';

const LOADING_VIDEO_URL = 'https://customer-assets.emergentagent.com/job_4846b9df-52ad-4f93-b361-644907cb8b9c/artifacts/15uk85uk_loading.mp4';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, hasSelectedCategories, isLoading, loadUser } = useAuthStore();
  const [videoFinished, setVideoFinished] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  // Load user data
  useEffect(() => {
    loadUser().finally(() => setIsReady(true));
  }, []);
  
  // Handle video end
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded && status.didJustFinish && !videoFinished) {
      setVideoFinished(true);
    }
  };
  
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
