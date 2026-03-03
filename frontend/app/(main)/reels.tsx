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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Colors from '../../src/constants/colors';
import TabBar from '../../src/components/TabBar';
import api, { getMediaUrl } from '../../src/services/api';

// Each reel video: WebView approach for guaranteed iOS playback
function ReelVideoPlayer({ mediaUrl, isActive }: { mediaUrl: string; isActive: boolean }) {
  if (!mediaUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="videocam-off-outline" size={48} color="#666" />
      </View>
    );
  }

  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>*{margin:0;padding:0;background:#000}video{width:100vw;height:100vh;object-fit:cover}</style></head><body><video src="${mediaUrl}" autoplay loop muted playsinline webkit-playsinline></video><script>var v=document.querySelector('video');document.addEventListener('click',function(){v.paused?v.play():v.pause()});</script></body></html>`;

  return (
    <WebView
      source={{ html }}
      style={{ flex: 1 }}
      scrollEnabled={false}
      bounces={false}
      allowsInlineMediaPlayback={true}
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled={true}
    />
  );
}

const { width, height } = Dimensions.get('window');
const ITEM_HEIGHT = height - 130;

interface ReelPost {
  id: string;
  user_id: string;
  type: string;
  media: string;
  caption: string;
  user?: {
    id: string;
    username: string;
    name: string;
    profile_image: string | null;
  };
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  created_at: string;
}

export default function ReelsScreen() {
  const router = useRouter();
  const [reels, setReels] = useState<ReelPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadReels();
  }, []);

  const loadReels = async () => {
    try {
      const response = await api.get('/posts');
      // Show ONLY video posts
      const videoPosts = response.data.filter((p: ReelPost) => p.type === 'video' && p.media);
      setReels(videoPosts);
    } catch (error) {
      console.error('Failed to load reels', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      await api.post(`/posts/${postId}/like`);
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        if (newSet.has(postId)) {
          newSet.delete(postId);
        } else {
          newSet.add(postId);
        }
        return newSet;
      });
      setReels(prev => prev.map(r => 
        r.id === postId 
          ? { ...r, likes_count: likedPosts.has(postId) ? r.likes_count - 1 : r.likes_count + 1 }
          : r
      ));
    } catch (error) {
      console.error('Like error', error);
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
    const isLiked = likedPosts.has(item.id) || item.is_liked;
    const mediaUrl = getMediaUrl(item.media);
    const profileUrl = getMediaUrl(item.user?.profile_image);

    return (
      <View style={[styles.reelContainer, { height: ITEM_HEIGHT }]}>
        {mediaUrl ? (
          <ReelVideoPlayer mediaUrl={mediaUrl} isActive={isActive} />
        ) : (
          <View style={[styles.media, styles.placeholder]}>
            <Ionicons name="videocam-outline" size={48} color={Colors.textSecondary} />
          </View>
        )}
        
        {/* Overlay content */}
        <View style={styles.overlay}>
          {/* Bottom left - user info & caption */}
          <View style={styles.bottomInfo}>
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => router.push(`/(main)/user/${item.user_id}`)}
            >
              <View style={styles.reelAvatar}>
                {profileUrl ? (
                  <Image source={{ uri: profileUrl }} style={styles.avatarImg} />
                ) : (
                  <Ionicons name="person" size={16} color="#FFF" />
                )}
              </View>
              <Text style={styles.username}>@{item.user?.username}</Text>
            </TouchableOpacity>
            {item.caption ? (
              <Text style={styles.caption} numberOfLines={3}>{item.caption}</Text>
            ) : null}
          </View>

          {/* Right side - action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => handleLike(item.id)}
            >
              <Ionicons 
                name={isLiked ? "heart" : "heart-outline"} 
                size={30} 
                color={isLiked ? Colors.primary : "#FFF"} 
              />
              <Text style={styles.actionText}>{item.likes_count || 0}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => router.push(`/(main)/comments/${item.id}`)}
            >
              <Ionicons name="chatbubble-outline" size={28} color="#FFF" />
              <Text style={styles.actionText}>{item.comments_count || 0}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="paper-plane-outline" size={28} color="#FFF" />
              <Text style={styles.actionText}>Invia</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="bookmark-outline" size={28} color="#FFF" />
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
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reels</Text>
        <TouchableOpacity onPress={() => router.push('/(main)/create-post')}>
          <Ionicons name="videocam" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {reels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="videocam-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>Nessun contenuto ancora</Text>
          <Text style={styles.emptyText}>
            Pubblica foto e video di danza per vederli qui in stile TikTok!
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/(main)/create-post')}
          >
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={styles.createButtonText}>Crea Contenuto</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={reels}
          renderItem={renderReel}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
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
  media: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
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
    marginRight: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  reelAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  caption: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    alignItems: 'center',
    gap: 20,
    paddingBottom: 10,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionText: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 3,
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
