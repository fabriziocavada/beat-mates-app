import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar, Image } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { useAuthStore } from '../src/store/authStore';
import Colors from '../src/constants/colors';

const LOADING_VIDEO_URL = 'https://customer-assets.emergentagent.com/job_4846b9df-52ad-4f93-b361-644907cb8b9c/artifacts/15uk85uk_loading.mp4';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isLoading, isAuthenticated, hasSelectedCategories, loadUser } = useAuthStore();
  const [isReady, setIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  
  useEffect(() => {
    loadUser().finally(() => setIsReady(true));
    
    // Show splash for 3 seconds
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    
    return () => clearTimeout(splashTimer);
  }, []);
  
  useEffect(() => {
    if (!isReady || showSplash) return;
    
    const inAuthGroup = segments[0] === '(auth)';
    const inMainGroup = segments[0] === '(main)';
    
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && !hasSelectedCategories && segments.join('/') !== '(auth)/categories') {
      router.replace('/(auth)/categories');
    } else if (isAuthenticated && hasSelectedCategories && inAuthGroup) {
      router.replace('/(main)/home');
    }
  }, [isAuthenticated, hasSelectedCategories, segments, isReady, showSplash]);
  
  // Show splash screen
  if (showSplash || !isReady || isLoading) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
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
  
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'fade',
        }}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 280,
    height: 280,
  },
  splashLoader: {
    width: 80,
    height: 80,
    marginTop: 40,
  },
});
