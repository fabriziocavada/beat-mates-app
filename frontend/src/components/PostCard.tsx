import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import api, { getMediaUrl } from '../services/api';

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
}

function NativeVideoPlayer({ url, height }: { url: string; height: number }) {
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

export default function PostCard({ post, onUserPress, onCommentPress }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  
  const handleLike = async () => {
    try {
      const response = await api.post(`/posts/${post.id}/like`);
      setIsLiked(response.data.liked);
      setLikesCount((prev) => response.data.liked ? prev + 1 : prev - 1);
    } catch (error) {
      console.error('Failed to like post', error);
    }
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };
  
  const isVideo = post.type === 'video';
  const mediaUrl = post.media ? getMediaUrl(post.media) : '';
  const mediaHeight = Math.min(width * 1.25, 500);
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity style={styles.header} onPress={() => onUserPress?.(post.user_id)}>
        <View style={styles.avatarContainer}>
          {post.user?.profile_image ? (
            <Image source={{ uri: getMediaUrl(post.user.profile_image) }} style={styles.avatar} />
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

      {/* Media */}
      {mediaUrl ? (
        <View style={[styles.mediaContainer, { height: mediaHeight }]}>
          {isVideo ? (
            <NativeVideoPlayer url={mediaUrl} height={mediaHeight} />
          ) : (
            <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="cover" />
          )}
          {isVideo && (
            <View style={styles.videoIndicator}>
              <Ionicons name="videocam" size={14} color="#FFF" />
            </View>
          )}
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <TouchableOpacity onPress={handleLike} style={styles.actionBtn}>
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={24} color={isLiked ? '#FF6978' : '#FFF'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onCommentPress?.(post.id)} style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="paper-plane-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity>
          <Ionicons name="bookmark-outline" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Likes & Caption */}
      <View style={styles.footer}>
        {likesCount > 0 && (
          <Text style={styles.likes}>{likesCount} like{likesCount !== 1 ? 's' : ''}</Text>
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
              View all {post.comments_count} comment{post.comments_count !== 1 ? 's' : ''}
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
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  leftActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { marginRight: 16 },
  footer: { paddingHorizontal: 12, marginBottom: 8 },
  likes: { color: '#FFF', fontWeight: '600', fontSize: 13, marginBottom: 4 },
  caption: { color: '#FFF', fontSize: 13, lineHeight: 18 },
  captionUsername: { fontWeight: '600' },
  viewComments: { color: '#888', fontSize: 13, marginTop: 4 },
});
