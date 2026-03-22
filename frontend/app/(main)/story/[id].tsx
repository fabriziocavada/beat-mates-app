import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, FlatList,
  Dimensions, ActivityIndicator, StatusBar, Animated, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import api, { getMediaUrl } from '../../../src/services/api';
import Colors from '../../../src/constants/colors';

const { width, height } = Dimensions.get('window');
const PHOTO_DURATION = 6000;
const VIDEO_DURATION = 60000;

// Instagram-style reactions
const REACTIONS = ['❤️', '😂', '😮', '😢', '👏', '🔥'];

type StoryData = { id: string; media: string; thumbnail?: string; type: string; created_at: string };
type UserStories = { user_id: string; username: string; profile_image: string | null; stories: StoryData[] };

// Video player
function StoryVideoPlayer({ url, isActive }: { url: string; isActive: boolean }) {
  const [loading, setLoading] = useState(true);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Video
        source={{ uri: url }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay={isActive}
        isLooping
        isMuted={false}
        onLoad={() => setLoading(false)}
        onPlaybackStatusUpdate={(s: any) => { if (s.isLoaded && loading) setLoading(false); }}
      />
      {loading && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
    </View>
  );
}

// Single user's story page (rendered inside the horizontal pager)
function UserStoryPage({
  userStories, storyIdx, progress, isActive, onTap, onClose, onSwipeUp, onSwipeDown
}: {
  userStories: UserStories; storyIdx: number; progress: number;
  isActive: boolean; onTap: (side: 'left' | 'right') => void; onClose: () => void;
  onSwipeUp: () => void; onSwipeDown: () => void;
}) {
  const story = userStories.stories[storyIdx];
  if (!story) return null;
  const mediaUrl = getMediaUrl(story.media) || '';
  const isVideo = story.type === 'video';
  const touchY = useRef(0);
  const wasSwipe = useRef(false);

  // Detect vertical swipes on press in/out (doesn't conflict with FlatList horizontal scroll)
  const handlePressIn = (e: any) => {
    touchY.current = e.nativeEvent.pageY;
    wasSwipe.current = false;
  };

  const handlePressOut = (e: any) => {
    const dy = e.nativeEvent.pageY - touchY.current;
    const absDy = Math.abs(dy);
    if (absDy > 80) {
      wasSwipe.current = true;
      if (dy < 0) onSwipeUp();   // swipe up → reactions
      else onSwipeDown();         // swipe down → close
    }
  };

  const handleTap = (side: 'left' | 'right') => {
    // Only handle tap if it wasn't a swipe
    if (!wasSwipe.current) {
      onTap(side);
    }
  };

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {isVideo ? (
          <StoryVideoPlayer key={story.id} url={mediaUrl} isActive={isActive} />
        ) : (
          <Image source={{ uri: mediaUrl }} style={styles.fullMedia} resizeMode="cover" />
        )}
      </View>

      {/* Tap zones with vertical swipe detection */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', flex: 1 }}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={() => handleTap('left')}
          />
          <TouchableOpacity
            style={{ flex: 2 }}
            activeOpacity={1}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={() => handleTap('right')}
          />
        </View>
      </View>

      {/* Swipe up hint at bottom */}
      <View style={styles.swipeHint} pointerEvents="none">
        <Ionicons name="chevron-up" size={20} color="rgba(255,255,255,0.5)" />
      </View>

      {/* Top: progress bars + user info */}
      <SafeAreaView edges={['top']} style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.progressContainer}>
          {userStories.stories.map((_: StoryData, i: number) => (
            <View key={i} style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, {
                width: i < storyIdx ? '100%' : i === storyIdx ? `${progress * 100}%` : '0%'
              }]} />
            </View>
          ))}
        </View>
        <View style={styles.userRow}>
          {userStories.profile_image ? (
            <Image
              source={{ uri: getMediaUrl(userStories.profile_image) || '' }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, { backgroundColor: '#555', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                {userStories.username?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.username}>{userStories.username}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pagerRef = useRef<FlatList>(null);
  const isScrolling = useRef(false);

  // Load stories
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/stories');
        const data = res.data;
        if (data.length === 0) { router.replace('/(main)/home'); return; }
        setAllUserStories(data);
        const idx = data.findIndex((u: UserStories) =>
          u.user_id === id || u.stories.some((s: StoryData) => s.id === id)
        );
        if (idx >= 0) {
          setCurrentUserIdx(idx);
          // Scroll to the correct user after data loads
          setTimeout(() => {
            pagerRef.current?.scrollToOffset({ offset: idx * width, animated: false });
          }, 100);
        }
      } catch { router.replace('/(main)/home'); }
      finally { setIsLoading(false); }
    })();
  }, []);

  // Timer
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(0);
    const story = allUserStories[currentUserIdx]?.stories[currentStoryIdx];
    const isVid = story?.type === 'video';
    const duration = isVid ? VIDEO_DURATION : PHOTO_DURATION;
    const interval = 50;
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += interval;
      setProgress(elapsed / duration);
      if (elapsed >= duration) {
        goNextStory();
      }
    }, interval);
  };

  useEffect(() => {
    if (!isLoading && allUserStories.length > 0 && !isScrolling.current) startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentUserIdx, currentStoryIdx, isLoading, allUserStories]);

  // Navigate stories within same user
  const goNextStory = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const us = allUserStories[currentUserIdx];
    if (!us) { router.replace('/(main)/home'); return; }
    if (currentStoryIdx < us.stories.length - 1) {
      setCurrentStoryIdx(i => i + 1);
    } else {
      // End of this user's stories -> go to next user
      goNextUser();
    }
  };

  const goPrevStory = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (currentStoryIdx > 0) {
      setCurrentStoryIdx(i => i - 1);
    } else {
      goPrevUser();
    }
  };

  // Navigate between users (scroll the pager)
  const goNextUser = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (currentUserIdx < allUserStories.length - 1) {
      const nextIdx = currentUserIdx + 1;
      setCurrentUserIdx(nextIdx);
      setCurrentStoryIdx(0);
      pagerRef.current?.scrollToOffset({ offset: nextIdx * width, animated: true });
    } else {
      router.replace('/(main)/home');
    }
  };

  const goPrevUser = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (currentUserIdx > 0) {
      const prevIdx = currentUserIdx - 1;
      setCurrentUserIdx(prevIdx);
      setCurrentStoryIdx(0);
      pagerRef.current?.scrollToOffset({ offset: prevIdx * width, animated: true });
    }
  };

  // Handle horizontal scroll end (user swiped the pager)
  const onScrollEnd = (e: any) => {
    const newIdx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (newIdx !== currentUserIdx && newIdx >= 0 && newIdx < allUserStories.length) {
      setCurrentUserIdx(newIdx);
      setCurrentStoryIdx(0);
    }
    isScrolling.current = false;
  };

  const onTap = (side: 'left' | 'right') => {
    if (side === 'left') goPrevStory();
    else goNextStory();
  };

  const onClose = () => router.replace('/(main)/home');

  // Swipe UP → show reactions (Instagram style)
  const onSwipeUp = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setShowReactions(true);
  };

  // Swipe DOWN → close and go home
  const onSwipeDown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    router.replace('/(main)/home');
  };

  // Handle reaction selection
  const onReactionSelect = (emoji: string) => {
    setShowReactions(false);
    // TODO: Send reaction to backend if needed
    startTimer(); // Resume timer after reaction
  };

  // Close reactions panel
  const closeReactions = () => {
    setShowReactions(false);
    startTimer();
  };

  if (isLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Horizontal pager - SWIPE LEFT/RIGHT = CHANGE USER (native scroll) */}
      <FlatList
        ref={pagerRef}
        data={allUserStories}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(item) => item.user_id}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onScrollBeginDrag={() => { isScrolling.current = true; if (timerRef.current) clearInterval(timerRef.current); }}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item, index }) => (
          <UserStoryPage
            userStories={item}
            storyIdx={index === currentUserIdx ? currentStoryIdx : 0}
            progress={index === currentUserIdx ? progress : 0}
            isActive={index === currentUserIdx}
            onTap={onTap}
            onClose={onClose}
            onSwipeUp={onSwipeUp}
            onSwipeDown={onSwipeDown}
          />
        )}
      />

      {/* Arrow buttons for changing user */}
      {currentUserIdx > 0 && (
        <TouchableOpacity style={styles.arrowLeft} onPress={goPrevUser} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={30} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      )}
      {currentUserIdx < allUserStories.length - 1 && (
        <TouchableOpacity style={styles.arrowRight} onPress={goNextUser} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={30} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      )}

      {/* Instagram-style Reactions Modal (Swipe UP) */}
      <Modal
        visible={showReactions}
        transparent
        animationType="slide"
        onRequestClose={closeReactions}
      >
        <Pressable style={styles.reactionsOverlay} onPress={closeReactions}>
          <View style={styles.reactionsContainer}>
            <View style={styles.reactionsHandle} />
            <View style={styles.reactionsRow}>
              {REACTIONS.map((emoji, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.reactionButton}
                  onPress={() => onReactionSelect(emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
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
  arrowLeft: {
    position: 'absolute', left: 4, top: '50%', marginTop: -25,
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center', zIndex: 20,
  },
  arrowRight: {
    position: 'absolute', right: 4, top: '50%', marginTop: -25,
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center', zIndex: 20,
  },
  swipeHint: {
    position: 'absolute', bottom: 30, alignSelf: 'center',
  },
  // Instagram-style reactions modal
  reactionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  reactionsContainer: {
    backgroundColor: '#262626',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    paddingTop: 12,
    alignItems: 'center',
  },
  reactionsHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
    marginBottom: 20,
  },
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  reactionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: {
    fontSize: 28,
  },
});
