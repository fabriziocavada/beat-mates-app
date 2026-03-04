import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Image, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  Dimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Colors from '../../../src/constants/colors';
import api, { getMediaUrl } from '../../../src/services/api';
import { useAuthStore } from '../../../src/store/authStore';

const { width } = Dimensions.get('window');

interface Post {
  id: string; user_id: string; type: string; media: string | null;
  media_urls?: string[];
  caption: string; likes_count: number; comments_count: number;
  is_liked: boolean;
  user?: { id: string; username: string; name: string; profile_image: string | null; };
  created_at: string;
}

interface Comment {
  id: string; user_id: string; post_id: string; text: string; created_at: string;
  user?: { id: string; username: string; name: string; profile_image: string | null; };
}

function VideoPlayer({ url, h }: { url: string; h: number }) {
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>*{margin:0;padding:0;background:#000}video{width:100%;height:100%;object-fit:cover}</style></head><body><video src="${url}" autoplay loop playsinline webkit-playsinline controls></video></body></html>`;
  return <WebView source={{ html }} style={{ width: '100%', height: h }} scrollEnabled={false} bounces={false} allowsInlineMediaPlayback={true} mediaPlaybackRequiresUserAction={false} javaScriptEnabled={true} />;
}

const isVideoPath = (p: string) => {
  const l = p.toLowerCase();
  return l.includes('.mp4') || l.includes('.mov') || l.includes('video');
};

const QUICK_EMOJIS = ['❤️', '🔥', '👏', '😢', '😍', '😮', '😂'];

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const h = Math.floor((now.getTime() - d.getTime()) / 3600000);
  if (h < 1) return 'ora';
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}g`;
  return d.toLocaleDateString('it-IT');
};

export default function PostDetailScreen() {
  const { id: postId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

  useEffect(() => { loadPost(); loadComments(); }, [postId]);

  const loadPost = async () => {
    try {
      const res = await api.get(`/posts/${postId}`);
      setPost(res.data);
      setIsLiked(res.data.is_liked);
      setLikesCount(res.data.likes_count);
    } catch {} finally { setIsLoading(false); }
  };
  const loadComments = async () => {
    try { const res = await api.get(`/posts/${postId}/comments`); setComments(res.data); } catch {}
  };
  const handleLike = async () => {
    const was = isLiked;
    setIsLiked(!was); setLikesCount(p => was ? p - 1 : p + 1);
    try { await api.post(`/posts/${postId}/like`); } catch { setIsLiked(was); setLikesCount(p => was ? p + 1 : p - 1); }
  };
  const handleSave = async () => { setIsSaved(!isSaved); try { await api.post(`/posts/${postId}/save`); } catch { setIsSaved(!isSaved); } };
  const handleDelete = () => {
    Alert.alert('Elimina post', 'Sei sicuro?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => { try { await api.delete(`/posts/${postId}`); router.back(); } catch {} } },
    ]);
  };
  const handleSend = async () => {
    if (!newComment.trim() || isSending) return;
    setIsSending(true);
    try {
      await api.post(`/posts/${postId}/comments`, { text: newComment.trim() });
      setNewComment('');
      loadComments();
    } catch {} finally { setIsSending(false); }
  };
  const handleLikeComment = (commentId: string) => {
    setLikedComments(prev => {
      const s = new Set(prev);
      if (s.has(commentId)) s.delete(commentId); else s.add(commentId);
      return s;
    });
  };
  const handleQuickEmoji = (emoji: string) => {
    setNewComment(prev => prev + emoji);
  };

  if (isLoading) return <View style={styles.loader}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!post) return <View style={styles.loader}><Text style={{ color: '#FFF' }}>Post non trovato</Text></View>;

  const mediaUrls = (post.media_urls && post.media_urls.length > 0) ? post.media_urls : (post.media ? [post.media] : []);
  const isCarousel = mediaUrls.length > 1;
  const mediaHeight = Math.min(width * 1.25, 500);
  const isOwnPost = user?.id === post.user_id;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color="#FFF" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        {isOwnPost ? (
          <TouchableOpacity onPress={handleDelete}><Ionicons name="trash-outline" size={22} color="#FF6978" /></TouchableOpacity>
        ) : <View style={{ width: 28 }} />}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView style={{ flex: 1 }}>
          {/* Author */}
          <TouchableOpacity style={styles.authorRow} onPress={() => router.push(`/(main)/user/${post.user_id}`)}>
            <View style={styles.authorAvatar}>
              {post.user?.profile_image ? <Image source={{ uri: getMediaUrl(post.user.profile_image) || '' }} style={styles.avatarImg} /> : <Ionicons name="person" size={16} color="#666" />}
            </View>
            <View>
              <Text style={styles.authorName}>{post.user?.username || 'utente'}</Text>
              <Text style={styles.authorDate}>{formatDate(post.created_at)}</Text>
            </View>
          </TouchableOpacity>

          {/* Media - Carousel */}
          {mediaUrls.length > 0 && (
            <View style={{ width: '100%', height: mediaHeight, position: 'relative' }}>
              {isCarousel ? (
                <FlatList
                  data={mediaUrls}
                  horizontal pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(_, i) => `m-${i}`}
                  getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
                  onViewableItemsChanged={({ viewableItems }) => {
                    if (viewableItems[0]) setCarouselIdx(viewableItems[0].index || 0);
                  }}
                  viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                  renderItem={({ item: url }) => (
                    <View style={{ width, height: mediaHeight }}>
                      {isVideoPath(url) ? <VideoPlayer url={getMediaUrl(url) || ''} h={mediaHeight} /> : <Image source={{ uri: getMediaUrl(url) || '' }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />}
                    </View>
                  )}
                />
              ) : (
                isVideoPath(mediaUrls[0]) ? <VideoPlayer url={getMediaUrl(mediaUrls[0]) || ''} h={mediaHeight} /> : <Image source={{ uri: getMediaUrl(mediaUrls[0]) || '' }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              )}
              {isCarousel && (
                <View style={styles.dotsRow}>{mediaUrls.map((_, i) => <View key={i} style={[styles.dot, i === carouselIdx && styles.dotActive]} />)}</View>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <View style={styles.leftActions}>
              <TouchableOpacity onPress={handleLike} style={styles.actionBtn}><Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={24} color={isLiked ? '#FF6978' : '#FFF'} /></TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}><Ionicons name="chatbubble-outline" size={22} color="#FFF" /></TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}><Ionicons name="paper-plane-outline" size={22} color="#FFF" /></TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handleSave}><Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={22} color="#FFF" /></TouchableOpacity>
          </View>

          {likesCount > 0 && <Text style={styles.likesText}>{likesCount} like</Text>}
          {post.caption ? <Text style={styles.caption}><Text style={{ fontWeight: '700' }}>{post.user?.username} </Text>{post.caption}</Text> : null}

          {/* Comments section - Instagram style */}
          <View style={styles.commentsSection}>
            <View style={styles.commentsDivider} />
            <Text style={styles.commentsTitle}>Commenti</Text>
            {comments.length === 0 ? (
              <Text style={styles.noComments}>Nessun commento ancora. Scrivi il primo!</Text>
            ) : (
              comments.map(c => (
                <View key={c.id} style={styles.commentItem}>
                  <TouchableOpacity onPress={() => router.push(`/(main)/user/${c.user_id}`)} style={styles.commentAvatarWrap}>
                    {c.user?.profile_image ? <Image source={{ uri: getMediaUrl(c.user.profile_image) || '' }} style={styles.commentAvatarImg} /> : <View style={styles.commentAvatarPH}><Ionicons name="person" size={14} color="#666" /></View>}
                  </TouchableOpacity>
                  <View style={styles.commentBody}>
                    <View style={styles.commentTopRow}>
                      <Text style={styles.commentUsername}>{c.user?.username || 'utente'}</Text>
                      <Text style={styles.commentTime}>{formatDate(c.created_at)}</Text>
                    </View>
                    <Text style={styles.commentText}>{c.text}</Text>
                    <TouchableOpacity><Text style={styles.replyBtn}>Rispondi</Text></TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.commentLikeBtn} onPress={() => handleLikeComment(c.id)}>
                    <Ionicons name={likedComments.has(c.id) ? 'heart' : 'heart-outline'} size={14} color={likedComments.has(c.id) ? '#FF6978' : '#888'} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Bottom input - Instagram style */}
        <View style={styles.bottomBar}>
          {/* Quick emoji row */}
          <View style={styles.emojiRow}>
            {QUICK_EMOJIS.map((e, i) => (
              <TouchableOpacity key={i} onPress={() => handleQuickEmoji(e)} style={styles.emojiBtn}>
                <Text style={styles.emojiText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.inputRow}>
            <View style={styles.inputAvatar}>
              {user?.profile_image ? <Image source={{ uri: getMediaUrl(user.profile_image) || '' }} style={styles.avatarImg} /> : <Ionicons name="person" size={14} color="#666" />}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Cosa ne pensi?"
              placeholderTextColor="#666"
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            {newComment.trim() ? (
              <TouchableOpacity onPress={handleSend} disabled={isSending}>
                {isSending ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={styles.sendBtn}>Pubblica</Text>}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loader: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  authorRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  authorAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 10 },
  avatarImg: { width: '100%', height: '100%' },
  authorName: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  authorDate: { color: '#888', fontSize: 11, marginTop: 1 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  leftActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { marginRight: 16 },
  likesText: { color: '#FFF', fontWeight: '700', fontSize: 14, paddingHorizontal: 12, marginBottom: 4 },
  caption: { color: '#FFF', fontSize: 14, lineHeight: 20, paddingHorizontal: 12, marginBottom: 6 },
  dotsRow: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#FFF', width: 8, height: 8, borderRadius: 4 },
  // Comments
  commentsSection: { paddingTop: 8 },
  commentsDivider: { height: 0.5, backgroundColor: '#1C1C1E', marginHorizontal: 12, marginBottom: 12 },
  commentsTitle: { color: '#FFF', fontSize: 15, fontWeight: '700', paddingHorizontal: 12, marginBottom: 12 },
  noComments: { color: '#666', fontSize: 14, paddingHorizontal: 12, paddingBottom: 12 },
  commentItem: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 16, alignItems: 'flex-start' },
  commentAvatarWrap: { marginRight: 12 },
  commentAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  commentAvatarPH: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' },
  commentBody: { flex: 1 },
  commentTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  commentUsername: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  commentTime: { color: '#666', fontSize: 12 },
  commentText: { color: '#FFF', fontSize: 14, lineHeight: 19 },
  replyBtn: { color: '#666', fontSize: 12, fontWeight: '600', marginTop: 4 },
  commentLikeBtn: { paddingLeft: 12, paddingTop: 6 },
  // Bottom bar
  bottomBar: { borderTopWidth: 0.5, borderTopColor: '#1C1C1E', backgroundColor: '#000', paddingBottom: Platform.OS === 'ios' ? 20 : 8 },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, paddingHorizontal: 16 },
  emojiBtn: { padding: 4 },
  emojiText: { fontSize: 24 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 10 },
  inputAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  input: { flex: 1, color: '#FFF', fontSize: 14, maxHeight: 80, backgroundColor: '#1C1C1E', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  sendBtn: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
});
