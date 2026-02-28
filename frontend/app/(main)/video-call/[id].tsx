import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../src/constants/colors';
import api from '../../../src/services/api';
import { useAuthStore } from '../../../src/store/authStore';

const { width, height } = Dimensions.get('window');

type CallState = 'connecting' | 'ringing' | 'active' | 'ended';

export default function VideoCallScreen() {
  const router = useRouter();
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  
  const [callState, setCallState] = useState<CallState>('connecting');
  const [callDuration, setCallDuration] = useState(0); // seconds
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [teacher, setTeacher] = useState<any>(null);
  const [connectingDots, setConnectingDots] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Load session data
  useEffect(() => {
    loadSession();
  }, [sessionId]);
  
  // Simulate connection flow
  useEffect(() => {
    // Connecting dots animation
    const dotsInterval = setInterval(() => {
      setConnectingDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    
    // After 2s -> ringing
    const ringingTimer = setTimeout(() => {
      setCallState('ringing');
    }, 2000);
    
    // After 5s -> active call
    const activeTimer = setTimeout(() => {
      setCallState('active');
    }, 5000);
    
    return () => {
      clearInterval(dotsInterval);
      clearTimeout(ringingTimer);
      clearTimeout(activeTimer);
    };
  }, []);
  
  // Call duration counter
  useEffect(() => {
    if (callState !== 'active') return;
    
    const timer = setInterval(() => {
      setCallDuration(prev => {
        // Auto-end after 30 minutes (1800 seconds)
        if (prev >= 1800) {
          setCallState('ended');
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [callState]);
  
  // Pulse animation for ringing
  useEffect(() => {
    if (callState === 'ringing') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [callState]);
  
  const loadSession = async () => {
    try {
      const response = await api.get(`/live-sessions/${sessionId}`);
      if (response.data.teacher) {
        setTeacher(response.data.teacher);
      }
    } catch (error) {
      console.error('Failed to load session', error);
    }
  };
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const remainingTime = () => {
    const remaining = 1800 - callDuration; // 30 min lesson
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleEndCall = () => {
    Alert.alert(
      'Termina Videochiamata',
      'Sei sicuro di voler terminare la lezione?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Si, termina',
          style: 'destructive',
          onPress: () => {
            setCallState('ended');
            setTimeout(() => router.back(), 2000);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Simulated remote video (teacher's camera) */}
      <View style={styles.remoteVideo}>
        {callState === 'active' ? (
          // Simulated video background
          <View style={styles.simulatedVideo}>
            <View style={styles.videoGradient}>
              {teacher?.profile_image ? (
                <Image source={{ uri: teacher.profile_image }} style={styles.fullScreenAvatar} />
              ) : (
                <View style={styles.videoPlaceholder}>
                  <Ionicons name="person" size={80} color={Colors.textSecondary} />
                </View>
              )}
            </View>
            {/* Teacher name overlay */}
            <View style={styles.teacherLabel}>
              <Text style={styles.teacherName}>{teacher?.name || 'Insegnante'}</Text>
            </View>
          </View>
        ) : callState === 'ended' ? (
          <View style={styles.endedScreen}>
            <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
            <Text style={styles.endedText}>Lezione terminata</Text>
            <Text style={styles.endedDuration}>Durata: {formatDuration(callDuration)}</Text>
          </View>
        ) : (
          <View style={styles.connectingScreen}>
            <Animated.View style={[styles.callingAvatar, { transform: [{ scale: pulseAnim }] }]}>
              {teacher?.profile_image ? (
                <Image source={{ uri: teacher.profile_image }} style={styles.callingAvatarImage} />
              ) : (
                <Ionicons name="person" size={48} color="#FFF" />
              )}
            </Animated.View>
            <Text style={styles.callingName}>{teacher?.name || 'Insegnante'}</Text>
            <Text style={styles.callingStatus}>
              {callState === 'connecting' ? `Connessione in corso${connectingDots}` : `Squilla${connectingDots}`}
            </Text>
          </View>
        )}
      </View>

      {/* Local video (your camera) - small PiP */}
      {callState === 'active' && !isCameraOff && (
        <View style={styles.localVideo}>
          <View style={styles.localVideoPlaceholder}>
            {user?.profile_image ? (
              <Image source={{ uri: user.profile_image }} style={styles.localVideoImage} />
            ) : (
              <Ionicons name="person" size={30} color="#FFF" />
            )}
          </View>
        </View>
      )}
      
      {/* Call duration bar */}
      {callState === 'active' && (
        <SafeAreaView style={styles.topBar} edges={['top']}>
          <View style={styles.durationBar}>
            <View style={styles.durationLeft}>
              <View style={styles.liveDot} />
              <Text style={styles.durationText}>{formatDuration(callDuration)}</Text>
            </View>
            <View style={styles.remainingBadge}>
              <Ionicons name="time-outline" size={14} color="#FFF" />
              <Text style={styles.remainingText}>Rimangono {remainingTime()}</Text>
            </View>
          </View>
        </SafeAreaView>
      )}

      {/* Controls */}
      {callState !== 'ended' && (
        <View style={styles.controls}>
          <TouchableOpacity 
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]} 
            onPress={() => setIsMuted(!isMuted)}
          >
            <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#FFF" />
            <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlBtn, isCameraOff && styles.controlBtnActive]} 
            onPress={() => setIsCameraOff(!isCameraOff)}
          >
            <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={24} color="#FFF" />
            <Text style={styles.controlLabel}>{isCameraOff ? 'Camera On' : 'Camera Off'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlBtn, isSpeaker && styles.controlBtnActive]} 
            onPress={() => setIsSpeaker(!isSpeaker)}
          >
            <Ionicons name={isSpeaker ? "volume-high" : "volume-medium"} size={24} color="#FFF" />
            <Text style={styles.controlLabel}>Speaker</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}>
            <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideo: {
    flex: 1,
  },
  simulatedVideo: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  videoGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenAvatar: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  videoPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#2D2D44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherLabel: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  teacherName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  connectingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  callingAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  callingAvatarImage: {
    width: '100%',
    height: '100%',
  },
  callingName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  callingStatus: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  endedScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  endedText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  endedDuration: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  localVideo: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  localVideoPlaceholder: {
    flex: 1,
    backgroundColor: '#2D2D44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  localVideoImage: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  durationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  durationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
  },
  durationText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  remainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  remainingText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 20,
  },
  controlBtn: {
    alignItems: 'center',
    gap: 4,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  controlLabel: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '500',
  },
  endCallBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
