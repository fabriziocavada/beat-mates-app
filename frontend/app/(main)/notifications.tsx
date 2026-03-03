import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../src/constants/colors';
import api, { getMediaUrl } from '../../src/services/api';

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => { loadNotifs(); }, []);
  const loadNotifs = async () => {
    try {
      // Get lesson sessions as notifications
      const res = await api.get('/live-sessions/pending/count');
      const count = res.data.count || 0;
      const notifs: any[] = [];
      if (count > 0) notifs.push({ type: 'lesson', text: `Hai ${count} richiesta/e di lezione in attesa`, icon: 'videocam' });
      // Get recent likes on my posts
      const postsRes = await api.get('/posts');
      postsRes.data.filter((p: any) => p.likes_count > 0).slice(0, 10).forEach((p: any) => {
        notifs.push({ type: 'like', text: `${p.likes_count} like sul tuo post "${p.caption?.substring(0, 30) || 'senza titolo'}"`, icon: 'heart' });
      });
      setNotifications(notifs);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color="#FFF" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Notifiche</Text>
        <View style={{ width: 28 }} />
      </View>
      {notifications.length === 0 ? (
        <View style={styles.empty}><Ionicons name="notifications-outline" size={48} color="#444" /><Text style={styles.emptyText}>Nessuna notifica</Text></View>
      ) : (
        <FlatList data={notifications} keyExtractor={(_, i) => String(i)} renderItem={({ item }) => (
          <TouchableOpacity style={styles.notifRow} onPress={() => { if (item.type === 'lesson') router.push('/(main)/lesson-requests'); }}>
            <View style={[styles.notifIcon, item.type === 'lesson' && { backgroundColor: Colors.primary }]}>
              <Ionicons name={item.icon} size={20} color="#FFF" />
            </View>
            <Text style={styles.notifText}>{item.text}</Text>
          </TouchableOpacity>
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
  notifRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  notifIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  notifText: { color: '#FFF', fontSize: 14, flex: 1 },
});
