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
  Modal,
  TextInput,
  KeyboardAvoidingView,
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
  thumbnail?: string;
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

export default function ProfileScreen() {
  const router = useRouter();
  const { user, toggleAvailability, refreshUser, logout } = useAuthStore();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [userStories, setUserStories] = useState<UserStory[]>([]);
  const [videoLessons, setVideoLessons] = useState<VideoLesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'shop'>('posts');
  const [isUploadingPic, setIsUploadingPic] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editingLesson, setEditingLesson] = useState<VideoLesson | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isUploadingLesson, setIsUploadingLesson] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [reviewsLessonId, setReviewsLessonId] = useState('');
  const [lessonReviews, setLessonReviews] = useState<any[]>([]);
  const pathname = usePathname();
  
  useEffect(() => {
    if (user?.id && (pathname === '/profile' || pathname === '/(main)/profile')) {
      loadPosts();
      loadUserStories();
      loadVideoLessons();
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

  const loadVideoLessons = async () => {
    try {
      const response = await api.get(`/users/${user?.id}/video-lessons`);
      setVideoLessons(response.data);
    } catch (error) {
      console.error('Failed to load video lessons', error);
    }
  };
  
  const handleUploadLesson = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permesso necessario'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    
    Alert.prompt ? Alert.prompt('Titolo lezione', 'Inserisci il titolo della videolezione:', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'OK', onPress: (title) => uploadLessonWithTitle(result.assets[0].uri, title || 'Lezione') },
    ]) : uploadLessonWithTitle(result.assets[0].uri, 'Nuova lezione');
  };

  const uploadLessonWithTitle = async (videoUri: string, title: string) => {
    setIsUploadingLesson(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', '');
      formData.append('price', '5');
      formData.append('currency', 'EUR');
      formData.append('video', { uri: videoUri, name: 'lesson.mp4', type: 'video/mp4' } as any);
      await api.post('/video-lessons', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300000 });
      Alert.alert('Fatto!', 'Videolezione caricata. Puoi modificare titolo e prezzo.');
      loadVideoLessons();
    } catch (error) {
      Alert.alert('Errore', 'Upload fallito. Il video potrebbe essere troppo pesante, riprova con un video piu corto.');
    } finally {
      setIsUploadingLesson(false);
    }
  };

  const handleEditLesson = (lesson: VideoLesson) => {
    setEditingLesson(lesson);
    setEditTitle(lesson.title);
    setEditPrice(lesson.price.toString());
    setEditDesc(lesson.description);
    setShowEditModal(true);
  };

  const handleSaveLesson = async () => {
    if (!editingLesson) return;
    try {
      await api.put(`/video-lessons/${editingLesson.id}`, {
        title: editTitle,
        price: parseFloat(editPrice) || 0,
        description: editDesc,
      });
      setShowEditModal(false);
      loadVideoLessons();
    } catch { Alert.alert('Errore', 'Salvataggio fallito'); }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    Alert.alert('Elimina', 'Vuoi eliminare questa videolezione?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try { await api.delete(`/video-lessons/${lessonId}`); loadVideoLessons(); } catch {}
      }},
    ]);
  };

  const handleShowReviews = async (lessonId: string) => {
    setReviewsLessonId(lessonId);
    try {
      const res = await api.get(`/video-lessons/${lessonId}/reviews`);
      setLessonReviews(res.data);
    } catch { setLessonReviews([]); }
    setShowReviewsModal(true);
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
            mediaTypes: ['images'],
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
    await Promise.all([loadPosts(), loadUserStories(), loadVideoLessons(), refreshUser()]);
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
      case 'music': router.push('/(main)/music'); break;
      case 'profile': break;
    }
  };
  
  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };
  
  const handleDeletePost = async (postId: string) => {
    Alert.alert(
      'Elimina post',
      'Sei sicuro di voler eliminare questo post?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/posts/${postId}`);
              setPosts(prev => prev.filter(p => p.id !== postId));
              refreshUser();
            } catch (e) {
              Alert.alert('Errore', 'Impossibile eliminare il post');
            }
          },
        },
      ]
    );
  };

  const renderPost = ({ item }: { item: Post }) => {
    const isVideo = item.type === 'video';
    const mediaUrl = getMediaUrl(item.media);
    const thumbUrl = isVideo ? getThumbnailUrl(item.media) : mediaUrl;
    
    return (
      <TouchableOpacity 
        style={styles.postItem}
        onPress={() => router.push(`/(main)/post/${item.id}`)}
        onLongPress={() => handleDeletePost(item.id)}
        delayLongPress={500}
        data-testid={`profile-post-${item.id}`}
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
        <Text style={styles.headerUsername}>@{user?.username}</Text>
        <View style={styles.headerCenter} />
        <TouchableOpacity style={styles.menuButton} onPress={() => setShowMenu(true)} data-testid="hamburger-menu-btn">
          <Ionicons name="menu" size={28} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Hamburger Menu Modal (Instagram-style) */}
      <Modal visible={showMenu} transparent animationType="slide" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={styles.menuSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.menuHandle} />
            
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); router.push('/(main)/chat'); }}>
              <Ionicons name="chatbubble-outline" size={22} color="#FFF" />
              <Text style={styles.menuItemText}>Messaggi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); router.push('/(main)/activity'); }}>
              <Ionicons name="time-outline" size={24} color={Colors.text} />
              <Text style={styles.menuItemText}>La tua attivita</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); router.push('/(main)/saved'); }}>
              <Ionicons name="bookmark-outline" size={24} color={Colors.text} />
              <Text style={styles.menuItemText}>Salvati</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); router.push('/(main)/archive'); }}>
              <Ionicons name="archive-outline" size={24} color={Colors.text} />
              <Text style={styles.menuItemText}>Archivio</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); router.push('/(main)/notifications'); }}>
              <Ionicons name="notifications-outline" size={24} color={Colors.text} />
              <Text style={styles.menuItemText}>Notifiche</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); router.push('/(main)/calendar'); }}>
              <Ionicons name="calendar-outline" size={24} color={Colors.text} />
              <Text style={styles.menuItemText}>Calendario lezioni</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); handleToggleAvailability(); }}>
              <Ionicons name={user?.is_available ? "radio-button-on" : "radio-button-off"} size={24} color={user?.is_available ? Colors.success : Colors.text} />
              <Text style={styles.menuItemText}>{user?.is_available ? 'Disponibile per lezioni' : 'Non disponibile'}</Text>
            </TouchableOpacity>
            
            <View style={styles.menuDivider} />
            
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); router.push('/(main)/edit-profile'); }}>
              <Ionicons name="settings-outline" size={24} color={Colors.text} />
              <Text style={styles.menuItemText}>Impostazioni e privacy</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => {
              setShowMenu(false);
              Alert.alert('Esci', 'Vuoi uscire dal tuo account?', [
                { text: 'Annulla', style: 'cancel' },
                { text: 'Esci', style: 'destructive', onPress: handleLogout },
              ]);
            }}>
              <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
              <Text style={[styles.menuItemText, { color: '#FF3B30' }]}>Esci</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      
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
          
          <TouchableOpacity style={styles.editButton} onPress={() => router.push('/(main)/edit-profile')}>
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
        
        {/* Story Highlights - Rectangular vertical format */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.highlightsContainer}
          contentContainerStyle={styles.highlightsContent}
        >
          {/* Add story button */}
          <TouchableOpacity 
            style={styles.highlightItem}
            activeOpacity={0.6}
            data-testid="add-story-highlight-btn"
            onPress={() => router.push('/(main)/create-story')}
          >
            <View style={styles.highlightRectNew}>
              <Ionicons name="add" size={28} color={Colors.text} />
              <Text style={styles.highlightNewText}>NEW</Text>
            </View>
          </TouchableOpacity>
          
          {/* Real story thumbnails - rectangular */}
          {storyHighlights.map((story) => (
            <TouchableOpacity 
              key={story.id} 
              style={styles.highlightItem}
              activeOpacity={0.6}
              onPress={() => router.push(`/(main)/story/${user?.id}`)}
            >
              <View style={styles.highlightRect}>
                {story.image ? (
                  <Image source={{ uri: story.image }} style={styles.highlightImage} />
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
            {isUploadingLesson ? (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.uploadingText}>Caricamento e compressione video...</Text>
                <Text style={styles.uploadingSubtext}>Potrebbe richiedere qualche minuto</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadLessonBtn} onPress={handleUploadLesson} data-testid="upload-lesson-btn">
                <Ionicons name="cloud-upload-outline" size={20} color="#FFF" />
                <Text style={styles.uploadLessonText}>Carica videolezione</Text>
              </TouchableOpacity>
            )}
            
            {videoLessons.length === 0 && !isUploadingLesson ? (
              <View style={styles.emptyShop}>
                <Ionicons name="videocam-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Nessuna lezione in vendita</Text>
                <Text style={styles.emptySubtext}>Carica la tua prima videolezione</Text>
              </View>
            ) : (
              videoLessons.map((lesson) => (
                <View key={lesson.id} style={styles.lessonCard} data-testid={`lesson-card-${lesson.id}`}>
                  <TouchableOpacity 
                    style={styles.lessonThumbContainer} 
                    activeOpacity={0.8}
                    onPress={() => router.push(`/(main)/lesson-player/${lesson.id}`)}
                  >
                    {lesson.thumbnail_url ? (
                      <Image source={{ uri: getMediaUrl(lesson.thumbnail_url) || '' }} style={styles.lessonThumb} />
                    ) : (
                      <View style={[styles.lessonThumb, { backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="videocam" size={36} color="#555" />
                      </View>
                    )}
                    <View style={styles.lessonPlayOverlay}>
                      <View style={styles.lessonPlayCircle}>
                        <Ionicons name="play" size={28} color="#FFF" />
                      </View>
                    </View>
                  </TouchableOpacity>
                  {/* Reviews button */}
                  <TouchableOpacity 
                    style={styles.reviewsBadgeRow} 
                    onPress={() => handleShowReviews(lesson.id)}
                    data-testid={`reviews-btn-${lesson.id}`}
                  >
                    <Ionicons name="chatbubble-ellipses" size={14} color={Colors.primary} />
                    <Text style={styles.reviewsBadgeText}>Recensioni</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.lessonInfoRow}>
                    <View style={styles.lessonInfoLeft}>
                      <Text style={styles.lessonTitle}>{lesson.title}</Text>
                      <Text style={styles.lessonDuration}>
                        {String(Math.floor(lesson.duration_minutes / 60)).padStart(2, '0')}:{String(lesson.duration_minutes % 60).padStart(2, '0')} min
                      </Text>
                      <Text style={styles.lessonPrice}>{lesson.price.toFixed(2)} EUR</Text>
                    </View>
                    <View style={styles.lessonActions}>
                      <TouchableOpacity style={styles.editLessonBtn} onPress={() => handleEditLesson(lesson)} data-testid={`edit-lesson-${lesson.id}`}>
                        <Ionicons name="pencil" size={16} color={Colors.primary} />
                        <Text style={styles.editLessonText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteLessonBtn} onPress={() => handleDeleteLesson(lesson.id)}>
                        <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Edit Lesson Modal */}
        <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowEditModal(false)}>
              <View style={styles.editLessonSheet} onStartShouldSetResponder={() => true}>
                <View style={styles.menuHandle} />
                <Text style={styles.editLessonTitle}>Modifica lezione</Text>
                <TextInput
                  style={styles.editInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Titolo"
                  placeholderTextColor="#666"
                />
                <TextInput
                  style={styles.editInput}
                  value={editDesc}
                  onChangeText={setEditDesc}
                  placeholder="Descrizione"
                  placeholderTextColor="#666"
                  multiline
                />
                <View style={styles.priceInputRow}>
                  <TextInput
                    style={[styles.editInput, { flex: 1 }]}
                    value={editPrice}
                    onChangeText={setEditPrice}
                    placeholder="Prezzo"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                  />
                  <Text style={styles.currencyLabel}>EUR</Text>
                </View>
                <TouchableOpacity style={styles.saveLessonBtn} onPress={handleSaveLesson} data-testid="save-lesson-edit-btn">
                  <Text style={styles.saveLessonText}>Salva</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </Modal>

        {/* Reviews Modal */}
        <Modal visible={showReviewsModal} transparent animationType="slide" onRequestClose={() => setShowReviewsModal(false)}>
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowReviewsModal(false)}>
            <View style={styles.editLessonSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.menuHandle} />
              <Text style={styles.editLessonTitle}>Recensioni</Text>
              {lessonReviews.length === 0 ? (
                <Text style={styles.noReviewsText}>Nessuna recensione ancora</Text>
              ) : (
                <ScrollView style={{ maxHeight: 300 }}>
                  {lessonReviews.map((r: any) => (
                    <View key={r.id} style={styles.reviewItem}>
                      <View style={styles.reviewHeader}>
                        <Text style={styles.reviewUser}>{r.user?.username || 'utente'}</Text>
                        <View style={styles.reviewStars}>
                          {[1,2,3,4,5].map(s => (
                            <Ionicons key={s} name={s <= r.rating ? 'star' : 'star-outline'} size={14} color="#FFD700" />
                          ))}
                        </View>
                      </View>
                      {r.text ? <Text style={styles.reviewText}>{r.text}</Text> : null}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
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
  highlightRectNew: {
    width: 68,
    height: 88,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
  },
  highlightRect: {
    width: 68,
    height: 88,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.primary,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightNewText: {
    color: Colors.text,
    fontSize: 10,
    marginTop: 2,
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
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  uploadLessonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  uploadLessonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyShop: {
    alignItems: 'center',
    padding: 40,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 13,
    marginTop: 4,
  },
  lessonCard: {
    marginBottom: 16,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0A0A0A',
  },
  lessonThumbContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  lessonThumb: {
    width: '100%',
    height: '100%',
  },
  lessonPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  lessonPlayCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  lessonInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  lessonInfoLeft: {
    flex: 1,
  },
  lessonTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  lessonDuration: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  lessonPrice: {
    color: '#4CD964',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  lessonActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editLessonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editLessonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  deleteLessonBtn: {
    padding: 6,
  },
  editLessonSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    paddingTop: 8,
    paddingHorizontal: 24,
  },
  editLessonTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  editInput: {
    backgroundColor: '#1C1C1E',
    color: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  saveLessonBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveLessonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  uploadingOverlay: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  uploadingText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 16,
  },
  uploadingSubtext: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  currencyLabel: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  reviewsBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  reviewsBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reviewsBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  noReviewsText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 30,
  },
  reviewItem: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewUser: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 13,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewText: {
    color: '#CCC',
    fontSize: 13,
    marginTop: 4,
  },
  headerUsername: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#666',
    alignSelf: 'center',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 16,
  },
  menuItemText: {
    color: Colors.text,
    fontSize: 16,
  },
  menuDivider: {
    height: 0.5,
    backgroundColor: Colors.border,
    marginVertical: 8,
    marginHorizontal: 24,
  },
});
