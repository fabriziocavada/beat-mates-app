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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '../../src/constants/colors';
import Header from '../../src/components/Header';
import TabBar from '../../src/components/TabBar';
import AvailableTeacherCard from '../../src/components/AvailableTeacherCard';
import ReviewsPopup from '../../src/components/ReviewsPopup';
import GroupLessonCard from '../../src/components/GroupLessonCard';
import PaymentModal from '../../src/components/PaymentModal';
import RecordedLessonCard from '../../src/components/RecordedLessonCard';
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

type SubTab = 'live' | 'lessons' | 'recorded';

// Category filters for recorded lessons
const DANCE_CATEGORIES = [
  { id: 'all', name: 'Tutte' },
  { id: 'latino_americani', name: 'Latino Americani' },
  { id: 'ballroom', name: 'Ballroom' },
  { id: 'caraibiche', name: 'Caraibiche' },
];

interface CategoryData {
  id: string;
  name: string;
  subcategories: {
    id: string;
    name: string;
    lessons: any[];
  }[];
}

export default function AvailableScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [subTab, setSubTab] = useState<SubTab>('live');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [groupLessons, setGroupLessons] = useState<GroupLesson[]>([]);
  const [recordedCategories, setRecordedCategories] = useState<CategoryData[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reviewsPopup, setReviewsPopup] = useState<{ visible: boolean; userId: string; username: string }>({ visible: false, userId: '', username: '' });
  const [paymentModal, setPaymentModal] = useState<{
    visible: boolean;
    lesson: GroupLesson | null;
  }>({ visible: false, lesson: null });

  useEffect(() => {
    loadData();
  }, [subTab]);

  // Auto-poll group lessons every 10s so student sees "Entra" button quickly
  useEffect(() => {
    if (subTab !== 'lessons') return;
    const interval = setInterval(async () => {
      try {
        const response = await api.get('/group-lessons');
        setGroupLessons(response.data);
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [subTab]);

  const loadData = async () => {
    try {
      if (subTab === 'live') {
        const response = await api.get('/available-teachers');
        setTeachers(response.data);
      } else if (subTab === 'lessons') {
        const response = await api.get('/group-lessons');
        setGroupLessons(response.data);
      } else if (subTab === 'recorded') {
        const response = await api.get('/video-lessons/by-category');
        setRecordedCategories(response.data);
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

  const handleBookGroupLesson = async (lesson: GroupLesson) => {
    // Show payment modal instead of directly booking
    setPaymentModal({ visible: true, lesson });
  };

  const handlePaymentConfirm = async () => {
    const lesson = paymentModal.lesson;
    if (!lesson) return;
    setPaymentModal({ visible: false, lesson: null });
    try {
      await api.post(`/group-lessons/${lesson.id}/book`);
      // If lesson is already live, join the video call directly
      if (lesson.status === 'live') {
        try {
          await api.post(`/group-lessons/${lesson.id}/join`);
          router.push(`/(main)/group-video-call/${lesson.id}`);
        } catch {
          loadData(); // fallback: refresh list
        }
      } else {
        loadData();
      }
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
      await api.post(`/group-lessons/${lessonId}/start`);
      router.push(`/(main)/group-video-call/${lessonId}`);
    } catch (error: any) {
      Alert.alert('Errore', error?.response?.data?.detail || 'Avvio fallito');
    }
  };

  const handleJoinGroupLesson = async (lessonId: string) => {
    try {
      await api.post(`/group-lessons/${lessonId}/join`);
      router.push(`/(main)/group-video-call/${lessonId}`);
    } catch (error: any) {
      Alert.alert('Errore', error?.response?.data?.detail || 'Impossibile entrare');
    }
  };

  const renderGroupLesson = ({ item }: { item: GroupLesson }) => (
    <GroupLessonCard
      lesson={item}
      currentUserId={user?.id || ''}
      onBook={() => handleBookGroupLesson(item)}
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
      ) : subTab === 'lessons' ? (
        <>
          <Text style={styles.emptyTitle}>Nessuna lezione in programma</Text>
          <Text style={styles.emptyText}>Non ci sono lezioni di gruppo previste.{'\n'}Gli insegnanti possono crearne dal proprio profilo.</Text>
        </>
      ) : (
        <>
          <Text style={styles.emptyTitle}>Nessuna lezione registrata</Text>
          <Text style={styles.emptyText}>Non ci sono ancora lezioni registrate.{'\n'}Gli insegnanti possono caricarle dal proprio profilo.</Text>
        </>
      )}
    </View>
  );

  // Render Netflix-style carousel for a subcategory
  const renderSubcategoryCarousel = (subcategory: { id: string; name: string; lessons: any[] }) => (
    <View key={subcategory.id} style={styles.carouselSection}>
      <Text style={styles.carouselTitle}>{subcategory.name}</Text>
      <FlatList
        horizontal
        data={subcategory.lessons}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <RecordedLessonCard
            lesson={item}
            onPress={() => router.push(`/(main)/lesson-player/${item.id}`)}
            onInfoPress={() => Alert.alert(item.title, item.description || 'Nessuna descrizione')}
            onUserPress={() => router.push(`/(main)/user/${item.user?.id}`)}
          />
        )}
      />
    </View>
  );

  // Render Netflix-style recorded lessons
  const renderRecordedContent = () => {
    // Filter categories based on selected filter
    const filteredCategories = selectedFilter === 'all' 
      ? recordedCategories 
      : recordedCategories.filter(c => c.id === selectedFilter);

    return (
      <ScrollView 
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Category filter chips */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filterContainer}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {DANCE_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.filterChip, selectedFilter === cat.id && styles.filterChipActive]}
              onPress={() => setSelectedFilter(cat.id)}
            >
              <Text style={[styles.filterChipText, selectedFilter === cat.id && styles.filterChipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Netflix-style carousels */}
        {filteredCategories.length === 0 ? (
          renderEmpty()
        ) : (
          filteredCategories.map((category) => (
            <View key={category.id} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category.name}</Text>
              {category.subcategories.map(renderSubcategoryCarousel)}
            </View>
          ))
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        onSearchPress={() => console.log('Search')}
        onNotificationsPress={() => console.log('Notifications')}
        onMessagesPress={() => console.log('Messages')}
      />

      {/* Sub-tabs: Live Ora / Lezioni / Registrate */}
      <View style={styles.subTabs}>
        <TouchableOpacity
          style={[styles.subTab, subTab === 'live' && styles.subTabActive]}
          onPress={() => { setIsLoading(true); setSubTab('live'); }}
          data-testid="tab-live"
        >
          <Text style={[styles.subTabText, subTab === 'live' && styles.subTabTextActive]}>Live</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, subTab === 'lessons' && styles.subTabActive]}
          onPress={() => { setIsLoading(true); setSubTab('lessons'); }}
          data-testid="tab-lessons"
        >
          <Text style={[styles.subTabText, subTab === 'lessons' && styles.subTabTextActive]}>Gruppo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, subTab === 'recorded' && styles.subTabActive]}
          onPress={() => { setIsLoading(true); setSubTab('recorded'); }}
          data-testid="tab-recorded"
        >
          <Text style={[styles.subTabText, subTab === 'recorded' && styles.subTabTextActive]}>Registrate</Text>
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
      ) : subTab === 'lessons' ? (
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
      ) : (
        renderRecordedContent()
      )}

      <TabBar activeTab="available" onTabPress={handleTabPress} />
      <ReviewsPopup
        visible={reviewsPopup.visible}
        onClose={() => setReviewsPopup({ visible: false, userId: '', username: '' })}
        userId={reviewsPopup.userId}
        username={reviewsPopup.username}
      />
      <PaymentModal
        visible={paymentModal.visible}
        onClose={() => setPaymentModal({ visible: false, lesson: null })}
        onConfirm={handlePaymentConfirm}
        lessonTitle={paymentModal.lesson?.title || ''}
        teacherName={paymentModal.lesson?.teacher?.name || paymentModal.lesson?.teacher?.username || 'Insegnante'}
        price={paymentModal.lesson?.price || 0}
        date={paymentModal.lesson?.scheduled_at ? new Date(paymentModal.lesson.scheduled_at).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
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
  // Netflix-style carousels
  filterContainer: {
    paddingVertical: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    color: Colors.primary,
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
  },
  carouselSection: {
    marginBottom: 20,
  },
  carouselTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
});
