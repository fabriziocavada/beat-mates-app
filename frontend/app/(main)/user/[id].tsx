import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../src/constants/colors';
import TabBar from '../../../src/components/TabBar';
import api, { getMediaUrl } from '../../../src/services/api';
import { useAuthStore } from '../../../src/store/authStore';

const { width } = Dimensions.get('window');
const POST_SIZE = (width - 4) / 3;

interface UserProfile {
  id: string;
  username: string;
  name: string;
  bio: string;
  profile_image: string | null;
  dance_categories: string[];
  is_available: boolean;
  hourly_rate: number;
  rating: number;
  followers_count: number;
  following_count: number;
  posts_count: number;
}

interface Post {
  id: string;
  type: string;
  media: string | null;
}

interface VideoLesson {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  duration_minutes: number;
  video_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUser = useAuthStore((state) => state.user);
  
  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [videoLessons, setVideoLessons] = useState<VideoLesson[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'shop'>('posts');
  
  useEffect(() => {
    if (id) {
      loadUser();
      loadPosts();
      loadVideoLessons();
      checkFollowing();
    }
  }, [id]);
  
  const loadUser = async () => {
    try {
      const response = await api.get(`/users/${id}`);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to load user', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadPosts = async () => {
    try {
      const response = await api.get(`/users/${id}/posts`);
      setPosts(response.data);
    } catch (error) {
      console.error('Failed to load posts', error);
    }
  };
  
  const loadVideoLessons = async () => {
    try {
      const response = await api.get(`/users/${id}/video-lessons`);
      setVideoLessons(response.data);
    } catch (error) {
      console.error('Failed to load video lessons', error);
    }
  };
  
  const checkFollowing = async () => {
    try {
      const response = await api.get(`/users/${id}/is-following`);
      setIsFollowing(response.data.following);
    } catch (error) {
      console.error('Failed to check following', error);
    }
  };
  
  const handleFollow = async () => {
    try {
      const response = await api.post(`/users/${id}/follow`);
      setIsFollowing(response.data.following);
      if (user) {
        setUser({
          ...user,
          followers_count: response.data.following
            ? user.followers_count + 1
            : user.followers_count - 1,
        });
      }
    } catch (error) {
      console.error('Failed to follow/unfollow', error);
    }
  };
  
  const handleRequestLesson = () => {
    if (user?.is_available) {
      router.push(`/(main)/request-lesson/${id}`);
    } else {
      Alert.alert('Not Available', 'This teacher is not available for live lessons right now.');
    }
  };
  
  const handleTabPress = (tab: string) => {
    switch (tab) {
      case 'home':
        router.push('/(main)/home');
        break;
      case 'profile':
        router.push('/(main)/profile');
        break;
    }
  };
  
  const renderPost = ({ item }: { item: Post }) => {
    const mediaUrl = getMediaUrl(item.media);
    return (
      <TouchableOpacity style={styles.postItem}>
        {mediaUrl ? (
          <Image source={{ uri: mediaUrl }} style={styles.postImage} />
        ) : (
          <View style={styles.postPlaceholder}>
            <Ionicons name="image-outline" size={24} color={Colors.textMuted} />
          </View>
        )}
      </TouchableOpacity>
    );
  };
  
  if (isLoading || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }
  
  const isOwnProfile = currentUser?.id === user.id;
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter} />
        <TouchableOpacity>
          <Ionicons name="menu" size={28} color={Colors.text} />
        </TouchableOpacity>
      </View>
      
      <ScrollView>
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={() => router.push(`/(main)/story/${id}`)}
            data-testid="user-profile-avatar"
          >
            <View style={[
              styles.avatarBorder,
              user.is_available && styles.avatarBorderAvailable
            ]}>
              {user.profile_image ? (
                <Image source={{ uri: getMediaUrl(user.profile_image) || '' }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={50} color={Colors.textSecondary} />
                </View>
              )}
            </View>
          </TouchableOpacity>
          
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.bio}>{user.bio || 'Dance Teacher'}</Text>
          
          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user.posts_count}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user.followers_count}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user.following_count}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
          
          {!isOwnProfile && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[
                  styles.followButton,
                  isFollowing && styles.followingButton,
                ]}
                onPress={handleFollow}
              >
                <Text style={[
                  styles.followButtonText,
                  isFollowing && styles.followingButtonText,
                ]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.messageButton} onPress={async () => {
                try {
                  const res = await api.post('/conversations', { user_id: id });
                  router.push(`/(main)/chat/${res.data.id}`);
                } catch (e) { Alert.alert('Errore', 'Impossibile avviare la chat'); }
              }}>
                <Text style={styles.messageButtonText}>Messaggio</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {!isOwnProfile && user.is_available && (
            <TouchableOpacity
              style={styles.lessonButton}
              onPress={handleRequestLesson}
            >
              <Ionicons name="videocam" size={20} color={Colors.text} />
              <Text style={styles.lessonButtonText}>Request Live Lesson - €{user.hourly_rate}/h</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Story Highlights */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.highlightsContainer}
          contentContainerStyle={styles.highlightsContent}
        >
          {[1, 2, 3, 4].map((item) => (
            <TouchableOpacity key={item} style={styles.highlightItem}>
              <View style={styles.highlightCircle}>
                <Ionicons name="image-outline" size={24} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
            onPress={() => setActiveTab('posts')}
          >
            <Ionicons
              name="grid"
              size={24}
              color={activeTab === 'posts' ? Colors.text : Colors.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'shop' && styles.tabActive]}
            onPress={() => setActiveTab('shop')}
          >
            <Ionicons
              name="cart-outline"
              size={24}
              color={activeTab === 'shop' ? Colors.text : Colors.textMuted}
            />
          </TouchableOpacity>
        </View>
        
        {/* Posts Grid or Shop */}
        {activeTab === 'posts' ? (
          <FlatList
            data={posts}
            renderItem={renderPost}
            keyExtractor={(item) => item.id}
            numColumns={3}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.shopContainer}>
            {videoLessons.length === 0 ? (
              <View style={styles.emptyShop}>
                <Ionicons name="videocam-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyShopText}>Nessuna lezione in vendita</Text>
              </View>
            ) : (
              videoLessons.map((lesson) => (
                <TouchableOpacity 
                  key={lesson.id} 
                  style={styles.lessonCard}
                  onPress={() => router.push(`/(main)/lesson-player/${lesson.id}`)}
                  data-testid={`user-lesson-${lesson.id}`}
                >
                  <View style={styles.lessonThumbContainer}>
                    {lesson.thumbnail_url ? (
                      <Image source={{ uri: getMediaUrl(lesson.thumbnail_url) || '' }} style={styles.lessonThumb} />
                    ) : (
                      <View style={[styles.lessonThumb, styles.lessonThumbPlaceholder]}>
                        <Ionicons name="videocam" size={36} color="#555" />
                      </View>
                    )}
                    <View style={styles.lessonPlayOverlay}>
                      <View style={styles.lessonPlayCircle}>
                        <Ionicons name="play" size={24} color="#FFF" />
                      </View>
                    </View>
                  </View>
                  <View style={styles.lessonInfo}>
                    <Text style={styles.lessonTitle}>{lesson.title}</Text>
                    <Text style={styles.lessonDuration}>
                      {String(Math.floor(lesson.duration_minutes / 60)).padStart(2, '0')}:{String(lesson.duration_minutes % 60).padStart(2, '0')} min
                    </Text>
                    <Text style={styles.lessonPrice}>{lesson.price.toFixed(2)} {lesson.currency}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
      
      <TabBar activeTab="" onTabPress={handleTabPress} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerCenter: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatarBorder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.primary,
    padding: 3,
  },
  avatarBorderAvailable: {
    borderColor: Colors.success,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bio: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginBottom: 16,
  },
  stats: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    marginHorizontal: 20,
  },
  statNumber: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginBottom: 12,
  },
  followButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: Colors.surface,
    borderColor: Colors.surface,
  },
  followButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  followingButtonText: {
    color: Colors.text,
  },
  messageButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  messageButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  lessonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
    gap: 8,
  },
  lessonButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  highlightsContainer: {
    marginBottom: 8,
  },
  highlightsContent: {
    paddingHorizontal: 12,
  },
  highlightItem: {
    marginHorizontal: 4,
  },
  highlightCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: Colors.highlightBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabActive: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.text,
  },
  postItem: {
    width: POST_SIZE,
    height: POST_SIZE,
    margin: 1,
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  postPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopContainer: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  emptyShop: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyShopText: {
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  lessonCard: {
    marginBottom: 16,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0A0A0A',
  },
  lessonThumbContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  lessonThumb: {
    width: '100%',
    height: '100%',
  },
  lessonThumbPlaceholder: {
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  lessonPlayCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  lessonInfo: {
    padding: 12,
  },
  lessonTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  lessonDuration: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  lessonPrice: {
    color: '#4CD964',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
});
