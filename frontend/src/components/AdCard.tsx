import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api, { getMediaUrl } from '../services/api';

const { width } = Dimensions.get('window');

interface Ad {
  id: string;
  user_id: string;
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

interface AdCardProps {
  ad: Ad;
}

export default function AdCard({ ad }: AdCardProps) {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(true);

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
    <View style={styles.container} data-testid="ad-card">
      {/* Sponsored label */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          {ad.user?.profile_image ? (
            <Image source={{ uri: getMediaUrl(ad.user.profile_image) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="megaphone" size={16} color="#fff" />
            </View>
          )}
          <View>
            <Text style={styles.username}>{ad.user?.name || 'Advertiser'}</Text>
            <Text style={styles.sponsoredLabel}>Sponsorizzato</Text>
          </View>
        </View>
        <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
      </View>

      {/* Media */}
      <TouchableOpacity activeOpacity={0.95} onPress={handlePress}>
        {ad.media_type === 'video' ? (
          <Video
            source={{ uri: mediaUrl }}
            style={styles.media}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isPlaying}
            isLooping
            isMuted={false}
          />
        ) : (
          <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="cover" />
        )}
        
        {/* CTA Overlay */}
        <View style={styles.ctaOverlay}>
          <View style={styles.ctaButton}>
            <Text style={styles.ctaText}>{ad.link_text}</Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </View>
        </View>
      </TouchableOpacity>

      {/* Title and action buttons */}
      <View style={styles.footer}>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="heart-outline" size={26} color="#262626" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={24} color="#262626" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="paper-plane-outline" size={24} color="#262626" />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>{ad.title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    backgroundColor: '#E91E63',
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    fontWeight: '600',
    fontSize: 14,
    color: '#262626',
  },
  sponsoredLabel: {
    fontSize: 11,
    color: '#8e8e8e',
  },
  media: {
    width: width,
    height: width,
  },
  ctaOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0095f6',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actions: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  actionButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 14,
    color: '#262626',
    lineHeight: 20,
  },
});
