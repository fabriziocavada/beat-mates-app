import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Vibration,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function LessonNotificationBanner() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [pendingCount, setPendingCount] = useState(0);
  const [showBanner, setShowBanner] = useState(false);
  const [newRequest, setNewRequest] = useState(false);
  const slideAnim = useRef(new Animated.Value(100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lastCountRef = useRef(0);

  useEffect(() => {
    if (!user?.is_available) {
      setShowBanner(false);
      return;
    }

    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, [user?.is_available]);

  useEffect(() => {
    if (showBanner) {
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showBanner]);

  useEffect(() => {
    if (newRequest) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
        { iterations: 3 }
      );
      pulse.start(() => setNewRequest(false));
    }
  }, [newRequest]);

  const checkPending = async () => {
    try {
      const response = await api.get('/live-sessions/pending/count');
      const count = response.data.count || 0;

      if (count > lastCountRef.current && lastCountRef.current >= 0) {
        // New request arrived!
        triggerAlert();
      }

      lastCountRef.current = count;
      setPendingCount(count);
      setShowBanner(count > 0);
    } catch (error) {
      // Silently fail
    }
  };

  const triggerAlert = () => {
    setNewRequest(true);
    // Vibrate pattern: short-pause-long
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 200, 100, 400]);
    }
    // Play a beep sound via Web Audio API on web
    if (Platform.OS === 'web') {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start();
        setTimeout(() => { osc.stop(); ctx.close(); }, 300);
      } catch (e) { /* audio not available */ }
    }
  };

  if (!showBanner || !user?.is_available) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          transform: [
            { translateY: slideAnim },
            { scale: pulseAnim },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.bannerContent}
        onPress={() => router.push('/(main)/lesson-requests')}
        activeOpacity={0.8}
        data-testid="lesson-notification-banner"
      >
        <View style={styles.iconContainer}>
          <Ionicons name="videocam" size={22} color="#FFF" />
          {newRequest && <View style={styles.pulsingDot} />}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {pendingCount === 1 ? 'Nuova richiesta di lezione!' : `${pendingCount} richieste di lezione!`}
          </Text>
          <Text style={styles.subtitle}>Tocca per vedere</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#FFF" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 80,
    left: 12,
    right: 12,
    zIndex: 999,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6978',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#FF6978',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pulsingDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFEB3B',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
});
