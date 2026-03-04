import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, ScrollView, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import api, { getMediaUrl } from '../services/api';

const { width } = Dimensions.get('window');

interface Liker {
  id: string;
  username: string;
  profile_image: string | null;
}

interface Post {
  id: string;
  user_id: string;
  user?: {
    id: string;
    username: string;
    name: string;
    profile_image: string | null;
  };
  type: string;
  media: string | null;
  media_urls?: string[];
  caption: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  recent_likers?: Liker[];
  created_at: string;
}

interface PostCardProps {
  post: Post;
  onUserPress?: (userId: string) => void;
  onCommentPress?: (postId: string) => void;
  onDeletePress?: (postId: string) => void;
}

function NativeVideoPlayer({ url, height }: { url: string; height: number }) {
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>*{margin:0;padding:0;background:#000}video{width:100%;height:100%;object-fit:cover}</style></head><body><video src="${url}" autoplay loop muted playsinline webkit-playsinline></video></body></html>`;
  return (
    <WebView source={{ html }} style={{ width: '100%', height }} scrollEnabled={false} bounces={false} allowsInlineMediaPlayback={true} mediaPlaybackRequiresUserAction={false} javaScriptEnabled={true} />
  );
}

function isVideoPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const lower = path.toLowerCase();
  return lower.includes('.mp4') || lower.includes('.mov') || lower.includes('.webm') || lower.includes('video');
}

