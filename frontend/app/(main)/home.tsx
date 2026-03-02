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
import { useRouter, usePathname } from 'expo-router';
import Header from '../../src/components/Header';
import TabBar from '../../src/components/TabBar';
import StoriesBar from '../../src/components/StoriesBar';
import PostCard from '../../src/components/PostCard';
import LessonNotificationBanner from '../../src/components/LessonNotificationBanner';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

interface Post {
  id: string;
  user_id: string;
  user?: {
    id: string;
    username: string;
    name: string;
    profile_image: string | null;
  };
  type: string;
  media: string | null;
  caption: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  created_at: string;
}

interface StoryUser {
  user_id: string;
  username: string;
  profile_image: string | null;
  has_unread: boolean;
  stories: any[];
}

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<StoryUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pathname = usePathname();
  
  // Refresh when screen comes into focus
  useEffect(() => {
    if (pathname === '/home' || pathname === '/(main)/home') {
      loadData();
    }
  }, [pathname]);
  
  const loadData = async () => {
    try {
      const [postsRes, storiesRes] = await Promise.all([
        api.get('/posts'),
        api.get('/stories'),
      ]);
      setPosts(postsRes.data);
      setStories(storiesRes.data);
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
  }, []);
  
  const handleTabPress = (tab: string) => {
    switch (tab) {
      case 'home':
        break;
      case 'create':
        router.push('/(main)/create-post');
        break;
      case 'available':
        router.push('/(main)/available');
        break;
      case 'reels':
        router.push('/(main)/reels');
        break;
      case 'music':
        break;
      case 'profile':
        router.push('/(main)/profile');
        break;
    }
  };
  
  const renderItem = ({ item }: { item: Post }) => (
    <PostCard
      post={item}
      onUserPress={(userId) => router.push(`/(main)/user/${userId}`)}
      onCommentPress={(postId) => router.push(`/(main)/comments/${postId}`)}
    />
  );
  
  const renderHeader = () => (
    <StoriesBar
      stories={stories}
      onStoryPress={(userId) => {
        router.push(`/(main)/story/${userId}`);
      }}
      onAddStoryPress={() => router.push('/(main)/create-story')}
    />
  );
  
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>Welcome to Beat Mates!</Text>
      <Text style={styles.emptyText}>
        Follow dancers or create your first post to see content here.
      </Text>
    </View>
  );
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        onSearchPress={() => console.log('Search')}
        onNotificationsPress={() => router.push('/(main)/lesson-requests')}
        onMessagesPress={() => console.log('Messages')}
      />
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6978" />
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#FF6978"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
      
      <LessonNotificationBanner />
      <TabBar activeTab="home" onTabPress={handleTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
    marginTop: 60,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
