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
import StoriesBar from '../../src/components/StoriesBar';
import PostCard from '../../src/components/PostCard';
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

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Mock stories data
  const [stories] = useState([
    { id: '1', user_id: '1', username: 'joshua_l', profile_image: null, has_unread: true },
    { id: '2', user_id: '2', username: 'karennne', profile_image: null, has_unread: true },
    { id: '3', user_id: '3', username: 'craig_love', profile_image: null, has_unread: false },
    { id: '4', user_id: '4', username: 'amanda', profile_image: null, has_unread: true },
  ]);
  
  useEffect(() => {
    loadPosts();
  }, []);
  
  const loadPosts = async () => {
    try {
      const response = await api.get('/posts');
      setPosts(response.data);
    } catch (error) {
      console.error('Failed to load posts', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadPosts();
    setIsRefreshing(false);
  }, []);
  
  const handleTabPress = (tab: string) => {
    switch (tab) {
      case 'home':
        // Already on home
        break;
      case 'create':
        router.push('/(main)/create-post');
        break;
      case 'available':
        router.push('/(main)/available');
        break;
      case 'profile':
        router.push('/(main)/profile');
        break;
      default:
        // Other tabs not implemented yet
        break;
    }
  };
  
  const renderItem = ({ item }: { item: Post }) => (
    <PostCard
      post={item}
      onUserPress={(userId) => router.push(`/(main)/user/${userId}`)}
      onCommentPress={(postId) => console.log('Open comments', postId)}
    />
  );
  
  const renderHeader = () => (
    <StoriesBar
      stories={stories}
      onStoryPress={(userId) => console.log('Open story', userId)}
      onAddStoryPress={() => console.log('Add story')}
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
        onNotificationsPress={() => console.log('Notifications')}
        onMessagesPress={() => console.log('Messages')}
      />
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
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
              tintColor={Colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
      
      <TabBar activeTab="home" onTabPress={handleTabPress} />
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
    marginTop: 60,
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
