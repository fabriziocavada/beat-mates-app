import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../src/constants/colors';
import api from '../../../src/services/api';

interface User {
  id: string;
  username: string;
  name: string;
  profile_image: string | null;
  hourly_rate: number;
}

type SessionStatus = 'idle' | 'paying' | 'waiting' | 'active' | 'completed';

export default function RequestLessonScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [waitTime, setWaitTime] = useState(60);
  
  useEffect(() => {
    if (id) {
      loadUser();
    }
  }, [id]);
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let counter = 0;
    
    if (status === 'waiting' && waitTime > 0) {
      interval = setInterval(() => {
        setWaitTime((prev) => prev - 1);
        counter++;
        // Poll every 5 ticks instead of every tick
        if (counter % 5 === 0) {
          checkSessionStatus();
        }
      }, 1000);
    } else if (waitTime === 0 && status === 'waiting') {
      Alert.alert('Timeout', 'The teacher did not respond. Please try again later.');
      router.back();
    }
    
    return () => clearInterval(interval);
  }, [status, waitTime]);
  
  const loadUser = async () => {
    try {
      const response = await api.get(`/users/${id}`);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to load user', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const checkSessionStatus = async () => {
    if (!sessionId) return;
    
    try {
      const response = await api.get(`/live-sessions/${sessionId}`);
      if (response.data.status === 'active') {
        setStatus('active');
        router.push(`/(main)/video-call/${sessionId}`);
      } else if (response.data.status === 'rejected') {
        Alert.alert('Declined', 'The teacher declined your request.');
        router.back();
      }
    } catch (error) {
      console.error('Failed to check session status', error);
    }
  };
  
  const handlePayment = async () => {
    setStatus('paying');
    
    // Simulate payment (MOCK)
    setTimeout(async () => {
      try {
        const response = await api.post('/live-sessions/request', { teacher_id: id });
        setSessionId(response.data.id);
        setStatus('waiting');
      } catch (error: any) {
        Alert.alert('Error', error.response?.data?.detail || 'Failed to request session');
        setStatus('idle');
      }
    }, 1500);
  };
  
  if (isLoading || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.logoContainer}>
          <Text style={styles.logoWhite}>BEAT </Text>
          <Text style={styles.logoRed}>MATES</Text>
        </View>
        <View style={styles.headerRight}>
          <Ionicons name="heart-outline" size={24} color={Colors.text} />
          <Ionicons name="paper-plane-outline" size={24} color={Colors.text} style={{ marginLeft: 16 }} />
        </View>
      </View>
      
      <View style={styles.content}>
        {/* Background image placeholder */}
        <View style={styles.backgroundImage}>
          {user.profile_image ? (
            <Image source={{ uri: user.profile_image }} style={styles.bgImage} />
          ) : (
            <View style={styles.bgPlaceholder}>
              <Ionicons name="person" size={100} color={Colors.textMuted} />
            </View>
          )}
          
          {/* Overlay */}
          <View style={styles.overlay}>
            {status === 'idle' && (
              <View style={styles.paymentModal}>
                <Text style={styles.modalTitle}>Do you want to participate</Text>
                <Text style={styles.modalTitle}>in the lesson?</Text>
                
                <View style={styles.lessonInfo}>
                  <Text style={styles.lessonInfoText}>{user.name} / 1h</Text>
                  <Text style={styles.lessonPrice}>{user.hourly_rate}€</Text>
                </View>
                
                <TouchableOpacity style={styles.payButton} onPress={handlePayment}>
                  <Text style={styles.payButtonText}>MAKE THE PAYMENT</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {status === 'paying' && (
              <View style={styles.statusContainer}>
                <ActivityIndicator size="large" color={Colors.success} />
                <Text style={styles.statusText}>Processing payment...</Text>
              </View>
            )}
            
            {status === 'waiting' && (
              <View style={styles.statusContainer}>
                <View style={styles.timerCircle}>
                  <Text style={styles.timerNumber}>{waitTime}</Text>
                  <Text style={styles.timerLabel}>sec</Text>
                </View>
                <Text style={styles.waitingText}>In attesa che {user.name}</Text>
                <Text style={styles.waitingText}>accetti la richiesta...</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      
      {/* Bottom Input */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.messageInput}>
          <Ionicons name="camera-outline" size={24} color={Colors.textSecondary} />
          <Text style={styles.messageInputText}>Send Message</Text>
        </TouchableOpacity>
        <Ionicons name="paper-plane-outline" size={24} color={Colors.text} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logoContainer: {
    flexDirection: 'row',
  },
  logoWhite: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
  },
  logoRed: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  headerRight: {
    flexDirection: 'row',
  },
  content: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    position: 'relative',
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  bgPlaceholder: {
    flex: 1,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentModal: {
    alignItems: 'center',
    padding: 20,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  lessonInfo: {
    borderWidth: 1,
    borderColor: Colors.text,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginTop: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  lessonInfoText: {
    color: Colors.text,
    fontSize: 18,
  },
  lessonPrice: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  payButton: {
    backgroundColor: Colors.success,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 60,
  },
  payButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusText: {
    color: Colors.text,
    fontSize: 18,
    marginTop: 16,
  },
  timerCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  timerNumber: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: 'bold',
  },
  timerLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  waitingText: {
    color: Colors.text,
    fontSize: 18,
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  messageInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  messageInputText: {
    color: Colors.textSecondary,
    marginLeft: 12,
  },
});
