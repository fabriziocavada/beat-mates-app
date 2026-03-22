import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  Dimensions, ActivityIndicator, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import api, { getMediaUrl } from '../../../src/services/api';
import Colors from '../../../src/constants/colors';

const { width, height } = Dimensions.get('window');

// Native video player for stories
function StoryVideoPlayer({ url, onVideoDuration }: { url: string; onVideoDuration?: (ms: number) => void }) {
  const [isLoading, setIsLoading] = useState(true);
  const durationReported = useRef(false);
  
  return (
    <View style={StyleSheet.absoluteFill}>
      <Video
        source={{ uri: url }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted={false}
        onLoad={() => setIsLoading(false)}
        onPlaybackStatusUpdate={(status: any) => {
          if (status.isLoaded && isLoading) setIsLoading(false);
          if (status.isLoaded && status.durationMillis && onVideoDuration && !durationReported.current) {
            durationReported.current = true;
            onVideoDuration(Math.min(status.durationMillis, 60000));
          }
        }}
      />
      {isLoading && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
    </View>
  );
}

type StoryData = {
  id: string;
  media: string;
  thumbnail?: string;
  type: string;
  created_at: string;
};

type UserStories = {
  user_id: string;
  username: string;
  profile_image: string | null;
  stories: StoryData[];
};

export default function StoryViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [allUserStories, setAllUserStories] = useState<UserStories[]>([]);
  const [currentUserIdx, setCurrentUserIdx] = useState(0);
  const [currentStoryIdx, setCurrentStoryIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showReactions, setShowReactions] = useState(false);
  const [sentReaction, setSentReaction] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const STORY_DURATION = 6000;
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const reactionAnim = useRef(new Animated.Value(0)).current;
  const reactionScale = useRef(new Animated.Value(0)).current;

  // Refs for gesture callbacks (avoids stale closures in native gestures)
  const navRef = useRef({
    goNext: () => {},
    goPrev: () => {},
    goNextUser: () => {},
    goPrevUser: () => {},
    showReactions: () => {},
  });

  const sendReaction = async (emoji: string) => {
    setSentReaction(emoji);
    setShowReactions(false);

    reactionScale.setValue(0);
    reactionAnim.setValue(1);
    Animated.parallel([
      Animated.spring(reactionScale, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }),
      Animated.timing(reactionAnim, { toValue: 0, duration: 1500, delay: 500, useNativeDriver: true }),
    ]).start(() => {
      setSentReaction(null);
      startTimer();
    });

    const userStories = allUserStories[currentUserIdx];
    const story = userStories?.stories[currentStoryIdx];
    if (story && userStories) {
      try {
        await api.post(`/stories/${story.id}/react`, { emoji });
      } catch {}
    }
  };

  // Load stories
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/stories');
        const data = res.data;
        if (data.length === 0) { router.replace('/(main)/home'); return; }
        setAllUserStories(data);
        const idx = data.findIndex((u: UserStories) => u.user_id === id || u.stories.some((s: StoryData) => s.id === id));
        if (idx >= 0) setCurrentUserIdx(idx);
      } catch {
        router.replace('/(main)/home');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(0);
    const duration = videoDuration || STORY_DURATION;
    const interval = 50;
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += interval;
      setProgress(elapsed / duration);
      if (elapsed >= duration) {
        goNext();
      }
    }, interval);
  };

  useEffect(() => {
    if (!isLoading && allUserStories.length > 0) {
      const currentStory = allUserStories[currentUserIdx]?.stories[currentStoryIdx];
      if (currentStory?.type === 'video' && !videoDuration) {
        const fallbackTimer = setTimeout(() => setVideoDuration(30000), 3000);
        return () => { clearTimeout(fallbackTimer); if (timerRef.current) clearInterval(timerRef.current); };
      }
      startTimer();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentUserIdx, currentStoryIdx, isLoading, videoDuration]);

  // Tap: next/prev STORY of same user
  const goNext = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setVideoDuration(null);
    const userStories = allUserStories[currentUserIdx];
    if (!userStories) { router.replace('/(main)/home'); return; }
    if (currentStoryIdx < userStories.stories.length - 1) {
      setCurrentStoryIdx(prev => prev + 1);
    } else if (currentUserIdx < allUserStories.length - 1) {
      setCurrentUserIdx(prev => prev + 1);
      setCurrentStoryIdx(0);
    } else {
      router.replace('/(main)/home');
    }
  };

  const goPrev = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setVideoDuration(null);
    if (currentStoryIdx > 0) {
      setCurrentStoryIdx(prev => prev - 1);
    } else if (currentUserIdx > 0) {
      setCurrentUserIdx(prev => prev - 1);
      const prevUser = allUserStories[currentUserIdx - 1];
      setCurrentStoryIdx(prevUser ? prevUser.stories.length - 1 : 0);
    }
  };

  // Swipe: jump to next/prev USER
  const goNextUser = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setVideoDuration(null);
    if (currentUserIdx < allUserStories.length - 1) {
      setCurrentUserIdx(prev => prev + 1);
      setCurrentStoryIdx(0);
    } else {
      router.replace('/(main)/home');
    }
  };

  const goPrevUser = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setVideoDuration(null);
    if (currentUserIdx > 0) {
      setCurrentUserIdx(prev => prev - 1);
      setCurrentStoryIdx(0);
    }
  };

  const openReactions = () => {
    setShowReactions(true);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Keep refs in sync
  useEffect(() => {
    navRef.current = { goNext, goPrev, goNextUser, goPrevUser, showReactions: openReactions };
  });

  // Native gesture handlers using react-native-gesture-handler
  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      'worklet';
      if (e.x < width / 3) {
        runOnJS(navRef.current.goPrev)();
      } else {
        runOnJS(navRef.current.goNext)();
      }
    });

  const panGesture = Gesture.Pan()
    .activeOffsetX([-25, 25])
    .activeOffsetY([-25, 25])
    .onEnd((e) => {
      'worklet';
      const absDx = Math.abs(e.translationX);
      const absDy = Math.abs(e.translationY);

      // Horizontal swipe → change USER
      if (absDx > 40 && absDx > absDy) {
        if (e.translationX < 0) {
          runOnJS(navRef.current.goNextUser)();
        } else {
          runOnJS(navRef.current.goPrevUser)();
        }
        return;
      }

      // Vertical swipe up → reactions
      if (e.translationY < -60 && absDy > absDx) {
        runOnJS(navRef.current.showReactions)();
      }
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const userStories = allUserStories[currentUserIdx];
  if (!userStories || !userStories.stories[currentStoryIdx]) {
    router.replace('/(main)/home');
    return null;
  }

  const story = userStories.stories[currentStoryIdx];
  const mediaUrl = getMediaUrl(story.media) || '';
  const isVideo = story.type === 'video';

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={styles.container}>
        <StatusBar hidden />
        
        {/* Media content */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {isVideo ? (
            <StoryVideoPlayer
              key={`${currentUserIdx}-${currentStoryIdx}`}
              url={mediaUrl}
              onVideoDuration={(ms) => setVideoDuration(ms)}
            />
          ) : (
            <Image source={{ uri: mediaUrl }} style={styles.fullMedia} resizeMode="cover" />
          )}
        </View>

        {/* Top overlay with progress and user info */}
        <SafeAreaView edges={['top']} style={styles.topOverlay} pointerEvents="box-none">
          {/* Progress bars */}
          <View style={styles.progressContainer}>
            {userStories.stories.map((_: StoryData, i: number) => (
              <View key={i} style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: i < currentStoryIdx ? '100%'
                        : i === currentStoryIdx ? `${progress * 100}%`
                        : '0%',
                    },
                  ]}
                />
              </View>
            ))}
          </View>

          {/* User info + close */}
          <View style={styles.userRow}>
            <Image
              source={userStories.profile_image ? { uri: getMediaUrl(userStories.profile_image) || '' } : require('../../../assets/default-avatar.png')}
              style={styles.avatar}
            />
            <Text style={styles.username}>{userStories.username}</Text>
            <TouchableOpacity onPress={() => router.replace('/(main)/home')} style={styles.closeBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Reactions overlay */}
        {showReactions && (
          <View style={styles.reactionsOverlay}>
            <View style={styles.reactionsRow}>
              {['❤️', '😂', '😮', '😢', '👏', '🔥'].map(emoji => (
                <TouchableOpacity key={emoji} onPress={() => sendReaction(emoji)} style={styles.reactionBtn}>
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => { setShowReactions(false); startTimer(); }} style={styles.closeReactionsBtn}>
              <Text style={{ color: '#fff', fontSize: 16 }}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sent reaction animation */}
        {sentReaction && (
          <Animated.View style={[styles.sentReaction, { opacity: reactionAnim, transform: [{ scale: reactionScale }] }]}>
            <Text style={styles.sentReactionEmoji}>{sentReaction}</Text>
          </Animated.View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  fullMedia: { width: '100%', height: '100%' },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  progressContainer: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 8, gap: 4 },
  progressBarBg: { flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: '#fff' },
  username: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  closeBtn: { padding: 4 },
  reactionsOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', paddingBottom: 40, paddingTop: 20,
    alignItems: 'center', zIndex: 20,
  },
  reactionsRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  reactionBtn: { padding: 8 },
  reactionEmoji: { fontSize: 32 },
  closeReactionsBtn: { padding: 10 },
  sentReaction: {
    position: 'absolute', top: '40%', left: 0, right: 0,
    alignItems: 'center', zIndex: 30,
  },
  sentReactionEmoji: { fontSize: 80 },
});
