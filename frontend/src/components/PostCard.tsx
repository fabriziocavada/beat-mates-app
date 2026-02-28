import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
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

function VideoPlayer({ mediaUrl, autoPlay }: { mediaUrl: string; autoPlay?: boolean }) {
  if (Platform.OS === 'web') {
    return (
      <View style={{ width: '100%', height: '100%' }}>
        {React.createElement('video', {
          src: mediaUrl,
          style: { width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' },
          autoPlay: true,
          loop: true,
          muted: true,
          playsInline: true,
        })}
      </View>
    );
  }
  return (
    <Video
      source={{ uri: mediaUrl }}
      style={{ width: '100%', height: '100%' }}
      resizeMode={ResizeMode.COVER}
      shouldPlay={autoPlay !== false}
      isLooping
      isMuted={false}
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
  
  const isVideo = post.type === 'video' || (post.media && post.media.includes('video'));
  const mediaUrl = getMediaUrl(post.media);
  const profileUrl = getMediaUrl(post.user?.profile_image);
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => onUserPress?.(post.user_id)}
      >
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            {profileUrl ? (
              <Image
                source={{ uri: profileUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <Ionicons name="person" size={20} color="#FFFFFF" />
            )}
          </View>
          <View>
            <Text style={styles.username}>{post.user?.username || 'Unknown'}</Text>
          </View>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </TouchableOpacity>
      
      {/* Media - Instagram-style responsive */}
      {mediaUrl && (
        <View style={styles.mediaContainer}>
          {isVideo ? (
            <VideoPlayer mediaUrl={mediaUrl} autoPlay />
          ) : (
            <Image
              source={{ uri: mediaUrl }}
              style={styles.media}
              resizeMode="cover"
            />
          )}
          {isVideo && (
            <View style={styles.videoIndicator}>
              <Ionicons name="videocam" size={14} color="#FFF" />
            </View>
          )}
        </View>
      )}
      
      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={26}
              color={isLiked ? '#FF4058' : '#FFFFFF'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onCommentPress?.(post.id)}
            style={styles.actionButton}
          >
            <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="paper-plane-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity>
          <Ionicons name="bookmark-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {/* Likes count */}
      {likesCount > 0 && (
        <Text style={styles.likesCount}>
          {likesCount.toLocaleString()} {likesCount === 1 ? 'like' : 'likes'}
        </Text>
      )}
      
      {/* Caption */}
      {post.caption && (
        <View style={styles.captionContainer}>
          <Text style={styles.caption}>
            <Text style={styles.captionUsername}>{post.user?.username} </Text>
            {post.caption}
          </Text>
        </View>
      )}
      
      {/* Comments */}
      {post.comments_count > 0 && (
        <TouchableOpacity onPress={() => onCommentPress?.(post.id)}>
          <Text style={styles.viewComments}>
            View all {post.comments_count} comments
          </Text>
        </TouchableOpacity>
      )}
      
      {/* Time */}
      <Text style={styles.time}>{formatDate(post.created_at)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  username: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  mediaContainer: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: '#1C1C1E',
    maxHeight: 500,
    position: 'relative',
  },
  videoIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 6,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 16,
  },
  likesCount: {
    color: '#FFFFFF',
    fontWeight: '600',
    paddingHorizontal: 12,
    marginBottom: 6,
    fontSize: 14,
  },
  captionContainer: {
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  captionUsername: {
    fontWeight: '600',
  },
  viewComments: {
    color: '#8E8E93',
    paddingHorizontal: 12,
    marginBottom: 4,
    fontSize: 14,
  },
  time: {
    color: '#636366',
    fontSize: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
});
