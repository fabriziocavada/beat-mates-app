import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '../../src/constants/colors';
import Header from '../../src/components/Header';
import TabBar from '../../src/components/TabBar';
import AvailableTeacherCard from '../../src/components/AvailableTeacherCard';
import ReviewsPopup from '../../src/components/ReviewsPopup';
import GroupLessonCard from '../../src/components/GroupLessonCard';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

interface Teacher {
  id: string;
  username: string;
  name: string;
  profile_image: string | null;
  rating: number;
  review_count?: number;
  hourly_rate: number;
  dance_categories: string[];
  is_available?: boolean;
  is_busy?: boolean;
  remaining_minutes?: number;
}

interface GroupLesson {
  id: string;
  teacher_id: string;
  teacher?: any;
  title: string;
  description: string;
  dance_category: string;
  scheduled_at: string;
  duration_minutes: number;
  max_participants: number;
  price: number;
  booked_count: number;
  booked_users: string[];
  status: string;
}

type SubTab = 'live' | 'lessons';

export default function AvailableScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [subTab, setSubTab] = useState<SubTab>('live');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [groupLessons, setGroupLessons] = useState<GroupLesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reviewsPopup, setReviewsPopup] = useState<{ visible: boolean; userId: string; username: string }>({ visible: false, userId: '', username: '' });

  useEffect(() => {
    loadData();
  }, [subTab]);

  const loadData = async () => {
    try {
      if (subTab === 'live') {
        const response = await api.get('/available-teachers');
        setTeachers(response.data);
      } else {
        const response = await api.get('/group-lessons');
        setGroupLessons(response.data);
      }
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [subTab]);

  const handleTabPress = (tab: string) => {
    switch (tab) {
      case 'home': router.push('/(main)/home'); break;
      case 'create': router.push('/(main)/create-post'); break;
      case 'available': break;
      case 'reels': router.push('/(main)/reels'); break;
      case 'music': router.push('/(main)/music'); break;
      case 'profile': router.push('/(main)/profile'); break;
    }
  };

  const handleTeacherPress = (teacher: Teacher) => {
    router.push(`/(main)/user/${teacher.id}`);
  };

  const handleBookPress = (teacher: Teacher) => {
    router.push(`/(main)/book/${teacher.id}`);
  };

  const handleBookGroupLesson = async (lessonId: string) => {
    try {
      await api.post(`/group-lessons/${lessonId}/book`);
      loadData();
    } catch (error: any) {
      Alert.alert('Errore', error?.response?.data?.detail || 'Prenotazione fallita');
    }
  };

  const handleCancelGroupBooking = async (lessonId: string) => {
    try {
      await api.delete(`/group-lessons/${lessonId}/book`);
      loadData();
    } catch (error: any) {
      Alert.alert('Errore', error?.response?.data?.detail || 'Cancellazione fallita');
    }
  };

  const renderTeacher = ({ item }: { item: Teacher }) => (
    <AvailableTeacherCard
      teacher={item}
      onPress={() => handleTeacherPress(item)}
      onBookPress={() => handleBookPress(item)}
      onInfoPress={() => setReviewsPopup({ visible: true, userId: item.id, username: item.username })}
    />
  );

  const handleStartGroupLesson = async (lessonId: string) => {
    try {
      const res = await api.post(`/group-lessons/${lessonId}/start`);
      const { room_url, room_name } = res.data;
      router.push(`/(main)/video-call/${room_name}?group=true&lessonId=${lessonId}`);
    } catch (error: any) {
      Alert.alert('Errore', error?.response?.data?.detail || 'Avvio fallito');
    }
  };

  const handleJoinGroupLesson = async (lessonId: string) => {
    try {
      const res = await api.post(`/group-lessons/${lessonId}/join`);
      const { room_url, room_name } = res.data;
      router.push(`/(main)/video-call/${room_name}?group=true&lessonId=${lessonId}`);
    } catch (error: any) {
      Alert.alert('Errore', error?.response?.data?.detail || 'Impossibile entrare');
    }
  };

  const renderGroupLesson = ({ item }: { item: GroupLesson }) => (
    <GroupLessonCard
      lesson={item}
      currentUserId={user?.id || ''}
      onBook={() => handleBookGroupLesson(item.id)}
      onCancel={() => handleCancelGroupBooking(item.id)}
      onStart={() => handleStartGroupLesson(item.id)}
      onJoin={() => handleJoinGroupLesson(item.id)}
      onPress={() => {}}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      {subTab === 'live' ? (
        <>
          <Text style={styles.emptyTitle}>Nessun insegnante online</Text>
          <Text style={styles.emptyText}>Nessun insegnante è disponibile ora.{'\n'}Riprova più tardi.</Text>
        </>
      ) : (
        <>
          <Text style={styles.emptyTitle}>Nessuna lezione in programma</Text>
          <Text style={styles.emptyText}>Non ci sono lezioni di gruppo previste.{'\n'}Gli insegnanti possono crearne dal proprio profilo.</Text>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        onSearchPress={() => console.log('Search')}
        onNotificationsPress={() => console.log('Notifications')}
        onMessagesPress={() => console.log('Messages')}
      />

      {/* Sub-tabs: Live Ora / Lezioni */}
      <View style={styles.subTabs}>
        <TouchableOpacity
          style={[styles.subTab, subTab === 'live' && styles.subTabActive]}
          onPress={() => { setIsLoading(true); setSubTab('live'); }}
          data-testid="tab-live"
        >
          <Text style={[styles.subTabText, subTab === 'live' && styles.subTabTextActive]}>Live Ora</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, subTab === 'lessons' && styles.subTabActive]}
          onPress={() => { setIsLoading(true); setSubTab('lessons'); }}
          data-testid="tab-lessons"
        >
          <Text style={[styles.subTabText, subTab === 'lessons' && styles.subTabTextActive]}>Lezioni</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : subTab === 'live' ? (
        <FlatList
          data={teachers}
          renderItem={renderTeacher}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={groupLessons}
          renderItem={renderGroupLesson}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}

      <TabBar activeTab="available" onTabPress={handleTabPress} />
      <ReviewsPopup
        visible={reviewsPopup.visible}
        onClose={() => setReviewsPopup({ visible: false, userId: '', username: '' })}
        userId={reviewsPopup.userId}
        username={reviewsPopup.username}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  subTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  subTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  subTabActive: {
    backgroundColor: Colors.primary,
  },
  subTabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  subTabTextActive: {
    color: '#FFF',
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
    padding: 40,
    marginTop: 100,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
