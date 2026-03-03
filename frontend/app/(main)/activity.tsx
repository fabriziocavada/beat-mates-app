import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../src/constants/colors';
import api, { getMediaUrl } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

export default function ActivityScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadActivity(); }, []);

  const loadActivity = async () => {
    try {
      // Get recent comments and likes on user's posts
      const postsRes = await api.get(`/users/${user?.id}/posts`);
      const acts: any[] = [];
      for (const post of postsRes.data.slice(0, 10)) {
        if (post.likes_count > 0) {
          acts.push({ id: `like-${post.id}`, type: 'like', post, text: `${post.likes_count} like sul tuo post`, time: post.created_at });
        }
        if (post.comments_count > 0) {
          acts.push({ id: `comment-${post.id}`, type: 'comment', post, text: `${post.comments_count} commenti sul tuo post`, time: post.created_at });
        }
      }
      setActivities(acts);
    } catch (e) { console.error('Failed to load activity', e); }
    finally { setIsLoading(false); }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Attivita</Text>
          <View style={{ width: 26 }} />
        </View>

        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : activities.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="pulse-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nessuna attivita recente</Text>
          </View>
        ) : (
          <FlatList
            data={activities}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.actRow}
                onPress={() => router.push(`/(main)/post/${item.post.id}`)}
              >
                <View style={styles.actIcon}>
                  <Ionicons name={item.type === 'like' ? 'heart' : 'chatbubble'} size={18} color={Colors.primary} />
                </View>
                <Text style={styles.actText}>{item.text}</Text>
                <Ionicons name="chevron-forward" size={16} color="#666" />
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  actRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E', gap: 12 },
  actIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' },
  actText: { color: '#FFF', fontSize: 14, flex: 1 },
});
