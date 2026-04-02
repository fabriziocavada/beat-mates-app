import React, { useState, useEffect, useRef } from 'react';
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
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
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

interface PrerollAdProps {
  ad: Ad;
  onComplete: () => void;
  skipAfterSeconds?: number;
}

export default function PrerollAd({ ad, onComplete, skipAfterSeconds = 10 }: PrerollAdProps) {
  const router = useRouter();
  const [canSkip, setCanSkip] = useState(false);
  const [countdown, setCountdown] = useState(skipAfterSeconds);
  const [progress] = useState(new Animated.Value(0));
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    // Countdown timer for skip button
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanSkip(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // For image ads, auto-complete after a duration
  useEffect(() => {
    if (ad.media_type === 'image') {
      const timeout = setTimeout(() => {
        setCanSkip(true);
      }, skipAfterSeconds * 1000);

      return () => clearTimeout(timeout);
    }
  }, []);

  const handleVideoStatus = (status: AVPlaybackStatus) => {
    if (status.isLoaded && status.didJustFinish) {
      // Video ended, allow skip
      setCanSkip(true);
    }
  };

  const handleSkip = () => {
    if (canSkip) {
      onComplete();
    }
  };

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

  const mediaUrl = getMediaUrl(ad.media_url);

  return (
    <View style={styles.container} data-testid="preroll-ad">
      {/* Ad indicator */}
      <View style={styles.adIndicator}>
        <Ionicons name="megaphone" size={14} color="#FFD700" />
        <Text style={styles.adIndicatorText}>Annuncio • {ad.title}</Text>
      </View>

      {/* Media */}
      <TouchableOpacity activeOpacity={0.95} onPress={handlePress} style={styles.mediaContainer}>
        {ad.media_type === 'video' ? (
          <Video
            ref={videoRef}
            source={{ uri: mediaUrl }}
            style={styles.media}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping={false}
            isMuted={false}
            onPlaybackStatusUpdate={handleVideoStatus}
          />
        ) : (
          <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="contain" />
        )}
      </TouchableOpacity>

      {/* Skip button */}
      <View style={styles.skipContainer}>
        {canSkip ? (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Salta annuncio</Text>
            <Ionicons name="play-skip-forward" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.countdownButton}>
            <Text style={styles.countdownText}>Puoi saltare tra {countdown}s</Text>
          </View>
        )}
      </View>

      {/* CTA bar at bottom */}
      <View style={styles.ctaBar}>
        <View style={styles.ctaInfo}>
          <Text style={styles.ctaTitle} numberOfLines={1}>{ad.title}</Text>
          <Text style={styles.ctaSubtitle}>Sponsorizzato</Text>
        </View>
        <TouchableOpacity style={styles.ctaButton} onPress={handlePress}>
          <Text style={styles.ctaButtonText}>{ad.link_text}</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View 
          style={[
            styles.progressBar, 
            { 
              width: canSkip ? '100%' : `${((skipAfterSeconds - countdown) / skipAfterSeconds) * 100}%` 
            }
          ]} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  adIndicator: {
    position: 'absolute',
    top: 50,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    gap: 6,
    zIndex: 20,
  },
  adIndicatorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: width,
    height: height * 0.6,
  },
  skipContainer: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 20,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    gap: 6,
  },
  skipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  countdownButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
  },
  countdownText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  ctaBar: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    zIndex: 20,
  },
  ctaInfo: {
    flex: 1,
    marginRight: 12,
  },
  ctaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#262626',
  },
  ctaSubtitle: {
    fontSize: 11,
    color: '#8e8e8e',
    marginTop: 2,
  },
  ctaButton: {
    backgroundColor: '#0095f6',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFD700',
  },
});
