import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../src/constants/colors';
import api from '../../src/services/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ora';
  if (mins < 60) return `${mins}m fa`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h fa`;
  const days = Math.floor(hrs / 24);
  return `${days}g fa`;
}

function getIcon(type: string): { name: string; color: string } {
  switch (type) {
    case 'group_lesson_started': return { name: 'videocam', color: '#28A745' };
    case 'booking_confirmed': return { name: 'checkmark-circle', color: Colors.primary };
    case 'lesson_request': return { name: 'school', color: Colors.primary };
    case 'like': return { name: 'heart', color: '#FF6978' };
    case 'chat_message': return { name: 'chatbubble', color: '#5856D6' };
    case 'lesson_booked': return { name: 'calendar', color: '#FF9500' };
    case 'story_reaction': return { name: 'happy', color: '#FFD60A' };
    default: return { name: 'notifications', color: '#888' };
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch {
      // Fallback to old pending sessions endpoint
      try {
        const sessionsRes = await api.get('/sessions/pending');
        const notifs = sessionsRes.data.map((s: any) => ({
          id: s.id,
          type: 'lesson_request',
          title: 'Richiesta lezione',
          message: `Richiesta di lezione da ${s.student_username || 'uno studente'}`,
          read: false,
          created_at: s.created_at,
        }));
        setNotifications(notifs);
      } catch {
        setNotifications([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadNotifications();
    setIsRefreshing(false);
  }, []);

  const handleNotifPress = async (notif: Notification) => {
    // Mark as read
    if (!notif.read) {
      try { await api.post(`/notifications/${notif.id}/read`); } catch {}
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    }
    // Navigate based on type
    if (notif.type === 'group_lesson_started' && notif.data?.lesson_id) {
      router.push(`/(main)/group-video-call/${notif.data.lesson_id}`);
    }
  };

  const renderNotif = ({ item }: { item: Notification }) => {
    const icon = getIcon(item.type);
    return (
      <TouchableOpacity
        style={[styles.notifRow, !item.read && styles.notifUnread]}
        onPress={() => handleNotifPress(item)}
        data-testid={`notification-${item.id}`}
      >
        <View style={[styles.notifIcon, { backgroundColor: `${icon.color}20` }]}>
          <Ionicons name={icon.name as any} size={20} color={icon.color} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
          </View>
          <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} data-testid="notifications-back-btn">
            <Ionicons name="chevron-back" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifiche</Text>
          <View style={{ width: 26 }} />
        </View>

        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nessuna notifica</Text>
            <Text style={styles.emptySubtext}>Le notifiche appariranno qui</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={renderNotif}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E',
  },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: '#888', fontSize: 13 },
  notifRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E',
    gap: 12,
  },
  notifUnread: {
    backgroundColor: 'rgba(255,105,120,0.05)',
  },
  notifIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  notifContent: { flex: 1 },
  notifHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3,
  },
  notifTitle: { color: '#CCC', fontSize: 14, fontWeight: '500', flex: 1, marginRight: 8 },
  notifTitleUnread: { color: '#FFF', fontWeight: '700' },
  notifTime: { color: '#666', fontSize: 11 },
  notifMessage: { color: '#888', fontSize: 13, lineHeight: 18 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.primary,
  },
});