export default function PostCard({ post, onUserPress, onCommentPress, onDeletePress }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [recentLikers, setRecentLikers] = useState<Liker[]>(post.recent_likers || []);
  const [isSaved, setIsSaved] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  
  // Double-tap like
  const lastTap = useRef(0);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  
  const mediaUrls = (post.media_urls && post.media_urls.length > 0) 
    ? post.media_urls 
    : (post.media ? [post.media] : []);
  const isCarousel = mediaUrls.length > 1;
  const mediaHeight = Math.min(width * 1.25, 500);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!isLiked) handleLike();
      // Show heart animation
      heartScale.setValue(0);
      heartOpacity.setValue(1);
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 15, bounciness: 10 }),
        Animated.timing(heartOpacity, { toValue: 0, duration: 400, delay: 200, useNativeDriver: true }),
      ]).start();
    }
    lastTap.current = now;
  };
  
  const handleLike = async () => {
    try {
      const response = await api.post(`/posts/${post.id}/like`);
      setIsLiked(response.data.liked);
      setLikesCount((prev) => response.data.liked ? prev + 1 : prev - 1);
      if (response.data.liked) {
        try { const likersRes = await api.get(`/posts/${post.id}/likers`); setRecentLikers(likersRes.data); } catch {}
      }
    } catch (error) {
      console.error('Failed to like post', error);
    }
  };
  
  const handleSave = async () => {
    try {
      const res = await api.post(`/posts/${post.id}/save`);
      setIsSaved(res.data.saved);
    } catch {}
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Adesso';
    if (hours < 24) return `${hours}h fa`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}g fa`;
    return date.toLocaleDateString('it-IT');
  };

  const onScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setCarouselIndex(idx);
  };
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity style={styles.header} onPress={() => onUserPress?.(post.user_id)}>
        <View style={styles.avatarContainer}>
          {post.user?.profile_image ? (
            <Image source={{ uri: getMediaUrl(post.user.profile_image) || '' }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={16} color="#666" />
            </View>
          )}
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.username}>{post.user?.username || 'Unknown'}</Text>
          <Text style={styles.date}>{formatDate(post.created_at)}</Text>
        </View>
      </TouchableOpacity>

      {/* Media - Carousel or Single */}
      {mediaUrls.length > 0 && (
        <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap} style={[styles.mediaContainer, { height: mediaHeight }]}>
          {isCarousel ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
              decelerationRate="fast"
            >
              {mediaUrls.map((url, idx) => {
                const fullUrl = getMediaUrl(url) || '';
                const isVid = isVideoPath(url);
                return (
                  <View key={idx} style={{ width, height: mediaHeight }}>
                    {isVid ? (
                      <NativeVideoPlayer url={fullUrl} height={mediaHeight} />
                    ) : (
                      <Image source={{ uri: fullUrl }} style={styles.media} resizeMode="cover" />
                    )}
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            isVideoPath(mediaUrls[0]) ? (
              <NativeVideoPlayer url={getMediaUrl(mediaUrls[0]) || ''} height={mediaHeight} />
            ) : (
              <Image source={{ uri: getMediaUrl(mediaUrls[0]) || '' }} style={styles.media} resizeMode="cover" />
            )
          )}
          
          {/* Carousel dots */}
          {isCarousel && (
            <View style={styles.dotsContainer}>
              {mediaUrls.map((_, idx) => (
                <View key={idx} style={[styles.dot, idx === carouselIndex && styles.dotActive]} />
              ))}
            </View>
          )}
          
          {/* Carousel counter */}
          {isCarousel && (
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>{carouselIndex + 1}/{mediaUrls.length}</Text>
            </View>
          )}

          {/* Video indicator */}
          {!isCarousel && isVideoPath(mediaUrls[0]) && (
            <View style={styles.videoIndicator}>
              <Ionicons name="videocam" size={14} color="#FFF" />
            </View>
          )}
          
          {/* Double-tap heart animation */}
          <Animated.View style={[styles.heartOverlay, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]} pointerEvents="none">
            <Ionicons name="heart" size={80} color="#FF6978" />
          </Animated.View>
        </TouchableOpacity>
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
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={22} color={isSaved ? '#FFF' : '#FFF'} />
        </TouchableOpacity>
      </View>

      {/* Likes with profile thumbs */}
      <View style={styles.footer}>
        {likesCount > 0 && (
          <View style={styles.likesRow}>
            {recentLikers.length > 0 && (
              <View style={styles.likerThumbs}>
                {recentLikers.slice(0, 4).map((liker, idx) => (
                  <View key={liker.id} style={[styles.likerThumb, { marginLeft: idx > 0 ? -8 : 0, zIndex: 10 - idx }]}>
                    {liker.profile_image ? (
                      <Image source={{ uri: getMediaUrl(liker.profile_image) || '' }} style={styles.likerImg} />
                    ) : (
                      <View style={[styles.likerImg, styles.likerImgPlaceholder]}>
                        <Ionicons name="person" size={10} color="#999" />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.likes}>
              {recentLikers.length > 0 && likesCount > recentLikers.length
                ? `Piace a ${recentLikers[0]?.username} e altri ${likesCount - 1}`
                : `${likesCount} like${likesCount !== 1 ? '' : ''}`
              }
            </Text>
          </View>
        )}
        {post.caption ? (
          <Text style={styles.caption}>
            <Text style={styles.captionUsername}>{post.user?.username} </Text>
            {post.caption}
          </Text>
        ) : null}
        {post.comments_count > 0 && (
          <TouchableOpacity onPress={() => onCommentPress?.(post.id)}>
            <Text style={styles.viewComments}>
              Vedi tutti i {post.comments_count} commenti
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#0a0a1a', marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  avatarContainer: { marginRight: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarPlaceholder: { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1 },
  username: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  date: { color: '#888', fontSize: 11, marginTop: 1 },
  mediaContainer: { width: '100%', position: 'relative', overflow: 'hidden' },
  media: { width: '100%', height: '100%' },
  videoIndicator: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 4 },
  dotsContainer: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#FFF', width: 8, height: 8, borderRadius: 4 },
  counterBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  counterText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  heartOverlay: { position: 'absolute', top: '50%', left: '50%', marginTop: -40, marginLeft: -40 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  leftActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { marginRight: 16 },
  footer: { paddingHorizontal: 12, marginBottom: 8 },
  likesRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  likerThumbs: { flexDirection: 'row', marginRight: 8 },
  likerThumb: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#0a0a1a', overflow: 'hidden' },
  likerImg: { width: '100%', height: '100%', borderRadius: 11 },
  likerImgPlaceholder: { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  likes: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  caption: { color: '#FFF', fontSize: 13, lineHeight: 18 },
  captionUsername: { fontWeight: '600' },
  viewComments: { color: '#888', fontSize: 13, marginTop: 4 },
});
