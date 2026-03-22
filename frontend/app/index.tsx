import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, hasSelectedCategories, isLoading } = useAuthStore();
  
  useEffect(() => {
    if (isLoading) return;
    
    // Redirect immediately - the actual splash video is in _layout.tsx
    if (isAuthenticated) {
      if (hasSelectedCategories) {
        router.replace('/(main)/home');
      } else {
        router.replace('/(auth)/categories');
      }
    } else {
      router.replace('/(auth)/login');
    }
  }, [isLoading, isAuthenticated, hasSelectedCategories]);
  
  // Empty view - splash video is handled by _layout.tsx
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
