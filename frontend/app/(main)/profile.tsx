import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Dimensions,
  RefreshControl,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Colors from '../../src/constants/colors';
import TabBar from '../../src/components/TabBar';
import LessonNotificationBanner from '../../src/components/LessonNotificationBanner';
import { useAuthStore } from '../../src/store/authStore';
import api, { uploadFile, getMediaUrl, getThumbnailUrl } from '../../src/services/api';

const { width } = Dimensions.get('window');
const POST_SIZE = (width - 4) / 3;

interface Post {
  id: string;
  type: string;
  media: string | null;
}

interface UserStory {
  id: string;
  media: string;
  type: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, toggleAvailability, refreshUser, logout } = useAuthStore();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [userStories, setUserStories] = useState<UserStory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'shop'>('posts');
  const [isUploadingPic, setIsUploadingPic] = useState(false);
  const pathname = usePathname();
  
  useEffect(() => {
    if (user?.id && (pathname === '/profile' || pathname === '/(main)/profile')) {
      loadPosts();
      loadUserStories();
      refreshUser();
    }
  }, [user?.id, pathname]);
  
  const loadPosts = async () => {
    try {
      const response = await api.get(`/users/${user?.id}/posts`);
      setPosts(response.data);
    } catch (error) {
      console.error('Failed to load posts', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserStories = async () => {
    try {
      const response = await api.get('/stories');
      const allStoryUsers = response.data;
      const myStories = allStoryUsers.find((su: any) => su.user_id === user?.id);
      setUserStories(myStories?.stories || []);
    } catch (error) {
      console.error('Failed to load stories', error);
    }
  };
  
  const handleChangeProfilePicture = async () => {
    Alert.alert('Foto Profilo', 'Come vuoi cambiarla?', [
      {
        text: 'Fotocamera',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permesso necessario'); return; }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true, aspect: [1, 1], quality: 0.5,
          });
          if (!result.canceled && result.assets[0]) {
            uploadProfilePic(result.assets[0].uri);
          }
        },
      },
      {
        text: 'Galleria',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permesso necessario'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.5,
          });
          if (!result.canceled && result.assets[0]) {
            uploadProfilePic(result.assets[0].uri);
          }
        },
      },
      { text: 'Annulla', style: 'cancel' },
    ]);
  };

  const uploadProfilePic = async (uri: string) => {
    setIsUploadingPic(true);
    try {
      const serverUrl = await uploadFile(uri);
      await api.put('/users/me', { profile_image: serverUrl });
      await refreshUser();
      Alert.alert('Fatto!', 'Immagine di profilo aggiornata');
    } catch (error) {
      Alert.alert('Errore', 'Impossibile aggiornare la foto. Riprova.');
    } finally {
      setIsUploadingPic(false);
    }
  };
  
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadPosts(), loadUserStories(), refreshUser()]);
    setIsRefreshing(false);
  }, []);
  
  const handleToggleAvailability = async () => {
    try {
      await toggleAvailability();
    } catch (error) {
      console.error('Failed to toggle availability', error);
    }
  };
  
  const handleTabPress = (tab: string) => {
    switch (tab) {
      case 'home': router.push('/(main)/home'); break;
      case 'create': router.push('/(main)/create-post'); break;
      case 'available': router.push('/(main)/available'); break;
      case 'reels': router.push('/(main)/reels'); break;
      case 'profile': break;
    }
  };
  
  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };
  
  const renderPost = ({ item }: { item: Post }) => {
    const isVideo = item.type === 'video';
    const mediaUrl = getMediaUrl(item.media);
    const thumbUrl = isVideo ? getThumbnailUrl(item.media) : mediaUrl;
    
    return (
      <TouchableOpacity 
        style={styles.postItem}
        onPress={() => {
          if (isVideo) {
            router.push('/(main)/reels');
          }
        }}
      >
        {thumbUrl ? (
          <View style={styles.videoThumb}>
            <Image source={{ uri: thumbUrl }} style={styles.postImage} />
            {isVideo && (
              <View style={styles.videoPlayOverlay}>
                <Ionicons name="play" size={24} color="#FFF" />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.postPlaceholder}>
            <Ionicons name="image-outline" size={24} color={Colors.textMuted} />
          </View>
        )}
      </TouchableOpacity>
    );
  };
  
  // Build highlights from real user stories
  const storyHighlights = userStories.map(story => {
    const isVideo = story.type === 'video';
    return {
      id: story.id,
      image: isVideo ? getThumbnailUrl(story.media) : getMediaUrl(story.media),
    };
  });
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft} />
        <View style={styles.headerCenter} />
        <TouchableOpacity style={styles.menuButton} onPress={handleLogout}>
          <Ionicons name="menu" size={28} color={Colors.text} />
        </TouchableOpacity>
      </View>
      
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handleChangeProfilePicture}>
            <View style={[
              styles.avatarBorder,
              user?.is_available && styles.avatarBorderAvailable
            ]}>
              {isUploadingPic ? (
                <View style={styles.avatarPlaceholder}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                </View>
              ) : user?.profile_image ? (
                <Image source={{ uri: getMediaUrl(user.profile_image) || '' }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={50} color={Colors.textSecondary} />
                </View>
              )}
            </View>
            {/* Camera icon overlay */}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={14} color="#FFF" />
            </View>
            {user?.is_available && (
              <View style={styles.onlineIndicator} />
            )}
          </TouchableOpacity>
          
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.bio}>{user?.bio || 'Dance Teacher'}</Text>
          
          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user?.posts_count || 0}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user?.followers_count || 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user?.following_count || 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
          
          {/* Availability Toggle */}
          <View style={styles.availabilityContainer}>
            <View style={styles.availabilityLeft}>
              <Text style={styles.availabilityLabel}>Are you available</Text>
              <Text style={styles.availabilityLabel}>to give a lesson?</Text>
            </View>
            <Switch
              value={user?.is_available || false}
              onValueChange={handleToggleAvailability}
              trackColor={{ false: Colors.surface, true: Colors.success }}
              thumbColor={Colors.text}
            />
            <TouchableOpacity
              style={styles.calendarLink}
              onPress={() => router.push('/(main)/calendar')}
            >
              <Text style={styles.calendarLinkText}>Edit your lesson</Text>
              <Text style={styles.calendarLinkText}>calendar</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Highlights */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.highlightsContainer}
          contentContainerStyle={styles.highlightsContent}
        >
          {highlights.map((highlight) => (
            <TouchableOpacity 
              key={highlight.id} 
              style={styles.highlightItem}
              activeOpacity={0.6}
              data-testid={highlight.isNew ? 'add-story-highlight-btn' : `highlight-${highlight.id}`}
              onPress={() => {
                if (highlight.isNew) {
                  router.push('/(main)/create-story');
                }
              }}
            >
              <View style={[
                styles.highlightCircle,
                highlight.isNew && styles.highlightCircleNew
              ]}>
                {highlight.isNew ? (
                  <>
                    <Ionicons name="add" size={30} color={Colors.text} />
                    <Text style={styles.highlightNewText}>NEW</Text>
                  </>
                ) : highlight.image ? (
                  <Image source={{ uri: highlight.image }} style={styles.highlightImage} />
                ) : (
                  <Ionicons name="image-outline" size={24} color={Colors.textMuted} />
                )}
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
        
        {/* Posts Grid */}
        {activeTab === 'posts' && (
          <View style={styles.postsGrid}>
            {posts.length === 0 ? (
              <View style={styles.emptyPosts}>
                <Text style={styles.emptyText}>No posts yet</Text>
                <TouchableOpacity
                  style={styles.createPostButton}
                  onPress={() => router.push('/(main)/create-post')}
                >
                  <Text style={styles.createPostButtonText}>Create your first post</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={posts}
                renderItem={renderPost}
                keyExtractor={(item) => item.id}
                numColumns={3}
                scrollEnabled={false}
              />
            )}
          </View>
        )}
        
        {activeTab === 'shop' && (
          <View style={styles.shopContainer}>
            <Text style={styles.emptyText}>No lessons for sale yet</Text>
          </View>
        )}
      </ScrollView>
      
      <LessonNotificationBanner />
      <TabBar activeTab="profile" onTabPress={handleTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerLeft: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
  },
  menuButton: {
    padding: 4,
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
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
  onlineIndicator: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.background,
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
  editButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 80,
    borderRadius: 8,
    marginBottom: 16,
  },
  editButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  availabilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 8,
  },
  availabilityLeft: {
    flex: 1,
  },
  availabilityLabel: {
    color: Colors.text,
    fontSize: 12,
  },
  calendarLink: {
    flex: 1,
    alignItems: 'flex-end',
  },
  calendarLinkText: {
    color: Colors.textSecondary,
    fontSize: 12,
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
    overflow: 'hidden',
  },
  highlightCircleNew: {
    borderStyle: 'dashed',
    borderColor: Colors.primary,
  },
  highlightNewText: {
    color: Colors.text,
    fontSize: 10,
    marginTop: -4,
  },
  highlightImage: {
    width: '100%',
    height: '100%',
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
  postsGrid: {
    minHeight: 200,
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
  videoIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  videoThumb: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPosts: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
    marginBottom: 16,
  },
  createPostButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  createPostButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  shopContainer: {
    alignItems: 'center',
    padding: 40,
  },
});
