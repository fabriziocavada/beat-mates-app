import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../src/constants/colors';
import api from '../../../src/services/api';

interface Session {
  id: string;
  student_id: string;
  teacher_id: string;
  teacher?: {
    id: string;
    username: string;
    name: string;
    profile_image: string | null;
  };
  status: string;
  amount: number;
  started_at: string | null;
}

export default function VideoCallScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [session, setSession] = useState<Session | null>(null);
  const [remainingTime, setRemainingTime] = useState(30 * 60); // 30 minutes in seconds
  const [isEnding, setIsEnding] = useState(false);
  
  useEffect(() => {
    if (id) {
      loadSession();
    }
  }, [id]);
  
  useEffect(() => {
    if (remainingTime > 0 && session?.status === 'active') {
      const timer = setTimeout(() => {
        setRemainingTime((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (remainingTime === 0) {
      handleEndCall();
    }
  }, [remainingTime, session?.status]);
  
  const loadSession = async () => {
    try {
      const response = await api.get(`/live-sessions/${id}`);
      setSession(response.data);
    } catch (error) {
      console.error('Failed to load session', error);
    }
  };
  
  const handleEndCall = async () => {
    if (isEnding) return;
    setIsEnding(true);
    
    try {
      await api.post(`/live-sessions/${id}/end`);
      router.push(`/(main)/review/${id}`);
    } catch (error) {
      console.error('Failed to end session', error);
      router.back();
    }
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Main Video (Teacher) */}
      <View style={styles.mainVideo}>
        {session?.teacher?.profile_image ? (
          <Image source={{ uri: session.teacher.profile_image }} style={styles.videoImage} />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Ionicons name="person" size={100} color={Colors.textSecondary} />
          </View>
        )}
        
        {/* Header overlay */}
        <View style={styles.headerOverlay}>
          <View style={styles.teacherInfo}>
            <View style={styles.teacherAvatar}>
              {session?.teacher?.profile_image ? (
                <Image source={{ uri: session.teacher.profile_image }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={20} color={Colors.textSecondary} />
              )}
            </View>
            <View>
              <Text style={styles.teacherName}>{session?.teacher?.name || 'Teacher'}</Text>
              <Text style={styles.teacherDate}>Live Lesson</Text>
            </View>
            <TouchableOpacity style={styles.followButton}>
              <Text style={styles.followButtonText}>Follow</Text>
            </TouchableOpacity>
          </View>
          
          {/* Timer */}
          <View style={styles.timerContainer}>
            <View style={styles.timerCircle}>
              <Text style={styles.timerNumber}>{Math.floor(remainingTime / 60)}</Text>
              <Text style={styles.timerLabel}>min</Text>
            </View>
          </View>
        </View>
        
        {/* Volume indicator */}
        <View style={styles.volumeIndicator}>
          <View style={styles.volumeBar}>
            <View style={[styles.volumeFill, { height: '60%' }]} />
          </View>
          <Ionicons name="volume-high" size={20} color={Colors.text} />
        </View>
        
        {/* Student video (small) */}
        <View style={styles.studentVideo}>
          <View style={styles.studentVideoInner}>
            <Ionicons name="person" size={30} color={Colors.textSecondary} />
          </View>
        </View>
      </View>
      
      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="mic" size={28} color={Colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="videocam" size={28} color={Colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.endButton}
          onPress={handleEndCall}
        >
          <Ionicons name="call" size={24} color={Colors.text} />
          <Text style={styles.endButtonText}>End</Text>
        </TouchableOpacity>
      </View>
      
      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.messageInput}>
          <Ionicons name="camera-outline" size={24} color={Colors.textSecondary} />
          <Text style={styles.messageInputText}>Send Message</Text>
        </TouchableOpacity>
        <Ionicons name="paper-plane-outline" size={24} color={Colors.text} />
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mainVideo: {
    flex: 1,
    position: 'relative',
  },
  videoImage: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  teacherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teacherAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  teacherName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  teacherDate: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  followButton: {
    marginLeft: 12,
  },
  followButtonText: {
    color: Colors.text,
    fontSize: 14,
  },
  timerContainer: {
    alignItems: 'center',
  },
  timerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerNumber: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  timerLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
  },
  volumeIndicator: {
    position: 'absolute',
    left: 16,
    bottom: 100,
    alignItems: 'center',
  },
  volumeBar: {
    width: 8,
    height: 80,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  volumeFill: {
    width: '100%',
    backgroundColor: Colors.success,
    borderRadius: 4,
  },
  studentVideo: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    width: 100,
    height: 130,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    overflow: 'hidden',
  },
  studentVideoInner: {
    flex: 1,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 8,
  },
  endButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
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
  moreButton: {
    marginLeft: 12,
  },
});
