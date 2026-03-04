import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Vibration,
  Platform,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api, { getMediaUrl } from '../services/api';
import { useAuthStore } from '../store/authStore';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function generateBeepWav(): string {
  const sampleRate = 22050;
  const duration = 1.2;
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2;
  const fileSize = 44 + dataSize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); view.setUint32(4, fileSize - 8, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); ws(36, 'data'); view.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let amp = 0;
    if ((t >= 0 && t < 0.25) || (t >= 0.4 && t < 0.65) || (t >= 0.8 && t < 1.05)) {
      amp = Math.sin(2 * Math.PI * 880 * t) * 0.4;
    }
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, amp)) * 32767, true);
  }
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = typeof btoa !== 'undefined' ? btoa(bin) : (() => {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let r = '', j = 0;
    while (j < bin.length) {
      const a = bin.charCodeAt(j++), b = j < bin.length ? bin.charCodeAt(j++) : 0, cc = j < bin.length ? bin.charCodeAt(j++) : 0;
      const t = (a << 16) | (b << 8) | cc;
      r += c[(t >> 18) & 63] + c[(t >> 12) & 63] + (j > bin.length + 1 ? '=' : c[(t >> 6) & 63]) + (j > bin.length ? '=' : c[t & 63]);
    }
    return r;
  })();
  return `data:audio/wav;base64,${b64}`;
}

export default function LessonNotificationBanner() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const lastCountRef = useRef(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const vibrationInterval = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!user?.is_available) {
      setShowModal(false);
      stopAlerts();
      return;
    }
    checkPending();
    const interval = setInterval(checkPending, 3000);
    return () => { clearInterval(interval); stopAlerts(); };
  }, [user?.is_available]);

  // Pulse + ring animation when modal is showing
  useEffect(() => {
    if (showModal) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      const ring = Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(ringAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      );
      pulse.start();
      ring.start();
      return () => { pulse.stop(); ring.stop(); };
    }
  }, [showModal]);

  const stopAlerts = () => {
    if (vibrationInterval.current) {
      clearInterval(vibrationInterval.current);
      vibrationInterval.current = null;
    }
    Vibration.cancel();
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
  };

  const startAlerts = () => {
    // Continuous vibration
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 500, 300, 500, 300, 500], true);
    }
    // Play ringtone sound
    playRingtone();
  };

  const playRingtone = async () => {
    if (Platform.OS === 'web') {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const playTone = (st: number, f: number, d: number) => {
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = f; osc.type = 'sine';
          gain.gain.setValueAtTime(0.3, st);
          gain.gain.exponentialRampToValueAtTime(0.01, st + d);
          osc.start(st); osc.stop(st + d);
        };
        for (let i = 0; i < 5; i++) {
          playTone(ctx.currentTime + i * 1.5, 880, 0.3);
          playTone(ctx.currentTime + i * 1.5 + 0.4, 880, 0.3);
        }
        setTimeout(() => ctx.close(), 8000);
      } catch {}
    } else {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
        const wav = generateBeepWav();
        const { sound } = await Audio.Sound.createAsync({ uri: wav }, { shouldPlay: true, volume: 1.0, isLooping: true });
        soundRef.current = sound;
      } catch (e) { console.log('Audio err:', e); }
    }
  };

  const checkPending = async () => {
    try {
      const response = await api.get('/live-sessions/pending/count');
      const count = response.data.count || 0;

      if (count > 0 && count > lastCountRef.current) {
        // Load request details
        try {
          const reqRes = await api.get('/live-sessions/pending');
          if (reqRes.data && reqRes.data.length > 0) {
            const req = reqRes.data[0];
            setPendingRequest(req);
            setShowModal(true);
            startAlerts();
          }
        } catch {}
      } else if (count === 0 && showModal) {
        setShowModal(false);
        stopAlerts();
      }

      lastCountRef.current = count;
    } catch {}
  };

  const handleAccept = async () => {
    stopAlerts();
    setShowModal(false);
    setPendingRequest(null);
    lastCountRef.current = 0;
    
    if (pendingRequest?.id) {
      try {
        // Actually accept the session via API
        const res = await api.post(`/live-sessions/${pendingRequest.id}/accept`);
        // Navigate directly to video call
        router.push(`/(main)/video-call/${pendingRequest.id}`);
      } catch (e) {
        // If accept fails, navigate to lesson-requests as fallback
        router.push('/(main)/lesson-requests');
      }
    }
  };

  const handleReject = async () => {
    stopAlerts();
    setShowModal(false);
    setPendingRequest(null);
    lastCountRef.current = 0;
    
    if (pendingRequest?.id) {
      try {
        await api.post(`/live-sessions/${pendingRequest.id}/reject`);
      } catch {}
    }
  };

  if (!user?.is_available) return null;

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Phone icon ringing */}
          <Animated.View style={[styles.phoneIconContainer, {
            transform: [
              { scale: pulseAnim },
              { rotate: ringAnim.interpolate({ inputRange: [0, 1], outputRange: ['-10deg', '10deg'] }) },
            ]
          }]}>
            <View style={styles.phoneCircle}>
              <Ionicons name="videocam" size={40} color="#FFF" />
            </View>
          </Animated.View>

          <Text style={styles.title}>Richiesta Lezione Live</Text>

          {/* Student info */}
          {pendingRequest?.student && (
            <View style={styles.studentInfo}>
              <View style={styles.studentAvatar}>
                {pendingRequest.student.profile_image ? (
                  <Image source={{ uri: getMediaUrl(pendingRequest.student.profile_image) || '' }} style={styles.studentAvatarImg} />
                ) : (
                  <Ionicons name="person" size={28} color="#FFF" />
                )}
              </View>
              <Text style={styles.studentName}>{pendingRequest.student.name || pendingRequest.student.username}</Text>
            </View>
          )}

          <Text style={styles.subtitle}>vuole fare una lezione con te</Text>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.rejectBtn} onPress={handleReject} data-testid="reject-call-btn">
              <View style={styles.rejectCircle}>
                <Ionicons name="close" size={32} color="#FFF" />
              </View>
              <Text style={styles.btnLabel}>Rifiuta</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} data-testid="accept-call-btn">
              <View style={styles.acceptCircle}>
                <Ionicons name="videocam" size={32} color="#FFF" />
              </View>
              <Text style={styles.btnLabel}>Accetta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
    width: '100%',
  },
  phoneIconContainer: {
    marginBottom: 30,
  },
  phoneCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF6978',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6978',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  studentInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  studentAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#FF6978',
  },
  studentAvatarImg: {
    width: '100%',
    height: '100%',
  },
  studentName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    marginBottom: 50,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
  },
  rejectBtn: {
    alignItems: 'center',
  },
  acceptBtn: {
    alignItems: 'center',
  },
  rejectCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  acceptCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  btnLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
