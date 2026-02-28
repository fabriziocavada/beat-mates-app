import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, StatusBar, Image } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/authStore';
import Colors from '../src/constants/colors';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isLoading, isAuthenticated, hasSelectedCategories, loadUser } = useAuthStore();
  const [isReady, setIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  
  useEffect(() => {
    loadUser().finally(() => setIsReady(true));
    
    // Show splash for 2 seconds
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    
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
        <Image
          source={require('../assets/images/splash-logo.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator
          size="small"
          color={Colors.primary}
          style={styles.splashLoader}
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
    marginTop: 40,
  },
});
