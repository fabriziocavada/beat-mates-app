import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '../../src/constants/colors';
import Header from '../../src/components/Header';
import TabBar from '../../src/components/TabBar';
import AvailableTeacherCard from '../../src/components/AvailableTeacherCard';
import api from '../../src/services/api';

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

export default function AvailableScreen() {
  const router = useRouter();
  
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  useEffect(() => {
    loadTeachers();
  }, []);
  
  const loadTeachers = async () => {
    try {
      const response = await api.get('/available-teachers');
      setTeachers(response.data);
    } catch (error) {
      console.error('Failed to load teachers', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadTeachers();
    setIsRefreshing(false);
  }, []);
  
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
  
  const renderItem = ({ item }: { item: Teacher }) => (
    <AvailableTeacherCard
      teacher={item}
      onPress={() => handleTeacherPress(item)}
      onBookPress={() => handleBookPress(item)}
    />
  );
  
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No Teachers Available</Text>
      <Text style={styles.emptyText}>
        No dancers are available for live lessons right now.\nCheck back later or book a future lesson.
      </Text>
    </View>
  );
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        onSearchPress={() => console.log('Search')}
        onNotificationsPress={() => console.log('Notifications')}
        onMessagesPress={() => console.log('Messages')}
      />
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={teachers}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
      
      <TabBar activeTab="available" onTabPress={handleTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
