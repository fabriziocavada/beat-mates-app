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
import api, { getMediaUrl } from '../../../src/services/api';
import Colors from '../../../src/constants/colors';

const { width, height } = Dimensions.get('window');

const PHOTO_DURATION = 6000;   // 6s per foto
const VIDEO_DURATION = 60000;  // 60s max per video

function StoryVideoPlayer({ url, onVideoDuration }: { url: string; onVideoDuration?: (ms: number) => void }) {
  const [isLoading, setIsLoading] = useState(true);
  const reported = useRef(false);
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
          if (status.isLoaded && status.durationMillis && onVideoDuration && !reported.current) {
            reported.current = true;
            onVideoDuration(Math.min(status.durationMillis, VIDEO_DURATION));
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

type StoryData = { id: string; media: string; thumbnail?: string; type: string; created_at: string };
type UserStories = { user_id: string; username: string; profile_image: string | null; stories: StoryData[] };

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
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reactionAnim = useRef(new Animated.Value(0)).current;
  const reactionScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/stories');
        const data = res.data;
        if (data.length === 0) { router.replace('/(main)/home'); return; }
        setAllUserStories(data);
        const idx = data.findIndex((u: UserStories) => u.user_id === id || u.stories.some((s: StoryData) => s.id === id));
        if (idx >= 0) setCurrentUserIdx(idx);
      } catch { router.replace('/(main)/home'); }
      finally { setIsLoading(false); }
    })();
  }, []);

  // --- Navigation ---
  const goNext = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setVideoDuration(null);
    const us = allUserStories[currentUserIdx];
    if (!us) { router.replace('/(main)/home'); return; }
    if (currentStoryIdx < us.stories.length - 1) setCurrentStoryIdx(i => i + 1);
    else if (currentUserIdx < allUserStories.length - 1) { setCurrentUserIdx(i => i + 1); setCurrentStoryIdx(0); }
    else router.replace('/(main)/home');
  };
  const goPrev = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setVideoDuration(null);
    if (currentStoryIdx > 0) setCurrentStoryIdx(i => i - 1);
    else if (currentUserIdx > 0) {
      const prev = allUserStories[currentUserIdx - 1];
      setCurrentUserIdx(i => i - 1);
      setCurrentStoryIdx(prev ? prev.stories.length - 1 : 0);
    }
  };
  const goNextUser = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setVideoDuration(null);
    if (currentUserIdx < allUserStories.length - 1) { setCurrentUserIdx(i => i + 1); setCurrentStoryIdx(0); }
    else router.replace('/(main)/home');
  };
  const goPrevUser = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setVideoDuration(null);
    if (currentUserIdx > 0) { setCurrentUserIdx(i => i - 1); setCurrentStoryIdx(0); }
  };

  // --- Timer ---
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(0);
    const story = allUserStories[currentUserIdx]?.stories[currentStoryIdx];
    const isVid = story?.type === 'video';
    // Video: usa durata reale se nota, altrimenti 60s. Foto: 6s.
    const duration = isVid ? (videoDuration || VIDEO_DURATION) : PHOTO_DURATION;
    const interval = 50;
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += interval;
      setProgress(elapsed / duration);
      if (elapsed >= duration) goNext();
    }, interval);
  };

  useEffect(() => {
    if (!isLoading && allUserStories.length > 0) startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentUserIdx, currentStoryIdx, isLoading, videoDuration]);

  // --- Reactions ---
  const sendReaction = async (emoji: string) => {
    setSentReaction(emoji); setShowReactions(false);
    reactionScale.setValue(0); reactionAnim.setValue(1);
    Animated.parallel([
      Animated.spring(reactionScale, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }),
      Animated.timing(reactionAnim, { toValue: 0, duration: 1500, delay: 500, useNativeDriver: true }),
    ]).start(() => { setSentReaction(null); startTimer(); });
    const us = allUserStories[currentUserIdx];
    const story = us?.stories[currentStoryIdx];
    if (story) { try { await api.post(`/stories/${story.id}/react`, { emoji }); } catch {} }
  };

  // --- NATIVE Gestures (runOnJS=true → callbacks on JS thread, no worklet issues) ---
  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      if (e.x < width / 3) goPrev();
      else goNext();
    });

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .activeOffsetY([-20, 20])
    .onEnd((e) => {
      const ax = Math.abs(e.translationX);
      const ay = Math.abs(e.translationY);
      if (ax > 40 && ax > ay) {
        if (e.translationX < 0) goNextUser();
        else goPrevUser();
      } else if (e.translationY < -60 && ay > ax) {
        setShowReactions(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    });

  const gesture = Gesture.Race(panGesture, tapGesture);

  // --- Render ---
  if (isLoading) return <View style={s.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  const userStories = allUserStories[currentUserIdx];
  if (!userStories?.stories[currentStoryIdx]) { router.replace('/(main)/home'); return null; }
  const story = userStories.stories[currentStoryIdx];
  const mediaUrl = getMediaUrl(story.media) || '';
  const isVideo = story.type === 'video';

  return (
    <GestureDetector gesture={gesture}>
      <View style={s.container}>
        <StatusBar hidden />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {isVideo ? (
            <StoryVideoPlayer key={`${currentUserIdx}-${currentStoryIdx}`} url={mediaUrl} onVideoDuration={ms => setVideoDuration(ms)} />
          ) : (
            <Image source={{ uri: mediaUrl }} style={s.fullMedia} resizeMode="cover" />
          )}
        </View>

        <SafeAreaView edges={['top']} style={s.topOverlay} pointerEvents="box-none">
          <View style={s.progressContainer}>
            {userStories.stories.map((_: StoryData, i: number) => (
              <View key={i} style={s.progressBarBg}>
                <View style={[s.progressBarFill, { width: i < currentStoryIdx ? '100%' : i === currentStoryIdx ? `${progress * 100}%` : '0%' }]} />
              </View>
            ))}
          </View>
          <View style={s.userRow}>
            <Image
              source={userStories.profile_image ? { uri: getMediaUrl(userStories.profile_image) || '' } : require('../../../assets/default-avatar.png')}
              style={s.avatar}
            />
            <Text style={s.username}>{userStories.username}</Text>
            <TouchableOpacity onPress={() => router.replace('/(main)/home')} style={s.closeBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {showReactions && (
          <View style={s.reactionsOverlay}>
            <View style={s.reactionsRow}>
              {['❤️', '😂', '😮', '😢', '👏', '🔥'].map(e => (
                <TouchableOpacity key={e} onPress={() => sendReaction(e)} style={s.reactionBtn}><Text style={s.reactionEmoji}>{e}</Text></TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => { setShowReactions(false); startTimer(); }} style={s.closeReactionsBtn}>
              <Text style={{ color: '#fff', fontSize: 16 }}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        )}

        {sentReaction && (
          <Animated.View style={[s.sentReaction, { opacity: reactionAnim, transform: [{ scale: reactionScale }] }]}>
            <Text style={s.sentReactionEmoji}>{sentReaction}</Text>
          </Animated.View>
        )}
      </View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
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
  reactionsOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.85)', paddingBottom: 40, paddingTop: 20, alignItems: 'center', zIndex: 20 },
  reactionsRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  reactionBtn: { padding: 8 },
  reactionEmoji: { fontSize: 32 },
  closeReactionsBtn: { padding: 10 },
  sentReaction: { position: 'absolute', top: '40%', left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  sentReactionEmoji: { fontSize: 80 },
});
