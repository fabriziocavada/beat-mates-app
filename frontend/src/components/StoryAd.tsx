import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
  Animated,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api, { getMediaUrl } from '../services/api';

const { width, height } = Dimensions.get('window');

interface Ad {
  id: string;
  user?: {
    id: string;
    username: string;
    name: string;
    profile_image: string | null;
  };
  title: string;
  media_url: string;
  media_type: 'image' | 'video';
  link_type: 'external' | 'lesson';
  link_url: string;
  link_text: string;
}

interface StoryAdProps {
  ad: Ad;
  onComplete: () => void;
  onSkip?: () => void;
  duration?: number; // in seconds
}

export default function StoryAd({ ad, onComplete, onSkip, duration = 6 }: StoryAdProps) {
  const router = useRouter();
  const [progress] = useState(new Animated.Value(0));

  useEffect(() => {
    // Animate progress bar
    Animated.timing(progress, {
      toValue: 1,
      duration: duration * 1000,
      useNativeDriver: false,
    }).start(() => {
      onComplete();
    });

    return () => progress.stopAnimation();
  }, []);

  const handlePress = async () => {
    // Track click
    try {
      await api.post(`/ads/${ad.id}/click`);
    } catch (e) {
      console.log('Failed to track click');
    }

    // Navigate or open link
    if (ad.link_type === 'lesson') {
      router.push(`/(main)/lesson/${ad.link_url}`);
    } else {
      Linking.openURL(ad.link_url);
    }
  };

  const handleSkip = () => {
    progress.stopAnimation();
    onSkip ? onSkip() : onComplete();
  };

  const mediaUrl = getMediaUrl(ad.media_url);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container} data-testid="story-ad">
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
        </View>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.sponsorBadge}>
            <Ionicons name="megaphone" size={14} color="#fff" />
          </View>
          <Text style={styles.sponsoredText}>Sponsorizzato</Text>
        </View>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Media (full screen) */}
      {ad.media_type === 'video' ? (
        <Video
          source={{ uri: mediaUrl }}
          style={styles.media}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted={false}
        />
      ) : (
        <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="cover" />
      )}

      {/* Bottom CTA */}
      <View style={styles.bottom}>
        <Text style={styles.title} numberOfLines={2}>{ad.title}</Text>
        <TouchableOpacity style={styles.ctaButton} onPress={handlePress}>
          <Ionicons name="chevron-up" size={20} color="#fff" />
          <Text style={styles.ctaText}>{ad.link_text}</Text>
        </TouchableOpacity>
      </View>

      {/* "Ad" label */}
      <View style={styles.adLabel}>
        <Text style={styles.adLabelText}>AD</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: 8,
    right: 8,
    zIndex: 20,
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sponsorBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E91E63',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsoredText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  skipButton: {
    padding: 4,
  },
  media: {
    width: width,
    height: height,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  bottom: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 20,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    gap: 6,
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  adLabel: {
    position: 'absolute',
    top: 100,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 20,
  },
  adLabelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
