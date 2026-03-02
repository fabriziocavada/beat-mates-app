import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Dimensions,
  Animated,
  Platform,
  GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import api, { getMediaUrl } from '../../../src/services/api';

const { width, height } = Dimensions.get('window');

interface Story {
  id: string;
  media: string;
  type: string;
  created_at: string;
}

interface StoryUser {
  user_id: string;
  username: string;
  profile_image: string | null;
  has_unread: boolean;
  stories: Story[];
}

const STORY_DURATION = 5000; // 5 seconds per story

export default function ViewStoryScreen() {
  const router = useRouter();
  const { id: userId } = useLocalSearchParams<{ id: string }>();

  const [allUsers, setAllUsers] = useState<StoryUser[]>([]);
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  // Load all stories from API
  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    try {
      const response = await api.get('/stories');
      const users: StoryUser[] = response.data;
      if (users.length === 0) {
        router.back();
        return;
      }
      setAllUsers(users);

      // Find the index of the selected user
      const idx = users.findIndex(u => u.user_id === userId);
      setCurrentUserIndex(idx >= 0 ? idx : 0);
      setLoaded(true);
    } catch (error) {
      console.error('Failed to load stories', error);
      router.back();
    }
  };

  const currentUser = allUsers[currentUserIndex];
  const currentStory = currentUser?.stories?.[currentStoryIndex];

  // Start progress animation for current story
  useEffect(() => {
    if (!loaded || !currentStory) return;

    progressAnim.setValue(0);
    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });
    animRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) {
        goNext();
      }
    });

    return () => {
      anim.stop();
    };
  }, [loaded, currentUserIndex, currentStoryIndex]);

  const goNext = useCallback(() => {
    if (!currentUser) return;
    if (currentStoryIndex < currentUser.stories.length - 1) {
      // Next story of same user
      setCurrentStoryIndex(prev => prev + 1);
    } else if (currentUserIndex < allUsers.length - 1) {
      // Next user
      setCurrentUserIndex(prev => prev + 1);
      setCurrentStoryIndex(0);
    } else {
      // End of all stories
      router.back();
    }
  }, [currentUser, currentStoryIndex, currentUserIndex, allUsers.length]);

  const goPrev = useCallback(() => {
    if (currentStoryIndex > 0) {
      // Previous story of same user
      setCurrentStoryIndex(prev => prev - 1);
    } else if (currentUserIndex > 0) {
      // Previous user, go to their last story
      const prevUser = allUsers[currentUserIndex - 1];
      setCurrentUserIndex(prev => prev - 1);
      setCurrentStoryIndex(prevUser.stories.length - 1);
    }
    // Else: first story of first user, do nothing
  }, [currentStoryIndex, currentUserIndex, allUsers]);

  const handleTap = (e: GestureResponderEvent) => {
    const tapX = e.nativeEvent.locationX;
    if (tapX < width * 0.3) {
      goPrev();
    } else {
      goNext();
    }
  };

  if (!loaded || !currentUser || !currentStory) {
    return <View style={styles.container} />;
  }

  const mediaUrl = getMediaUrl(currentStory.media);
  const isVideo = currentStory.type === 'video';

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Adesso';
    return `${hours}h fa`;
  };

  return (
    <View style={styles.container}>
      {/* Story content */}
      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={StyleSheet.absoluteFill}>
          {isVideo && mediaUrl ? (
            <WebView
              source={{
                html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;background:#000}video{width:100vw;height:100vh;object-fit:cover}</style></head><body><video src="${mediaUrl}" autoplay playsinline muted></video></body></html>`,
              }}
              style={StyleSheet.absoluteFill}
              scrollEnabled={false}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
            />
          ) : mediaUrl ? (
            <Image
              source={{ uri: mediaUrl }}
              style={styles.storyImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.storyImage} />
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Top overlay */}
      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        {/* Progress bars */}
        <View style={styles.progressContainer}>
          {currentUser.stories.map((_, idx) => (
            <View key={idx} style={styles.progressBarBg}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width:
                      idx < currentStoryIndex
                        ? '100%'
                        : idx === currentStoryIndex
                        ? progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          })
                        : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* User info */}
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            {currentUser.profile_image ? (
              <Image
                source={{ uri: getMediaUrl(currentUser.profile_image) || '' }}
                style={styles.avatarImage}
              />
            ) : (
              <Ionicons name="person" size={20} color="#FFF" />
            )}
          </View>
          <Text style={styles.username}>{currentUser.username}</Text>
          <Text style={styles.time}>{formatTime(currentStory.created_at)}</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
            data-testid="story-close-btn"
          >
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  storyImage: {
    ...StyleSheet.absoluteFillObject,
    width,
    height,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 1.5,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  username: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  time: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginLeft: 8,
  },
  closeButton: {
    marginLeft: 'auto',
    padding: 4,
  },
});
