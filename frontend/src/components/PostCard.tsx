import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, Image, Dimensions, ScrollView, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import api, { getMediaUrl, getThumbnailUrl } from '../services/api';

const { width } = Dimensions.get('window');

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
  const lower = path.toLowerCase();
  return lower.includes('.mp4') || lower.includes('.mov') || lower.includes('.webm') || lower.includes('video');
}

// Video player using WebView - same approach as Reels (proven to work on iOS)
function FeedVideoPlayer({ url, height }: { url: string; height: number }) {
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>*{margin:0;padding:0;background:#000}video{width:100%;height:100%;object-fit:cover}</style></head><body><video src="${url}" autoplay loop muted playsinline webkit-playsinline></video></body></html>`;
  return (
    <WebView
      source={{ html }}
      style={{ width: '100%', height }}
      scrollEnabled={false}
      bounces={false}
      allowsInlineMediaPlayback={true}
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled={true}
    />
  );
}

export default function PostCard({ post, onUserPress, onCommentPress, onDeletePress, currentUserId }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
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
  const isOwner = currentUserId === post.user_id;

  const handleDoubleTap = () => {
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
    }
  };
  
  const handleLike = async () => {
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? prev - 1 : prev + 1);
    try {
      await api.post(`/posts/${post.id}/like`);
    } catch {
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

  const onCarouselScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== carouselIndex) setCarouselIndex(idx);
  };

  const renderMediaItem = (url: string, idx: number) => {
    const fullUrl = getMediaUrl(url) || '';
    const isVid = isVideoPath(url);
    return (
      <View key={idx} style={{ width, height: mediaHeight }}>
        {isVid ? (
          <FeedVideoPlayer url={fullUrl} height={mediaHeight} />
        ) : (
          <Image source={{ uri: fullUrl }} style={styles.media} resizeMode="cover" />
        )}
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeft} onPress={() => onUserPress?.(post.user_id)}>
          <View style={styles.avatarContainer}>
            {post.user?.profile_image ? (
              <Image source={{ uri: getMediaUrl(post.user.profile_image) || '' }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={16} color="#666" />
              </View>
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
        <TouchableWithoutFeedback onPress={handleDoubleTap}>
          <View style={[styles.mediaContainer, { height: mediaHeight }]}>
            {isCarousel ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onCarouselScroll}
                decelerationRate="fast"
                style={{ width }}
              >
                {mediaUrls.map((url, idx) => renderMediaItem(url, idx))}
              </ScrollView>
            ) : (
              renderMediaItem(mediaUrls[0], 0)
            )}
            
            {isCarousel && (
              <View style={styles.dotsContainer}>
                {mediaUrls.map((_, idx) => (
                  <View key={idx} style={[styles.dot, idx === carouselIndex && styles.dotActive]} />
                ))}
              </View>
            )}
            
            {isCarousel && (
              <View style={styles.counterBadge}>
                <Text style={styles.counterText}>{carouselIndex + 1}/{mediaUrls.length}</Text>
              </View>
            )}

            {/* Double-tap heart animation */}
            <Animated.View style={[styles.heartOverlay, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]} pointerEvents="none">
              <Ionicons name="heart" size={80} color="#FF6978" />
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
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
        {likesCount > 0 && (
          <Text style={styles.likes}>{likesCount} like</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarContainer: { marginRight: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarPlaceholder: { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  username: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  date: { color: '#888', fontSize: 11, marginTop: 1 },
  deleteBtn: { padding: 8 },
  mediaContainer: { width: '100%', position: 'relative', overflow: 'hidden' },
  media: { width: '100%', height: '100%' },
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
  likes: { color: '#FFF', fontWeight: '600', fontSize: 13, marginBottom: 4 },
  caption: { color: '#FFF', fontSize: 13, lineHeight: 18 },
  captionUsername: { fontWeight: '600' },
  viewComments: { color: '#888', fontSize: 13, marginTop: 4 },
});
