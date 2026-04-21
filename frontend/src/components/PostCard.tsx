import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, FlatList, ScrollView, Animated, Alert, ActivityIndicator, GestureResponderEvent, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import api, { getMediaUrl, getThumbnailUrl, getDirectVideoUrl } from '../services/api';
import ShareModal from './ShareModal';
import { OptimizedImage, preloadImages } from './OptimizedMedia';

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
  onSharePress?: (post: Post) => void;
  currentUserId?: string;
  feedAudioOn?: boolean;
  onToggleFeedAudio?: () => void;
}

function isVideoPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const l = path.toLowerCase();
  return l.includes('.mp4') || l.includes('.mov') || l.includes('.webm') || l.includes('video') || l.includes('mediadelivery.net');
}

// WebView video player - pure rendering, no touch handling
function FeedVideoPlayer({ url, height, isVisible, muted, paused = false }: { url: string; height: number; isVisible: boolean; muted: boolean; paused?: boolean }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<any>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isVisible && !paused) {
        videoRef.current.playAsync?.().catch(() => {});
      } else {
        // Aggressively stop + mute to kill any lingering audio tracks (expo-av iOS bug)
        videoRef.current.setIsMutedAsync?.(true).catch(() => {});
        videoRef.current.pauseAsync?.().catch(() => {});
        videoRef.current.stopAsync?.().catch(() => {});
      }
    }
  }, [isVisible, paused]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.setIsMutedAsync?.(muted).catch(() => {});
    }
  }, [muted]);

  // Cleanup: stop video when component unmounts (fixes stuck audio)
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.stopAsync?.().catch(() => {});
        videoRef.current.unloadAsync?.().catch(() => {});
      }
    };
  }, []);

  return (
    <View style={{ width: '100%', height }}>
      <Video
        ref={videoRef}
        source={{ uri: url }}
        style={{ width: '100%', height }}
        resizeMode={ResizeMode.COVER}
        shouldPlay={isVisible && !paused}
        isMuted={muted}
        isLooping
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
        onPlaybackStatusUpdate={(status: any) => {
          if (status.isLoaded && isLoading) setIsLoading(false);
        }}
      />
      {isLoading && !hasError && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color="#FF6978" />
        </View>
      )}
      {hasError && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="videocam-off-outline" size={40} color="#666" />
          <Text style={{ color: '#888', fontSize: 12, marginTop: 8 }}>Video non disponibile</Text>
        </View>
      )}
      {/* Pause indicator overlay */}
      {paused && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }]} pointerEvents="none">
          <Ionicons name="pause" size={50} color="rgba(255,255,255,0.8)" />
        </View>
      )}
    </View>
  );
}

