import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import Colors from '../../src/constants/colors';
import TabBar from '../../src/components/TabBar';
import api from '../../src/services/api';

const { width, height } = Dimensions.get('window');
const VIDEO_HEIGHT = height - 140; // Full screen minus tab bar and status

interface ReelPost {
  id: string;
  user_id: string;
  type: string;
  media_url: string;
  caption: string;
  user?: {
    id: string;
    username: string;
    name: string;
    profile_image: string | null;
  };
  likes_count: number;
  comments_count: number;
  created_at: string;
}

export default function ReelsScreen() {
  const router = useRouter();
  const [reels, setReels] = useState<ReelPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRefs = useRef<{[key: string]: Video}>({});

  useEffect(() => {
    loadReels();
  }, []);

  const loadReels = async () => {
    try {
      const response = await api.get('/posts?type=video');
      setReels(response.data.filter((p: ReelPost) => p.type === 'video'));
    } catch (error) {
      console.error('Failed to load reels', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }, []);

  const handleTabPress = (tab: string) => {
    switch (tab) {
      case 'home': router.push('/(main)/home'); break;
      case 'create': router.push('/(main)/create-post'); break;
      case 'available': router.push('/(main)/available'); break;
      case 'reels': break;
      case 'profile': router.push('/(main)/profile'); break;
    }
  };

  const renderReel = ({ item, index }: { item: ReelPost; index: number }) => {
    const isActive = index === currentIndex;

    return (
      <View style={[styles.reelContainer, { height: VIDEO_HEIGHT }]}>
        {item.media_url ? (
          <Video
            ref={(ref) => { if (ref) videoRefs.current[item.id] = ref; }}
            source={{ uri: item.media_url }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isActive}
            isLooping
            isMuted={false}
          />
        ) : (
          <View style={styles.noVideoPlaceholder}>
            <Ionicons name="videocam-off" size={48} color={Colors.textSecondary} />
          </View>
        )}
        
        {/* Overlay content */}
        <View style={styles.overlay}>
          {/* Left side - user info and caption */}
          <View style={styles.bottomInfo}>
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => router.push(`/(main)/user/${item.user_id}`)}
            >
              <View style={styles.reelAvatar}>
                {item.user?.profile_image ? (
                  <Image source={{ uri: item.user.profile_image }} style={styles.avatarImg} />
                ) : (
                  <Ionicons name="person" size={16} color="#FFF" />
                )}
              </View>
              <Text style={styles.username}>@{item.user?.username}</Text>
            </TouchableOpacity>
            {item.caption ? (
              <Text style={styles.caption} numberOfLines={2}>{item.caption}</Text>
            ) : null}
          </View>

          {/* Right side - actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="heart-outline" size={28} color="#FFF" />
              <Text style={styles.actionText}>{item.likes_count || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => router.push(`/(main)/comments/${item.id}`)}
            >
              <Ionicons name="chatbubble-outline" size={26} color="#FFF" />
              <Text style={styles.actionText}>{item.comments_count || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="paper-plane-outline" size={26} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
        <TabBar activeTab="reels" onTabPress={handleTabPress} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {reels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="videocam-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>Nessun video ancora</Text>
          <Text style={styles.emptyText}>
            Registra il primo video di danza! Max 10 secondi, formato verticale.
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/(main)/create-post')}
          >
            <Ionicons name="videocam" size={20} color="#FFF" />
            <Text style={styles.createButtonText}>Registra Video</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={reels}
          renderItem={renderReel}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={VIDEO_HEIGHT}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        />
      )}
      <TabBar activeTab="reels" onTabPress={handleTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelContainer: {
    width,
    position: 'relative',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  noVideoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 16,
    paddingBottom: 20,
  },
  bottomInfo: {
    flex: 1,
    marginRight: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reelAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#333',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  username: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  caption: {
    color: '#FFF',
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actions: {
    alignItems: 'center',
    gap: 20,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionText: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
