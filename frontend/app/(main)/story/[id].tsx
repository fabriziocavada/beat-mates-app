import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  Dimensions, ActivityIndicator, StatusBar, Animated,
  GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import api, { getMediaUrl } from '../../../src/services/api';
import Colors from '../../../src/constants/colors';

const { width, height } = Dimensions.get('window');

const REACTIONS = ['❤️', '🔥', '👏', '😍', '💃', '🕺'];

// Native video player for stories - direct streaming, no WebView overhead
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

interface StoryData {
  id: string;
  media: string;
  thumbnail?: string | null;
  type: string;
  created_at: string;
}

interface UserStories {
  user_id: string;
  username: string;
  profile_image: string | null;
  stories: StoryData[];
}

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
  const STORY_DURATION = 6000; // default for photos
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const reactionAnim = useRef(new Animated.Value(0)).current;
  const reactionScale = useRef(new Animated.Value(0)).current;

  // Touch tracking for gesture detection
  const touchRef = useRef({ startX: 0, startY: 0, startTime: 0, currentX: 0, currentY: 0 });

  const sendReaction = async (emoji: string) => {
    setSentReaction(emoji);
    setShowReactions(false);

    // Animate the reaction
    reactionScale.setValue(0);
    reactionAnim.setValue(1);
    Animated.parallel([
      Animated.spring(reactionScale, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }),
      Animated.timing(reactionAnim, { toValue: 0, duration: 1500, delay: 500, useNativeDriver: true }),
    ]).start(() => {
      setSentReaction(null);
      startTimer();
    });

    // Send to backend
    const userStories = allUserStories[currentUserIdx];
    const story = userStories?.stories[currentStoryIdx];
    if (story && userStories) {
      try {
        await api.post(`/stories/${story.id}/react`, { emoji });
      } catch {}
    }
  };

  useEffect(() => {
    loadStories();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const loadStories = async () => {
    try {
      const res = await api.get('/stories');
      const data: UserStories[] = res.data;
      setAllUserStories(data);
      const userIdx = data.findIndex(u => u.user_id === id);
      if (userIdx >= 0) setCurrentUserIdx(userIdx);
      setIsLoading(false);
    } catch { 
      // Safe navigation - don't use router.back() as it may not have history
      router.replace('/(main)/home');
    }
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(0);
    // Per video: usa la durata reale (fino a 60s), per foto: 6 secondi
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
        // Wait for video to report duration, but set fallback after 3s
        const fallbackTimer = setTimeout(() => {
          setVideoDuration(30000); // 30s fallback
        }, 3000);
        return () => { 
          clearTimeout(fallbackTimer);
          if (timerRef.current) clearInterval(timerRef.current); 
        };
      }
      startTimer();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentUserIdx, currentStoryIdx, isLoading, videoDuration]);

  const goNext = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setVideoDuration(null); // reset per la prossima storia
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
    setVideoDuration(null); // reset per la prossima storia
    if (currentStoryIdx > 0) {
      setCurrentStoryIdx(prev => prev - 1);
    } else if (currentUserIdx > 0) {
      setCurrentUserIdx(prev => prev - 1);
      const prevUser = allUserStories[currentUserIdx - 1];
      setCurrentStoryIdx(prevUser ? prevUser.stories.length - 1 : 0);
    }
  };

  // Swipe: jump to next/prev USER (skip remaining stories of current user)
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

  // Gesture handlers with move tracking (onResponderRelease has stale coords on iOS)
  const onTouchStart = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.pageX;
    const y = e.nativeEvent.pageY;
    touchRef.current = { startX: x, startY: y, startTime: Date.now(), currentX: x, currentY: y };
  };

  const onTouchMove = (e: GestureResponderEvent) => {
    touchRef.current.currentX = e.nativeEvent.pageX;
    touchRef.current.currentY = e.nativeEvent.pageY;
  };

  const onTouchEnd = () => {
    const { startX, startY, startTime, currentX, currentY } = touchRef.current;
    const dx = currentX - startX;
    const dy = currentY - startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const dt = Date.now() - startTime;

    // Horizontal swipe → change USER
    if (absDx > 40 && absDx > absDy && dt < 800) {
      if (dx < 0) goNextUser();
      else goPrevUser();
      return;
    }

    // Vertical swipe up → show reactions
    if (dy < -60 && absDy > absDx && dt < 800) {
      setShowReactions(true);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Tap → navigate stories (left 1/3 = prev, right 2/3 = next)
    if (absDx < 15 && absDy < 15 && dt < 500) {
      if (currentX < width / 3) goPrev();
      else goNext();
    }
  };

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
    <View
      style={styles.container}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={onTouchStart}
      onResponderMove={onTouchMove}
      onResponderRelease={onTouchEnd}
    >
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
        <View style={styles.progressRow}>
          {userStories.stories.map((_, idx) => (
            <View key={idx} style={styles.progressTrack}>
              <View style={[
                styles.progressFill,
                {
                  width: idx < currentStoryIdx ? '100%'
                    : idx === currentStoryIdx ? `${Math.min(progress * 100, 100)}%`
                    : '0%'
                }
              ]} />
            </View>
          ))}
        </View>

        <View style={styles.userRow}>
          <View style={styles.userAvatar}>
            {userStories.profile_image ? (
              <Image source={{ uri: getMediaUrl(userStories.profile_image) || '' }} style={styles.avatarImg} />
            ) : (
              <Ionicons name="person" size={18} color="#999" />
            )}
          </View>
          <Text style={styles.username}>{userStories.username}</Text>
          <Text style={styles.timeText}>{formatTimeAgo(story.created_at)}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Swipe up hint */}
      {!showReactions && !sentReaction && (
        <View style={styles.swipeHint} pointerEvents="none">
          <Ionicons name="chevron-up" size={20} color="rgba(255,255,255,0.5)" />
          <Text style={styles.swipeHintText}>Scorri per reagire</Text>
        </View>
      )}

      {/* Reaction picker */}
      {showReactions && (
        <TouchableOpacity
          style={styles.reactionOverlay}
          activeOpacity={1}
          onPress={() => { setShowReactions(false); startTimer(); }}
        >
          <View style={styles.reactionBar} data-testid="reaction-bar">
            {REACTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionBtn}
                onPress={() => sendReaction(emoji)}
                data-testid={`reaction-${emoji}`}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}

      {/* Sent reaction animation */}
      {sentReaction && (
        <Animated.View
          style={[styles.sentReaction, {
            opacity: reactionAnim,
            transform: [{ scale: reactionScale.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
          }]}
          pointerEvents="none"
        >
          <Text style={styles.sentReactionEmoji}>{sentReaction}</Text>
        </Animated.View>
      )}
    </View>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const hours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  if (hours < 1) return 'ora';
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}g`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  fullMedia: { width, height, position: 'absolute', top: 0, left: 0 },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  progressRow: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 8, gap: 4 },
  progressTrack: { flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 2 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10 },
  userAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  username: { color: '#FFF', fontWeight: '700', fontSize: 14, marginLeft: 10 },
  timeText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginLeft: 8 },
  closeBtn: { marginLeft: 'auto', padding: 4 },
  // Reactions
  swipeHint: {
    position: 'absolute', bottom: 40, alignSelf: 'center', alignItems: 'center', gap: 2,
  },
  swipeHintText: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  reactionOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end', alignItems: 'center', zIndex: 30, paddingBottom: 60,
  },
  reactionBar: {
    flexDirection: 'row', gap: 12, backgroundColor: 'rgba(30,30,50,0.95)',
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 28,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  reactionBtn: { padding: 4 },
  reactionEmoji: { fontSize: 30 },
  sentReaction: {
    position: 'absolute', top: '35%', alignSelf: 'center', zIndex: 40,
  },
  sentReactionEmoji: { fontSize: 80 },
});
