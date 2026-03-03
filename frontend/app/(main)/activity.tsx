import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../src/constants/colors';
import api, { getMediaUrl } from '../../src/services/api';

interface Activity { type: string; text: string; time: string; avatar?: string; }

export default function ActivityScreen() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => { loadActivity(); }, []);
  const loadActivity = async () => {
    try {
      const res = await api.get('/posts');
      const likes = res.data.filter((p: any) => p.likes_count > 0).map((p: any) => ({
        type: 'like', text: `Il tuo post ha ricevuto ${p.likes_count} like`, time: new Date(p.created_at).toLocaleDateString('it-IT'), avatar: p.user?.profile_image,
      }));
      const comments = res.data.filter((p: any) => p.comments_count > 0).map((p: any) => ({
        type: 'comment', text: `${p.comments_count} commenti sul tuo post`, time: new Date(p.created_at).toLocaleDateString('it-IT'), avatar: p.user?.profile_image,
      }));
      setActivities([...likes, ...comments]);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color="#FFF" /></TouchableOpacity>
        <Text style={styles.headerTitle}>La tua attivita</Text>
        <View style={{ width: 28 }} />
      </View>
      {activities.length === 0 ? (
        <View style={styles.empty}><Ionicons name="time-outline" size={48} color="#444" /><Text style={styles.emptyText}>Nessuna attivita recente</Text></View>
      ) : (
        <FlatList data={activities} keyExtractor={(_, i) => String(i)} renderItem={({ item }) => (
          <View style={styles.actRow}>
            <View style={styles.actIcon}>
              {item.avatar ? <Image source={{ uri: getMediaUrl(item.avatar) || '' }} style={styles.actAvatar} /> : <Ionicons name={item.type === 'like' ? 'heart' : 'chatbubble'} size={18} color={Colors.primary} />}
            </View>
            <View style={{ flex: 1 }}><Text style={styles.actText}>{item.text}</Text><Text style={styles.actTime}>{item.time}</Text></View>
          </View>
        )} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 100 },
  emptyText: { color: '#888', fontSize: 16, marginTop: 16 },
  actRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  actIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' },
  actAvatar: { width: '100%', height: '100%' },
  actText: { color: '#FFF', fontSize: 14 },
  actTime: { color: '#888', fontSize: 12, marginTop: 2 },
});
