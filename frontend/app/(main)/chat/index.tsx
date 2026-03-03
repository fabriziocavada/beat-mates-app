import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../src/constants/colors';
import TabBar from '../../../src/components/TabBar';
import api, { getMediaUrl } from '../../../src/services/api';

interface Conversation {
  id: string;
  other_user: { id: string; username: string; name: string; profile_image: string | null } | null;
  last_message: string | null;
  updated_at: string;
}

export default function ConversationsScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadConversations(); }, []);

  const loadConversations = async () => {
    try {
      const res = await api.get('/conversations');
      setConversations(res.data);
    } catch (e) { console.error('Failed to load conversations', e); }
    finally { setIsLoading(false); }
  };

  const formatTime = (s: string) => {
    const d = new Date(s);
    const now = new Date();
    const hrs = Math.floor((now.getTime() - d.getTime()) / 3600000);
    if (hrs < 1) return 'Adesso';
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}g`;
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messaggi</Text>
          <View style={{ width: 26 }} />
        </View>

        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nessuna conversazione</Text>
            <Text style={styles.emptySubtext}>Invia un messaggio dal profilo di un utente</Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.convoRow}
                onPress={() => router.push(`/(main)/chat/${item.id}`)}
                data-testid={`conversation-${item.id}`}
              >
                <View style={styles.convoAvatar}>
                  {item.other_user?.profile_image ? (
                    <Image source={{ uri: getMediaUrl(item.other_user.profile_image) || '' }} style={styles.avatarImg} />
                  ) : (
                    <Ionicons name="person" size={20} color="#666" />
                  )}
                </View>
                <View style={styles.convoInfo}>
                  <Text style={styles.convoName}>{item.other_user?.username || 'Utente'}</Text>
                  <Text style={styles.convoLastMsg} numberOfLines={1}>{item.last_message || 'Nessun messaggio'}</Text>
                </View>
                <Text style={styles.convoTime}>{formatTime(item.updated_at)}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
      <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: '#888', fontSize: 13 },
  convoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  convoAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  convoInfo: { flex: 1, marginLeft: 12 },
  convoName: { color: '#FFF', fontWeight: '600', fontSize: 15 },
  convoLastMsg: { color: '#888', fontSize: 13, marginTop: 2 },
  convoTime: { color: '#666', fontSize: 12 },
});
