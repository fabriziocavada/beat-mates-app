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
      {/* Logo Box - Rounded square with infinity symbol */}
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
    width: 150,
    height: 130,
    backgroundColor: '#FF6978',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  infinitySymbol: {
    fontSize: 90,
    color: '#FFFFFF',
    fontWeight: '200',
    marginTop: -10,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  beatText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  matesText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FF6978',
    letterSpacing: 1,
  },
});
