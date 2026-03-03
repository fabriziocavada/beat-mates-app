import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../src/constants/colors';
import api, { getMediaUrl } from '../../../src/services/api';
import { useAuthStore } from '../../../src/store/authStore';

interface Message {
  id: string;
  sender_id: string;
  text: string;
  created_at: string;
  sender?: { id: string; username: string; profile_image: string | null };
}

export default function ChatScreen() {
  const router = useRouter();
  const { id: convoId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [otherUser, setOtherUser] = useState<string>('');
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadMessages();
    // Poll for new messages every 3 seconds
    pollRef.current = setInterval(loadMessages, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [convoId]);

  const loadMessages = async () => {
    try {
      const res = await api.get(`/conversations/${convoId}/messages`);
      setMessages(res.data);
      // Get other user name from first message that isn't ours
      const other = res.data.find((m: Message) => m.sender_id !== user?.id);
      if (other?.sender) setOtherUser(other.sender.username);
    } catch (e) { console.error('Load messages failed', e); }
    finally { setIsLoading(false); }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setIsSending(true);
    try {
      await api.post(`/conversations/${convoId}/messages`, { text: newMessage.trim() });
      setNewMessage('');
      await loadMessages();
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    } catch (e) { console.error('Send failed', e); }
    finally { setIsSending(false); }
  };

  const formatTime = (s: string) => {
    const d = new Date(s);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{otherUser || 'Chat'}</Text>
          <View style={{ width: 26 }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
          {isLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => {
                const isMe = item.sender_id === user?.id;
                return (
                  <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                    {!isMe && (
                      <View style={styles.msgAvatar}>
                        {item.sender?.profile_image ? (
                          <Image source={{ uri: getMediaUrl(item.sender.profile_image) || '' }} style={styles.avatarImg} />
                        ) : (
                          <Ionicons name="person" size={12} color="#666" />
                        )}
                      </View>
                    )}
                    <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                      <Text style={[styles.msgText, isMe && { color: '#FFF' }]}>{item.text}</Text>
                      <Text style={styles.msgTime}>{formatTime(item.created_at)}</Text>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingTop: 60 }}>
                  <Text style={{ color: '#888' }}>Inizia la conversazione!</Text>
                </View>
              }
            />
          )}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Scrivi un messaggio..."
              placeholderTextColor="#666"
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
            />
            <TouchableOpacity onPress={sendMessage} disabled={!newMessage.trim() || isSending} style={styles.sendBtn}>
              {isSending ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Ionicons name="send" size={22} color={newMessage.trim() ? Colors.primary : '#666'} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  messagesList: { paddingHorizontal: 12, paddingVertical: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8, gap: 6 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  msgBubble: { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  msgBubbleMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  msgBubbleOther: { backgroundColor: '#1C1C1E', borderBottomLeftRadius: 4 },
  msgText: { color: '#FFF', fontSize: 14, lineHeight: 20 },
  msgTime: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 4, textAlign: 'right' },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: '#1C1C1E', gap: 8 },
  input: { flex: 1, color: '#FFF', fontSize: 14, maxHeight: 80, backgroundColor: '#1C1C1E', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendBtn: { padding: 6 },
});
