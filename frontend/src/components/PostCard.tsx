import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, FlatList, ScrollView, Animated, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import api, { getMediaUrl, getThumbnailUrl, getVideoPlayerUrl } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Post {
  id: string;
  user_id: string;
  user?: { id: string; username: string; name: string; profile_image: string | null; };
  type: string;
  media: string | null;
  media_urls?: string[];
  caption: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  created_at: string;
}

interface PostCardProps {
  post: Post;
  onUserPress?: (userId: string) => void;
  onCommentPress?: (postId: string) => void;
  onDeletePress?: (postId: string) => void;
  currentUserId?: string;
}

function isVideoPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const l = path.toLowerCase();
  return l.includes('.mp4') || l.includes('.mov') || l.includes('.webm') || l.includes('video');
}

// WebView video player - pure rendering, no touch handling
function FeedVideoPlayer({ url, height, isVisible, muted }: { url: string; height: number; isVisible: boolean; muted: boolean }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const webRef = useRef<WebView>(null);
  const lastMuted = useRef(muted);

  // Sync muted state with WebView
  useEffect(() => {
    if (lastMuted.current !== muted) {
      lastMuted.current = muted;
      webRef.current?.injectJavaScript(`var v=document.getElementById('v');if(v)v.muted=${muted};true;`);
    }
  }, [muted]);

  const playerUrl = getVideoPlayerUrl(url);

  return (
    <View style={{ width: '100%', height }} pointerEvents="none">
      <WebView
        ref={webRef}
        source={{ uri: playerUrl }}
        style={{ width: '100%', height, opacity: isLoading ? 0 : 1 }}
        scrollEnabled={false}
        bounces={false}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        originWhitelist={['*']}
        onMessage={(e) => {
          const msg = e.nativeEvent.data;
          if (msg === 'ready' || msg === 'playing') setIsLoading(false);
          if (msg.startsWith('error')) setHasError(true);
        }}
        onError={() => setHasError(true)}
      />
      {isLoading && !hasError && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color="#FF6978" />
          <Text style={{ color: '#888', fontSize: 12, marginTop: 8 }}>Caricamento video...</Text>
        </View>
      )}
      {hasError && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="videocam-off-outline" size={40} color="#666" />
          <Text style={{ color: '#888', fontSize: 12, marginTop: 8 }}>Video non disponibile</Text>
        </View>
      )}
    </View>
  );
}