export default function PostCard({ post, onUserPress, onCommentPress, onDeletePress, onSharePress, currentUserId, isVisible = true, feedAudioOn, onToggleFeedAudio }: PostCardProps & { isVisible?: boolean }) {
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [isSaved, setIsSaved] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const lastTap = useRef(0);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  // If parent provided feedAudioOn (Home feed → Instagram-like shared state), use it.
  // Otherwise fall back to local muted state (e.g. when used in single post view).
  const usingSharedAudio = typeof feedAudioOn === 'boolean' && typeof onToggleFeedAudio === 'function';
  const [localMuted, setLocalMuted] = useState(true);
  // CRITICAL: if the post is off-screen, force mute even if shared audio is on.
  // Only the currently visible post should produce sound.
  const videoMuted = !isVisible || (usingSharedAudio ? !feedAudioOn : localMuted);
  const toggleMute = () => {
    if (usingSharedAudio) onToggleFeedAudio!();
    else setLocalMuted(v => !v);
  };
  const router = useRouter();
  
  // When post goes off-screen, don't fight the shared state — the video is paused anyway
  // (no need to force-mute because other visible posts will inherit feedAudioOn)
  
  // Hold-to-pause state (Instagram-style)
  const [isPaused, setIsPaused] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);

  // Build media URLs list - prefer 'media' field for videos (has correct CDN URL)
  // media_urls may contain stale embed URLs from Bunny Stream
  const mediaUrls = (() => {
    const urls = (post.media_urls && post.media_urls.length > 0) ? post.media_urls : [];
    // If post has a direct media field, use it as primary
    if (post.media && urls.length <= 1) {
      return [post.media];
    }
    // For carousels, replace any broken embed URLs with the media field
    if (urls.length > 1) {
      return urls.map(u => {
        if (u && u.includes('iframe.mediadelivery.net') && post.media && !post.media.includes('iframe.mediadelivery.net')) {
          return post.media;
        }
        return u;
      });
    }
    return post.media ? [post.media] : [];
  })();
  const isCarousel = mediaUrls.length > 1;
  const mediaHeight = Math.min(SCREEN_WIDTH * 1.25, 500);
  const isOwner = currentUserId === post.user_id;

  const isSingleVideo = !isCarousel && mediaUrls.length === 1 && isVideoPath(mediaUrls[0]);

  // Hold-to-pause handlers (Instagram-style)
  const handlePressIn = (e: GestureResponderEvent) => {
    // Start hold timer - after 200ms, pause the video
    holdTimerRef.current = setTimeout(() => {
      setIsPaused(true);
    }, 200);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    // Clear hold timer
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    // Resume if was paused
    if (isPaused) {
      setIsPaused(false);
    }
  };

  const handleDoubleTap = () => {
    // If video is paused, don't process tap
    if (isPaused) return;
    
    const now = Date.now();
    if (now - lastTap.current < 350) {
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
      setTimeout(() => {
        if (lastTap.current === now) {
          // Single tap on video → open Reels. Single tap on photo → do nothing
          if (isSingleVideo) {
            router.push({ pathname: '/(main)/reels', params: { postId: post.id } });
          }
        }
      }, 350);
    }
  };
  
  // Handle share button press
  const handleSharePress = () => {
    setShowShareModal(true);
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeft} onPress={() => onUserPress?.(post.user_id)}>
          <View style={styles.avatarWrap}>
            {post.user?.profile_image ? (
              <OptimizedImage uri={getMediaUrl(post.user.profile_image)} width={36} height={36} style={styles.avatar} priority="high" />
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
            /* Carousel: ScrollView for reliable horizontal swipe with hold-to-pause */
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
                const isVid = isVideoPath(url);
                const fullUrl = isVid ? (getDirectVideoUrl(url) || '') : (getMediaUrl(url) || '');
                return (
                  <TouchableOpacity 
                    key={index} 
                    activeOpacity={1} 
                    onPressIn={isVid ? handlePressIn : undefined}
                    onPressOut={isVid ? handlePressOut : undefined}
                    onPress={handleDoubleTap} 
                    style={{ width: SCREEN_WIDTH, height: mediaHeight }} 
                    data-testid={`carousel-tap-${post.id}-${index}`}
                  >
                    {isVid ? (
                      <FeedVideoPlayer url={fullUrl} height={mediaHeight} isVisible={index === carouselIndex} muted={videoMuted} paused={isPaused} />
                    ) : (
                      <OptimizedImage uri={fullUrl} width={SCREEN_WIDTH} height={mediaHeight} resizeMode="cover" priority="high" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : isSingleVideo ? (
            /* Single video: tap overlay with hold-to-pause (Instagram-style) */
            <View style={{ width: '100%', height: mediaHeight }}>
              <FeedVideoPlayer url={getDirectVideoUrl(mediaUrls[0]) || ''} height={mediaHeight} isVisible={isVisible} muted={videoMuted} paused={isPaused} />
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handleDoubleTap}
                data-testid={`video-tap-${post.id}`}
              />
              <TouchableOpacity
                onPress={toggleMute}
                style={[styles.controlBtn, { position: 'absolute', bottom: 10, right: 10, zIndex: 10 }]}
                data-testid={`mute-btn-${post.id}`}
              >
                <Ionicons name={videoMuted ? 'volume-mute' : 'volume-high'} size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            /* Single photo: double tap to like */
            <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap} data-testid={`photo-tap-${post.id}`}>
              <Image source={{ uri: getMediaUrl(mediaUrls[0]) || '' }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </TouchableOpacity>
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
          <TouchableOpacity onPress={handleSharePress} style={styles.actionBtn} data-testid={`share-btn-${post.id}`}>
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
      
      {/* Share Modal (Instagram-style) */}
      <ShareModal 
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        mediaUrl={mediaUrls[0]}
        mediaType={isSingleVideo ? 'video' : 'photo'}
        postId={post.id}
      />
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
