import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../src/constants/colors';
import api, { getMediaUrl } from '../../../src/services/api';
import { useAuthStore } from '../../../src/store/authStore';

interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at: string;
  user?: {
    id: string;
    username: string;
    name: string;
    profile_image: string | null;
  };
}

export default function CommentsScreen() {
  const router = useRouter();
  const { id: postId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const inputRef = useRef<TextInput>(null);
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    loadComments();
  }, [postId]);

  const loadComments = async () => {
    try {
      const response = await api.get(`/posts/${postId}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Failed to load comments', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    
    setIsSending(true);
    try {
      const response = await api.post(`/posts/${postId}/comments`, {
        text: newComment.trim(),
      });
      // Map backend field 'text' to our UI field 'content'
      const comment = response.data;
      comment.content = comment.text || comment.content;
      setComments(prev => [comment, ...prev]);
      setNewComment('');
    } catch (error) {
      console.error('Failed to post comment', error);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'ora';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}g`;
  };

  const renderComment = ({ item }: { item: Comment }) => {
    const commentText = (item as any).text || item.content;
    return (
      <View style={styles.commentItem}>
        <TouchableOpacity
          onPress={() => router.push(`/(main)/user/${item.user_id}`)}
        >
          <View style={styles.commentAvatar}>
            {item.user?.profile_image ? (
              <Image source={{ uri: getMediaUrl(item.user.profile_image) || '' }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={16} color={Colors.textSecondary} />
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.commentContent}>
          <Text style={styles.commentText}>
            <Text style={styles.commentUsername}>{item.user?.username || 'utente'} </Text>
            {commentText}
          </Text>
          <View style={styles.commentMeta}>
            <Text style={styles.commentTime}>{formatTime(item.created_at)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commenti</Text>
        <View style={{ width: 28 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
          keyboardVerticalOffset={90}
        >
          {comments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>Nessun commento ancora</Text>
              <Text style={styles.emptyHint}>Sii il primo a commentare!</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              renderItem={renderComment}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.commentsList}
              inverted={false}
            />
          )}

          {/* Input area */}
          <View style={styles.inputContainer}>
            <View style={styles.inputAvatar}>
              {user?.profile_image ? (
                <Image source={{ uri: getMediaUrl(user.profile_image) || '' }} style={styles.inputAvatarImage} />
              ) : (
                <Ionicons name="person" size={16} color={Colors.textSecondary} />
              )}
            </View>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Aggiungi un commento..."
              placeholderTextColor={Colors.textSecondary}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              onPress={handleSendComment}
              disabled={!newComment.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={[
                  styles.sendButton,
                  !newComment.trim() && styles.sendButtonDisabled,
                ]}>
                  Invia
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  commentsList: {
    padding: 16,
    gap: 16,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  commentContent: {
    flex: 1,
  },
  commentText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  commentUsername: {
    fontWeight: 'bold',
  },
  commentMeta: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  commentTime: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    gap: 10,
    backgroundColor: Colors.background,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inputAvatarImage: {
    width: '100%',
    height: '100%',
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    maxHeight: 80,
    paddingVertical: 8,
  },
  sendButton: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
