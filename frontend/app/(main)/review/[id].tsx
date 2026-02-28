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
  teacher_id: string;
  teacher?: {
    id: string;
    username: string;
    name: string;
    profile_image: string | null;
  };
}

export default function ReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [session, setSession] = useState<Session | null>(null);
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    if (id) {
      loadSession();
    }
  }, [id]);
  
  const loadSession = async () => {
    try {
      const response = await api.get(`/live-sessions/${id}`);
      setSession(response.data);
    } catch (error) {
      console.error('Failed to load session', error);
    }
  };
  
  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await api.post('/reviews', { session_id: id, rating });
      Alert.alert('Thank you!', 'Your review has been submitted.', [
        { text: 'OK', onPress: () => router.push('/(main)/home') },
      ]);
    } catch (error: any) {
      console.error('Failed to submit review', error);
      router.push('/(main)/home');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleSkip = () => {
    router.push('/(main)/home');
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip}>
          <Ionicons name="close" size={28} color={Colors.text} />
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
        {/* Background */}
        <View style={styles.backgroundImage}>
          {session?.teacher?.profile_image ? (
            <Image source={{ uri: session.teacher.profile_image }} style={styles.bgImage} />
          ) : (
            <View style={styles.bgPlaceholder}>
              <Ionicons name="person" size={100} color={Colors.textMuted} />
            </View>
          )}
          
          {/* Overlay */}
          <View style={styles.overlay}>
            <Text style={styles.title}>Leave a review</Text>
            <Text style={styles.subtitle}>to {session?.teacher?.name}</Text>
            
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={40}
                    color={star <= rating ? '#FFD700' : Colors.text}
                  />
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Submitting...' : 'Submit Review'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.messageInput}>
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
    padding: 20,
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 18,
    marginBottom: 30,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  starButton: {
    padding: 8,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 60,
  },
  submitButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: 'bold',
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
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  messageInputText: {
    color: Colors.textSecondary,
  },
});
