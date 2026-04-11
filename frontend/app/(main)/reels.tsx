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
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Colors from '../../src/constants/colors';
import TabBar from '../../src/components/TabBar';
import api, { getMediaUrl, getVideoPlayerUrl } from '../../src/services/api';
import ShareModal from '../../src/components/ShareModal';

// WebView video player with loading indicator and play/pause
// Pre-load adjacent videos by keeping WebView mounted but hidden
function ReelVideoPlayer({ mediaUrl, isActive, shouldPreload }: { mediaUrl: string; isActive: boolean; shouldPreload?: boolean }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const webRef = useRef<WebView>(null);
  const wasActive = useRef(false);

  // Pause/resume when isActive changes
  useEffect(() => {
    if (!mediaUrl) return;
    if (isActive && !wasActive.current) {
      // Becoming active - play
      wasActive.current = true;
      setIsPaused(false);
      webRef.current?.injectJavaScript(`var v=document.getElementById('v');if(v){v.play();v.muted=false}true;`);
    } else if (!isActive && wasActive.current) {
      // Becoming inactive - pause and mute
      wasActive.current = false;
      webRef.current?.injectJavaScript(`var v=document.getElementById('v');if(v){v.pause();v.muted=true}true;`);
    }
  }, [isActive, mediaUrl]);

  // Cleanup on unmount - stop audio
  useEffect(() => {
    return () => {
      webRef.current?.injectJavaScript(`var v=document.getElementById('v');if(v){v.pause();v.muted=true;v.src=''}true;`);
    };
  }, []);

  if (!mediaUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="videocam-off-outline" size={48} color="#666" />
      </View>
    );
  }

  // Pre-load: keep WebView mounted but invisible and paused
  const shouldLoadWebView = isActive || shouldPreload;
  const playerUrl = getVideoPlayerUrl(mediaUrl, { muted: !isActive, fit: 'contain', autoplay: isActive });

  const togglePlayPause = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    webRef.current?.injectJavaScript(`var v=document.getElementById('v');if(v){${newPaused ? 'v.pause()' : 'v.play()'}}true;`);
  };

  return (
    <View style={{ flex: 1 }}>
      {shouldLoadWebView ? (
        <WebView
          ref={webRef}
          source={{ uri: playerUrl }}
          style={{ flex: 1, opacity: isLoading && isActive ? 0 : (isActive ? 1 : 0) }}
          scrollEnabled={false}
          bounces={false}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled={true}
          originWhitelist={['*']}
          pointerEvents="none"
          onMessage={(e) => {
            const msg = e.nativeEvent.data;
            if (msg === 'ready' || msg === 'playing') setIsLoading(false);
            if (msg.startsWith('error')) setHasError(true);
          }}
          onError={() => setHasError(true)}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: '#000' }} />
      )}
      {/* Tap overlay for play/pause - only when active */}
      {isActive && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={togglePlayPause}
        >
          {isPaused && (
            <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }]}>
              <Ionicons name="play" size={60} color="rgba(255,255,255,0.85)" />
            </View>
          )}
        </TouchableOpacity>
      )}
      {isLoading && isActive && !hasError && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <ActivityIndicator size="large" color="#FF6978" />
          <Text style={{ color: '#666', marginTop: 10, fontSize: 12 }}>Caricamento...</Text>
        </View>
      )}
      {!isActive && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />
      )}
      {hasError && isActive && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <Ionicons name="videocam-off-outline" size={48} color="#666" />
          <Text style={{ color: '#888', fontSize: 12, marginTop: 8 }}>Video non disponibile</Text>
        </View>
      )}
    </View>
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
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  const [reels, setReels] = useState<ReelPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  
  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareReelData, setShareReelData] = useState<ReelPost | null>(null);

  useEffect(() => {
    loadReels();
  }, []);

  // Pause videos when navigating away, resume when coming back
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => {
        setIsScreenFocused(false);
      };
    }, [])
  );

  const loadReels = async () => {
    try {
      const response = await api.get('/posts');
      const videoPosts = response.data.filter((p: any) => {
        if (p.type === 'video' && p.media) return true;
        if (p.media_urls && p.media_urls.length > 0) {
          return p.media_urls.some((url: string) => {
            const l = url.toLowerCase();
            return l.includes('.mp4') || l.includes('.mov') || l.includes('.webm') || l.includes('video');
          });
        }
        return false;
      }).map((p: any) => {
        if (p.media_urls && p.media_urls.length > 0) {
          const videoUrl = p.media_urls.find((url: string) => {
            const l = url.toLowerCase();
            return l.includes('.mp4') || l.includes('.mov') || l.includes('.webm') || l.includes('video');
          });
          if (videoUrl) return { ...p, media: videoUrl };
        }
        return p;
      });
      setReels(videoPosts);
      // Scroll to the specific post if coming from feed
      if (postId && videoPosts.length > 0) {
        const targetIndex = videoPosts.findIndex((p: ReelPost) => p.id === postId);
        if (targetIndex >= 0) {
          setCurrentIndex(targetIndex);
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: targetIndex, animated: false });
          }, 100);
        }
      }
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

  // Share reel - open modal
  const handleShareToStory = (reel: ReelPost) => {
    setShareReelData(reel);
    setShowShareModal(true);
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
      case 'music': router.push('/(main)/music'); break;
      case 'profile': router.push('/(main)/profile'); break;
    }
  };

  const renderReel = ({ item, index }: { item: ReelPost; index: number }) => {
    const isActive = index === currentIndex;
    // Pre-load adjacent reels (1 before and 2 after) for smoother scrolling
    const shouldPreload = Math.abs(index - currentIndex) <= 2;
    const isLiked = likedPosts.has(item.id) || item.is_liked;
    const mediaUrl = getMediaUrl(item.media);
    const profileUrl = getMediaUrl(item.user?.profile_image);

    return (
      <View style={[styles.reelContainer, { height: ITEM_HEIGHT }]}>
        {mediaUrl ? (
          <ReelVideoPlayer 
            mediaUrl={mediaUrl} 
            isActive={isActive && isScreenFocused} 
            shouldPreload={shouldPreload}
          />
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
            
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => handleShareToStory(item)}
            >
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
        {postId ? (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }} data-testid="reels-back-btn">
            <Ionicons name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
        ) : (
          <Text style={styles.headerTitle}>Reels</Text>
        )}
        {!postId && (
          <TouchableOpacity onPress={() => router.push('/(main)/create-post')}>
            <Ionicons name="videocam" size={24} color="#FFF" />
          </TouchableOpacity>
        )}
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
          ref={flatListRef}
          data={reels}
          renderItem={renderReel}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          windowSize={3}
          maxToRenderPerBatch={2}
          removeClippedSubviews={true}
          getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        />
      )}
      <TabBar activeTab="reels" onTabPress={handleTabPress} />
      
      {/* Share Modal (Instagram-style) */}
      <ShareModal 
        visible={showShareModal}
        onClose={() => { setShowShareModal(false); setShareReelData(null); }}
        mediaUrl={shareReelData?.media}
        mediaType="video"
        postId={shareReelData?.id}
      />
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
