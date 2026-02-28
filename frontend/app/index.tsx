import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

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
      
      {/* Loading indicator */}
      <ActivityIndicator
        size="small"
        color="#FF6978"
        style={styles.loader}
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
    marginTop: 30,
  },
});
