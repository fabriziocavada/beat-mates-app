import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Image, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Colors from '../../../src/constants/colors';
import api, { getMediaUrl } from '../../../src/services/api';
import { useAuthStore } from '../../../src/store/authStore';

const { width } = Dimensions.get('window');

interface Liker { id: string; username: string; profile_image: string | null; }

interface Post {
  id: string; user_id: string; type: string; media: string | null;
  caption: string; likes_count: number; comments_count: number;
  is_liked: boolean; recent_likers?: Liker[];
  user?: { id: string; username: string; name: string; profile_image: string | null; };
  created_at: string;
}

interface Comment {
  id: string; user_id: string; post_id: string; text: string; created_at: string;
  user?: { id: string; username: string; name: string; profile_image: string | null; };
}

function VideoPlayer({ url, h }: { url: string; h: number }) {
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;background:#000}video{width:100%;height:100%;object-fit:cover}</style></head><body><video src="${url}" autoplay loop muted playsinline webkit-playsinline></video></body></html>`;
  return <WebView source={{ html }} style={{ width: '100%', height: h }} scrollEnabled={false} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} javaScriptEnabled />;
}

export default function PostDetailScreen() {
  const router = useRouter();
  const { id: postId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => { loadPost(); loadComments(); }, [postId]);

  const loadPost = async () => {
    try {
      const res = await api.get(`/posts/${postId}`);
      setPost(res.data);
      setIsLiked(res.data.is_liked);
      setLikesCount(res.data.likes_count);
    } catch (e) { console.error('Failed to load post', e); }
    finally { setIsLoading(false); }
  };

  const loadComments = async () => {
    try {
      const res = await api.get(`/posts/${postId}/comments`);
      setComments(res.data);
    } catch {}
  };

  const handleLike = async () => {
    try {
      const res = await api.post(`/posts/${postId}/like`);
      setIsLiked(res.data.liked);
      setLikesCount(prev => res.data.liked ? prev + 1 : prev - 1);
    } catch {}
  };

  const handleSave = async () => {
    try {
      const res = await api.post(`/posts/${postId}/save`);
      setIsSaved(res.data.saved);
    } catch {}
  };

  const handleSend = async () => {
    if (!newComment.trim()) return;
    setIsSending(true);
    try {
      const res = await api.post(`/posts/${postId}/comments`, { text: newComment.trim() });
      setComments(prev => [res.data, ...prev]);
      setNewComment('');
    } catch {} finally { setIsSending(false); }
  };

  const formatDate = (s: string) => {
    const d = new Date(s); const now = new Date();
    const hrs = Math.floor((now.getTime() - d.getTime()) / 3600000);
    if (hrs < 1) return 'Adesso';
    if (hrs < 24) return `${hrs}h fa`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}g fa`;
    return d.toLocaleDateString('it-IT');
  };

  if (isLoading || !post) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color="#FFF" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isVideo = post.type === 'video';
  const mediaUrl = post.media ? getMediaUrl(post.media) : null;
  const mediaHeight = Math.min(width * 1.25, 500);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color="#FFF" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView style={{ flex: 1 }}>
          {/* Post author */}
          <TouchableOpacity style={styles.authorRow} onPress={() => router.push(`/(main)/user/${post.user_id}`)}>
            <View style={styles.authorAvatar}>
              {post.user?.profile_image ? (
                <Image source={{ uri: getMediaUrl(post.user.profile_image) || '' }} style={styles.avatarImg} />
              ) : (
                <Ionicons name="person" size={16} color="#666" />
              )}
            </View>
            <View>
              <Text style={styles.authorName}>{post.user?.username || 'utente'}</Text>
              <Text style={styles.authorDate}>{formatDate(post.created_at)}</Text>
            </View>
          </TouchableOpacity>

          {/* Media */}
          {mediaUrl && (
            <View style={{ width: '100%', height: mediaHeight }}>
              {isVideo ? (
                <VideoPlayer url={mediaUrl} h={mediaHeight} />
              ) : (
                <Image source={{ uri: mediaUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <View style={styles.leftActions}>
              <TouchableOpacity onPress={handleLike} style={styles.actionBtn} data-testid="post-like-btn">
                <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={24} color={isLiked ? Colors.primary : '#FFF'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
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

          {/* Likes */}
          {likesCount > 0 && (
            <Text style={styles.likesText}>{likesCount} like</Text>
          )}

          {/* Caption */}
          {post.caption ? (
            <Text style={styles.caption}>
              <Text style={styles.captionUser}>{post.user?.username} </Text>
              {post.caption}
            </Text>
          ) : null}

          {/* Comments */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsTitle}>Commenti</Text>
            {comments.length === 0 ? (
              <Text style={styles.noComments}>Nessun commento ancora</Text>
            ) : (
              comments.map(c => (
                <View key={c.id} style={styles.commentRow}>
                  <View style={styles.commentAvatar}>
                    {c.user?.profile_image ? (
                      <Image source={{ uri: getMediaUrl(c.user.profile_image) || '' }} style={styles.avatarImg} />
                    ) : (
                      <Ionicons name="person" size={12} color="#666" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.commentText}>
                      <Text style={{ fontWeight: '700' }}>{c.user?.username || 'utente'} </Text>
                      {c.text}
                    </Text>
                    <Text style={styles.commentTime}>{formatDate(c.created_at)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Comment input */}
        <View style={styles.inputRow}>
          <View style={styles.inputAvatar}>
            {user?.profile_image ? (
              <Image source={{ uri: getMediaUrl(user.profile_image) || '' }} style={styles.avatarImg} />
            ) : (
              <Ionicons name="person" size={14} color="#666" />
            )}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Aggiungi un commento..."
            placeholderTextColor="#666"
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <TouchableOpacity onPress={handleSend} disabled={!newComment.trim() || isSending}>
            {isSending ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={[styles.sendBtn, !newComment.trim() && { opacity: 0.4 }]}>Invia</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  authorRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  authorAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  authorName: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  authorDate: { color: '#888', fontSize: 11, marginTop: 1 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  leftActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { marginRight: 16 },
  likesText: { color: '#FFF', fontWeight: '600', fontSize: 13, paddingHorizontal: 12, marginBottom: 4 },
  caption: { color: '#FFF', fontSize: 13, lineHeight: 18, paddingHorizontal: 12, marginBottom: 8 },
  captionUser: { fontWeight: '700' },
  commentsSection: { paddingHorizontal: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: '#1C1C1E' },
  commentsTitle: { color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  noComments: { color: '#666', fontSize: 13 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  commentAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  commentText: { color: '#FFF', fontSize: 13, lineHeight: 18 },
  commentTime: { color: '#888', fontSize: 11, marginTop: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: '#1C1C1E', gap: 10 },
  inputAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  input: { flex: 1, color: '#FFF', fontSize: 14, maxHeight: 80, paddingVertical: 6 },
  sendBtn: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
});
