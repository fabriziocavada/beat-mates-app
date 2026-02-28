import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
      {/* Logo Box */}
      <View style={styles.logoBox}>
        <Text style={styles.infinitySymbol}>∞</Text>
      </View>
      
      {/* App Name */}
      <View style={styles.nameContainer}>
        <Text style={styles.beatText}>BEAT </Text>
        <Text style={styles.matesText}>MATES</Text>
      </View>
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
  logoBox: {
    width: 140,
    height: 120,
    backgroundColor: '#FF6B7A',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  infinitySymbol: {
    fontSize: 80,
    color: '#FFFFFF',
    fontWeight: '300',
    marginTop: -8,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  beatText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  matesText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF6B7A',
    letterSpacing: 2,
  },
});
