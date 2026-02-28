import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '../src/constants/colors';
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
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated, hasSelectedCategories]);
  
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.iconBox}>
          <Text style={styles.infinitySymbol}>∞</Text>
        </View>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.logoWhite}>BEAT </Text>
        <Text style={styles.logoRed}>MATES</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 20,
  },
  iconBox: {
    width: 120,
    height: 100,
    backgroundColor: Colors.primary,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infinitySymbol: {
    fontSize: 70,
    color: Colors.text,
    fontWeight: '200',
    marginTop: -10,
  },
  textContainer: {
    flexDirection: 'row',
  },
  logoWhite: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
  },
  logoRed: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
  },
});
