import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  Dimensions, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import api, { getMediaUrl } from '../../../src/services/api';
import Colors from '../../../src/constants/colors';

const { width, height } = Dimensions.get('window');

// Native video player - FAST!
function StoryVideoPlayer({ url }: { url: string }) {
  const player = useVideoPlayer(url, player => {
    player.loop = false;
    player.muted = false;
  });

  useEffect(() => {
    if (player) {
      player.play();
    }
  }, [player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const STORY_DURATION = 6000;

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
    const interval = 50;
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += interval;
      setProgress(elapsed / STORY_DURATION);
      if (elapsed >= STORY_DURATION) {
        goNext();
      }
    }, interval);
  };

  useEffect(() => {
    if (!isLoading && allUserStories.length > 0) startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentUserIdx, currentStoryIdx, isLoading]);

  const goNext = () => {
    if (timerRef.current) clearInterval(timerRef.current);
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
    if (currentStoryIdx > 0) {
      setCurrentStoryIdx(prev => prev - 1);
    } else if (currentUserIdx > 0) {
      setCurrentUserIdx(prev => prev - 1);
      const prevUser = allUserStories[currentUserIdx - 1];
      setCurrentStoryIdx(prevUser ? prevUser.stories.length - 1 : 0);
    }
  };

  const handleTap = (e: any) => {
    const tapX = e.nativeEvent.locationX;
    if (tapX < width / 3) goPrev();
    else goNext();
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
    <View style={styles.container}>
      <StatusBar hidden />
      
      {/* Media content */}
      <TouchableOpacity activeOpacity={1} onPress={handleTap} style={StyleSheet.absoluteFill}>
        {isVideo ? (
          <StoryVideoPlayer url={mediaUrl} />
        ) : (
          <Image source={{ uri: mediaUrl }} style={styles.fullMedia} resizeMode="cover" />
        )}
      </TouchableOpacity>

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
});
