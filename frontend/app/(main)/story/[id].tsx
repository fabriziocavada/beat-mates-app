import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api, { getMediaUrl } from '../../../src/services/api';

const { width, height } = Dimensions.get('window');

interface Story {
  id: string;
  user_id: string;
  media: string;
  type: string;
  user?: {
    id: string;
    username: string;
    name: string;
    profile_image: string | null;
  };
}

export default function ViewStoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [story, setStory] = useState<Story | null>(null);
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    if (id) {
      loadStory();
    }
  }, [id]);
  
  useEffect(() => {
    if (!story) return;
    
    // Auto progress for story
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          router.back();
          return prev;
        }
        return prev + 2;
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [story]);
  
  const loadStory = async () => {
    try {
      const response = await api.get(`/stories/${id}`);
      setStory(response.data);
    } catch (error) {
      console.error('Failed to load story', error);
      router.back();
    }
  };
  
  if (!story) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer} />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Story Image */}
      <Image
        source={{ uri: getMediaUrl(story.media) || '' }}
        style={styles.storyImage}
        resizeMode="cover"
      />
      
      {/* Progress Bar */}
      <SafeAreaView style={styles.topOverlay} edges={['top']}>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
        
        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            {story.user?.profile_image ? (
              <Image
                source={{ uri: getMediaUrl(story.user.profile_image) || '' }}
                style={styles.avatarImage}
              />
            ) : (
              <Ionicons name="person" size={20} color="#FFFFFF" />
            )}
          </View>
          <Text style={styles.username}>{story.user?.username}</Text>
          <Text style={styles.time}>4h</Text>
          
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      
      {/* Bottom Input */}
      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']}>
        <View style={styles.inputContainer}>
          <Ionicons name="camera-outline" size={24} color="#8E8E93" />
          <TextInput
            style={styles.input}
            placeholder="Send Message"
            placeholderTextColor="#8E8E93"
          />
        </View>
        <Ionicons name="paper-plane-outline" size={24} color="#FFFFFF" />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  storyImage: {
    ...StyleSheet.absoluteFillObject,
    width: width,
    height: height,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  progressContainer: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 1.5,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  username: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  time: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginLeft: 8,
  },
  closeButton: {
    marginLeft: 'auto',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    marginLeft: 12,
  },
});