export default function PostCard({ post, onUserPress, onCommentPress, onDeletePress, currentUserId }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [isSaved, setIsSaved] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const lastTap = useRef(0);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const [videoMuted, setVideoMuted] = useState(true);
  const router = useRouter();

  const mediaUrls = (post.media_urls && post.media_urls.length > 0)
    ? post.media_urls
    : (post.media ? [post.media] : []);
  const isCarousel = mediaUrls.length > 1;
  const mediaHeight = Math.min(SCREEN_WIDTH * 1.25, 500);
  const isOwner = currentUserId === post.user_id;

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 350) {
      // Double tap → like
      if (!isLiked) handleLike();
      heartScale.setValue(0.3);
      heartOpacity.setValue(1);
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
        Animated.timing(heartOpacity, { toValue: 0, duration: 300, delay: 300, useNativeDriver: true }),
      ]).start();
      lastTap.current = 0;
    } else {
      lastTap.current = now;
      // Single tap → navigate (after 350ms if no second tap)
      setTimeout(() => {
        if (lastTap.current === now) {
          if (hasVideo) {
            // Video post → open in Reels with this post
            router.push({ pathname: '/(main)/reels', params: { postId: post.id } });
          } else {
            // Image post → open post detail
            onCommentPress?.(post.id);
          }
        }
      }, 350);
    }
  };

  const handleLike = async () => {
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? prev - 1 : prev + 1);
    try { await api.post(`/posts/${post.id}/like`); } catch {
      setIsLiked(wasLiked);
      setLikesCount(prev => wasLiked ? prev + 1 : prev - 1);
    }
  };

  const handleSave = async () => {
    setIsSaved(!isSaved);
    try { await api.post(`/posts/${post.id}/save`); } catch { setIsSaved(!isSaved); }
  };

  const handleDelete = () => {
    Alert.alert('Elimina post', 'Sei sicuro di voler eliminare questo post?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => onDeletePress?.(post.id) },
    ]);
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    const now = new Date();
    const h = Math.floor((now.getTime() - d.getTime()) / 3600000);
    if (h < 1) return 'Adesso';
    if (h < 24) return `${h}h fa`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}g fa`;
    return d.toLocaleDateString('it-IT');
  };

  const handleCarouselScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(x / SCREEN_WIDTH);
    if (newIndex !== carouselIndex) setCarouselIndex(newIndex);
  };

  const isSingleVideo = !isCarousel && mediaUrls.length === 1 && isVideoPath(mediaUrls[0]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeft} onPress={() => onUserPress?.(post.user_id)}>
          <View style={styles.avatarWrap}>
            {post.user?.profile_image ? (
              <Image source={{ uri: getMediaUrl(post.user.profile_image) || '' }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPH]}><Ionicons name="person" size={16} color="#666" /></View>
            )}
          </View>
          <View>
            <Text style={styles.username}>{post.user?.username || 'Unknown'}</Text>
            <Text style={styles.date}>{formatDate(post.created_at)}</Text>
          </View>
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} data-testid={`delete-post-${post.id}`}>
            <Ionicons name="trash-outline" size={20} color="#FF6978" />
          </TouchableOpacity>
        )}
      </View>

      {/* Media */}
      {mediaUrls.length > 0 && (
        <View style={{ height: mediaHeight, position: 'relative' }}>
          {isCarousel ? (
            /* Carousel: ScrollView for reliable horizontal swipe */
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleCarouselScroll}
              decelerationRate="fast"
              bounces={false}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
            >
              {mediaUrls.map((url, index) => {
                const fullUrl = getMediaUrl(url) || '';
                const isVid = isVideoPath(url);
                return (
                  <View key={index} style={{ width: SCREEN_WIDTH, height: mediaHeight }}>
                    {isVid ? (
                      <FeedVideoPlayer url={fullUrl} height={mediaHeight} isVisible={index === carouselIndex} muted={videoMuted} />
                    ) : (
                      <Image source={{ uri: fullUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    )}
                  </View>
                );
              })}
            </ScrollView>
          ) : isSingleVideo ? (
            /* Single video: tap overlay → opens in Reels */
            <View style={{ width: '100%', height: mediaHeight }}>
              <FeedVideoPlayer url={getMediaUrl(mediaUrls[0]) || ''} height={mediaHeight} isVisible={true} muted={videoMuted} />
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={handleDoubleTap}
                data-testid={`video-tap-${post.id}`}
              />
              <TouchableOpacity
                onPress={() => setVideoMuted(!videoMuted)}
                style={[styles.controlBtn, { position: 'absolute', bottom: 10, right: 10, zIndex: 10 }]}
                data-testid={`mute-btn-${post.id}`}
              >
                <Ionicons name={videoMuted ? 'volume-mute' : 'volume-high'} size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            /* Single photo: no overlay, stays in feed */
            <Image source={{ uri: getMediaUrl(mediaUrls[0]) || '' }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          )}

          {isCarousel && (
            <View style={styles.dotsRow}>
              {mediaUrls.map((_, i) => (
                <View key={i} style={[styles.dot, i === carouselIndex && styles.dotActive]} />
              ))}
            </View>
          )}
          {isCarousel && (
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>{carouselIndex + 1}/{mediaUrls.length}</Text>
            </View>
          )}
          <Animated.View style={[styles.heartOverlay, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]} pointerEvents="none">
            <Ionicons name="heart" size={80} color="#FF6978" />
          </Animated.View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <TouchableOpacity onPress={handleLike} style={styles.actionBtn} data-testid={`like-btn-${post.id}`}>
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={24} color={isLiked ? '#FF6978' : '#FFF'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onCommentPress?.(post.id)} style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="paper-plane-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleSave}>
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {likesCount > 0 && <Text style={styles.likes}>{likesCount} like</Text>}
        {post.caption ? (
          <Text style={styles.caption}><Text style={styles.captionUser}>{post.user?.username} </Text>{post.caption}</Text>
        ) : null}
        {post.comments_count > 0 && (
          <TouchableOpacity onPress={() => onCommentPress?.(post.id)}>
            <Text style={styles.viewComments}>Vedi tutti i {post.comments_count} commenti</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#0a0a1a', marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarWrap: { marginRight: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarPH: { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  username: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  date: { color: '#888', fontSize: 11, marginTop: 1 },
  deleteBtn: { padding: 8 },
  videoControls: { position: 'absolute', bottom: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  controlBtn: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dotsRow: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#FFF', width: 8, height: 8, borderRadius: 4 },
  counterBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  counterText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  heartOverlay: { position: 'absolute', top: '50%', left: '50%', marginTop: -40, marginLeft: -40 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  leftActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { marginRight: 16 },
  footer: { paddingHorizontal: 12, marginBottom: 8 },
  likes: { color: '#FFF', fontWeight: '600', fontSize: 13, marginBottom: 4 },
  caption: { color: '#FFF', fontSize: 13, lineHeight: 18 },
  captionUser: { fontWeight: '600' },
  viewComments: { color: '#888', fontSize: 13, marginTop: 4 },
});
