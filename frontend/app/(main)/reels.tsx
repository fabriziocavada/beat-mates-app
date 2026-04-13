import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
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
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import Colors from '../../src/constants/colors';
import TabBar from '../../src/components/TabBar';
import api, { getMediaUrl, getDirectVideoUrl } from '../../src/services/api';
import ShareModal from '../../src/components/ShareModal';

const { width, height } = Dimensions.get('window');
const ITEM_HEIGHT = height - 130;

const ReelVideoPlayer = memo(({
  videoUrl,
  isActive,
}: {
  videoUrl: string;
  isActive: boolean;
}) => {
  const videoRef = useRef<Video>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.playAsync().catch(() => {});
      setIsPaused(false);
    } else {
      videoRef.current.pauseAsync().catch(() => {});
    }
  }, [isActive]);

  return (
    <View style={styles.videoBg}>
      <Video
        ref={videoRef}
        source={{ uri: videoUrl }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={isActive}
        isLooping
        isMuted={!isActive}
        onLoad={() => setIsLoading(false)}
        onError={(e) => { console.log('Video error:', videoUrl, e); setHasError(true); setIsLoading(false); }}
        onPlaybackStatusUpdate={(status: any) => {
          if (status.isLoaded) setIsLoading(false);
          if (status.isLoaded && status.didJustFinish) {
            videoRef.current?.replayAsync().catch(() => {});
          }
        }}
      />

      {isActive && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => {
            if (isPaused) { videoRef.current?.playAsync(); setIsPaused(false); }
            else { videoRef.current?.pauseAsync(); setIsPaused(true); }
          }}
        >
          {isPaused && (
            <View style={styles.pauseOverlay}>
              <Ionicons name="play" size={60} color="rgba(255,255,255,0.85)" />
            </View>
          )}
        </TouchableOpacity>
      )}

      {isActive && isLoading && !hasError && (
        <View style={styles.spinnerOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color="#FF6978" />
        </View>
      )}

      {hasError && (
        <View style={styles.errorOverlay} pointerEvents="none">
          <Ionicons name="videocam-off-outline" size={48} color="#666" />
          <Text style={styles.errorText}>Video non disponibile</Text>
          <Text style={{ color: '#555', fontSize: 10, marginTop: 4 }}>{videoUrl.substring(0, 60)}</Text>
        </View>
      )}
    </View>
  );
});

interface ReelPost {
  id: string;
  user_id: string;
  type: string;
  media: string;
  caption: string;
  user?: { id: string; username: string; name: string; profile_image: string | null; };
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  created_at: string;
  _videoUrl: string;
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareReelData, setShareReelData] = useState<ReelPost | null>(null);

  useEffect(() => { loadReels(); }, []);

  useFocusEffect(useCallback(() => {
    setIsScreenFocused(true);
    return () => setIsScreenFocused(false);
  }, []));

  const loadReels = async () => {
    try {
      const response = await api.get('/posts');
      const videoPosts = response.data
        .filter((p: any) => p.type === 'video' && p.media)
        .map((p: any) => {
          const directUrl = getDirectVideoUrl(p.media) || getMediaUrl(p.media) || p.media;
          console.log('[Reels] Video:', p.id.substring(0, 8), 'url:', directUrl);
          return { ...p, _videoUrl: directUrl };
        });

      console.log('[Reels] Found', videoPosts.length, 'videos');
      setReels(videoPosts);

      if (postId && videoPosts.length > 0) {
        const idx = videoPosts.findIndex((p: ReelPost) => p.id === postId);
        if (idx >= 0) {
          setCurrentIndex(idx);
          setTimeout(() => flatListRef.current?.scrollToIndex({ index: idx, animated: false }), 100);
        }
      }
    } catch (error) {
      console.error('Failed to load reels', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (id: string) => {
    try {
      await api.post(`/posts/${id}/like`);
      setLikedPosts(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
      setReels(prev => prev.map(r => r.id === id ? { ...r, likes_count: likedPosts.has(id) ? r.likes_count - 1 : r.likes_count + 1 } : r));
    } catch (error) { console.error('Like error', error); }
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setCurrentIndex(viewableItems[0].index ?? 0);
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

  const renderReel = useCallback(({ item, index }: { item: ReelPost; index: number }) => {
    const isActive = index === currentIndex && isScreenFocused;
    const isLiked = likedPosts.has(item.id) || item.is_liked;
    const profileUrl = getMediaUrl(item.user?.profile_image);

    return (
      <View style={[styles.reelContainer, { height: ITEM_HEIGHT }]}>
        <ReelVideoPlayer videoUrl={item._videoUrl} isActive={isActive} />

        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.bottomInfo}>
            <TouchableOpacity style={styles.userRow} onPress={() => router.push(`/(main)/user/${item.user_id}`)}>
              <View style={styles.reelAvatar}>
                {profileUrl ? <Image source={{ uri: profileUrl }} style={styles.avatarImg} /> : <Ionicons name="person" size={16} color="#FFF" />}
              </View>
              <Text style={styles.username}>@{item.user?.username}</Text>
            </TouchableOpacity>
            {item.caption ? <Text style={styles.caption} numberOfLines={3}>{item.caption}</Text> : null}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(item.id)}>
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={30} color={isLiked ? Colors.primary : "#FFF"} />
              <Text style={styles.actionText}>{item.likes_count || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/(main)/comments/${item.id}`)}>
              <Ionicons name="chatbubble-outline" size={28} color="#FFF" />
              <Text style={styles.actionText}>{item.comments_count || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => { setShareReelData(item); setShowShareModal(true); }}>
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
  }, [currentIndex, isScreenFocused, likedPosts]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>
        <TabBar activeTab="reels" onTabPress={handleTabPress} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header}>
        {postId ? (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}><Ionicons name="chevron-back" size={28} color="#FFF" /></TouchableOpacity>
        ) : (
          <Text style={styles.headerTitle}>Reels</Text>
        )}
        {!postId && (
          <TouchableOpacity onPress={() => router.push('/(main)/create-post')}><Ionicons name="videocam" size={24} color="#FFF" /></TouchableOpacity>
        )}
      </View>

      {reels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="videocam-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>Nessun video ancora</Text>
          <TouchableOpacity style={styles.createButton} onPress={() => router.push('/(main)/create-post')}>
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
          windowSize={5}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          removeClippedSubviews={false}
          getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        />
      )}
      <TabBar activeTab="reels" onTabPress={handleTabPress} />
      <ShareModal visible={showShareModal} onClose={() => { setShowShareModal(false); setShareReelData(null); }} mediaUrl={shareReelData?.media} mediaType="video" postId={shareReelData?.id} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, position: 'absolute', top: 44, left: 0, right: 0, zIndex: 10 },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reelContainer: { width, position: 'relative', backgroundColor: '#000' },
  videoBg: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  pauseOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  spinnerOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  errorOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#888', fontSize: 12, marginTop: 8 },
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 16, paddingBottom: 20 },
  bottomInfo: { flex: 1, marginRight: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reelAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#333' },
  avatarImg: { width: '100%', height: '100%' },
  username: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  caption: { color: '#FFF', fontSize: 14, lineHeight: 20 },
  actions: { alignItems: 'center', gap: 20, paddingBottom: 10 },
  actionBtn: { alignItems: 'center' },
  actionText: { color: '#FFF', fontSize: 12, marginTop: 3, fontWeight: '600' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 8 },
  createButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 16 },
  createButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
