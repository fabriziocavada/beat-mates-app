import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, FlatList,
  Dimensions, ActivityIndicator, StatusBar, Animated, Modal, Pressable, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import api, { getMediaUrl } from '../../../src/services/api';
import Colors from '../../../src/constants/colors';
import ShareModal from '../../../src/components/ShareModal';

const { width, height } = Dimensions.get('window');
const PHOTO_DURATION = 6000;
const VIDEO_DURATION = 60000;

// Instagram-style reactions
const REACTIONS = ['❤️', '😂', '😮', '😢', '👏', '🔥'];

// Interactive Poll Widget - users can tap to vote
function InteractivePollWidget({ content }: { content: string }) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const parts = content.split('|');
  const question = parts[0];
  const options = parts.slice(1);

  return (
    <View style={styles.pollWidget}>
      <Text style={styles.pollQuestion}>{question}</Text>
      {options.map((opt, idx) => (
        <TouchableOpacity
          key={idx}
          style={[
            styles.pollOption,
            selectedOption === idx && styles.pollOptionSelected,
          ]}
          onPress={() => setSelectedOption(idx)}
        >
          <Text style={[styles.pollOptionText, selectedOption === idx && styles.pollOptionTextSelected]}>
            {opt}
          </Text>
          {selectedOption === idx && (
            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Interactive Question Widget - users can tap to respond
function InteractiveQuestionWidget({ content }: { content: string }) {
  const [showInput, setShowInput] = useState(false);
  const [response, setResponse] = useState('');

  return (
    <View style={styles.questionWidget}>
      <Text style={styles.questionWidgetTitle}>{content}</Text>
      {!showInput ? (
        <TouchableOpacity style={styles.questionInputButton} onPress={() => setShowInput(true)}>
          <Text style={styles.questionInputPlaceholder}>Scrivi una risposta...</Text>
        </TouchableOpacity>
      ) : (
        <TextInput
          style={styles.questionInput}
          placeholder="Scrivi qui..."
          placeholderTextColor="#888"
          value={response}
          onChangeText={setResponse}
          autoFocus
        />
      )}
    </View>
  );
}

type EditorData = {
  texts?: { id: string; text: string; x: number; y: number; color: string; fontSize: number; fontStyle: string; backgroundColor: string | null }[];
  stickers?: { id: string; type: string; content: string; icon?: string; x: number; y: number; scale: number }[];
  drawings?: { id: string; points: string; color: string; width: number }[];
  overlayImages?: { id: string; uri: string; x: number; y: number; scale: number; width: number; height: number }[];
  backgroundColor?: string;
  music?: { id: string; title: string; artist: string; file_url: string };
  effect?: string;
  effectParticles?: { id: string; emoji: string; x: number; y: number; opacity: number }[];
};

type StoryData = { id: string; media: string; thumbnail?: string; type: string; created_at: string; editor_data?: EditorData };
type UserStories = { user_id: string; username: string; profile_image: string | null; stories: StoryData[] };

// Overlay renderer for story editor data
function StoryOverlays({ editorData }: { editorData?: EditorData }) {
  if (!editorData) return null;

  const hasInteractiveWidgets = editorData.stickers?.some(s => s.icon === 'stats-chart' || s.icon === 'help-circle-outline');

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={hasInteractiveWidgets ? 'box-none' : 'none'}>
      {/* Background color */}
      {editorData.backgroundColor && editorData.backgroundColor !== 'transparent' && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: editorData.backgroundColor, opacity: 0.5 }]} pointerEvents="none" />
      )}

      {/* Drawings */}
      {editorData.drawings && editorData.drawings.length > 0 && (
        <View style={StyleSheet.absoluteFill}>
          {/* SVG would be ideal here but for simplicity we show a placeholder */}
        </View>
      )}

      {/* Texts */}
      {editorData.texts?.map((t) => (
        <View
          key={t.id}
          style={[
            styles.overlayText,
            { left: t.x, top: t.y },
            t.backgroundColor ? { backgroundColor: t.backgroundColor, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 } : null,
          ]}
        >
          <Text
            style={[
              { color: t.color, fontSize: t.fontSize },
              t.fontStyle === 'signature' ? { fontStyle: 'italic' } : t.fontStyle === 'modern' ? { fontWeight: '300' } : { fontWeight: 'bold' },
              styles.overlayTextShadow,
            ]}
          >
            {t.text}
          </Text>
        </View>
      ))}

      {/* Stickers */}
      {editorData.stickers?.map((s) => (
        <View key={s.id} style={[styles.overlaySticker, { left: s.x, top: s.y, transform: [{ scale: s.scale || 1 }] }]}>
          {s.type === 'emoji' ? (
            <Text style={{ fontSize: 60 }}>{s.content}</Text>
          ) : s.type === 'gif' ? (
            // GIF sticker - render as animated image
            <Image 
              source={{ uri: s.content }} 
              style={{ width: 120, height: 120, borderRadius: 8 }}
              resizeMode="cover"
            />
          ) : s.icon === 'stats-chart' ? (
            // Interactive Poll Widget
            <InteractivePollWidget content={s.content} />
          ) : s.icon === 'help-circle-outline' ? (
            // Question Widget
            <InteractiveQuestionWidget content={s.content} />
          ) : (
            <View style={styles.widgetStickerView}>
              {s.icon && <Ionicons name={s.icon as any} size={18} color="#fff" />}
              <Text style={styles.widgetStickerText} numberOfLines={1}>
                {s.content}
              </Text>
            </View>
          )}
        </View>
      ))}

      {/* Overlay Images */}
      {editorData.overlayImages?.map((img) => (
        <View 
          key={img.id} 
          style={[
            styles.overlayImage, 
            { 
              left: img.x, 
              top: img.y,
              transform: [{ scale: img.scale || 1 }],
            }
          ]}
        >
          <Image 
            source={{ uri: img.uri.startsWith('http') ? img.uri : getMediaUrl(img.uri) || '' }} 
            style={{ width: img.width, height: img.height, borderRadius: 8 }}
            resizeMode="cover"
          />
        </View>
      ))}

      {/* Effect Particles */}
      {editorData.effectParticles?.map((p) => (
        <Text 
          key={p.id} 
          style={{ 
            position: 'absolute', 
            left: p.x, 
            top: p.y, 
            fontSize: 24,
            opacity: p.opacity,
          }}
        >
          {p.emoji}
        </Text>
      ))}
    </View>
  );
}

// Video player with pause support and optional music overlay
function StoryVideoPlayer({ url, isActive, isPaused, musicUrl }: { url: string; isActive: boolean; isPaused?: boolean; musicUrl?: string }) {
  const [loading, setLoading] = useState(true);
  const [musicSound, setMusicSound] = useState<any>(null);
  
  // Debug log
  useEffect(() => {
    if (musicUrl) {
      console.log('Story has music URL:', musicUrl);
    }
  }, [musicUrl]);
  
  // Handle music playback using Audio API
  useEffect(() => {
    let sound: any = null;
    
    const loadAndPlayMusic = async () => {
      if (!musicUrl) return;
      
      try {
        const { Audio } = require('expo-av');
        const { sound: audioSound } = await Audio.Sound.createAsync(
          { uri: musicUrl },
          { shouldPlay: isActive && !isPaused, isLooping: true, volume: 1.0 }
        );
        sound = audioSound;
        setMusicSound(audioSound);
        console.log('Music loaded successfully');
      } catch (error) {
        console.error('Failed to load music:', error);
      }
    };
    
    loadAndPlayMusic();
    
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [musicUrl]);
  
  // Control music playback based on active/paused state
  useEffect(() => {
    if (musicSound) {
      if (isActive && !isPaused) {
        musicSound.playAsync().catch(console.error);
      } else {
        musicSound.pauseAsync().catch(console.error);
      }
    }
  }, [isActive, isPaused, musicSound]);
  
  return (
    <View style={StyleSheet.absoluteFill}>
      <Video
        source={{ uri: url }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay={isActive && !isPaused}
        isLooping
        isMuted={!!musicUrl} // Mute video if there's background music
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

// Optimized Image loader with fast loading
function StoryImageLoader({ url }: { url: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image 
        source={{ uri: url, cache: 'force-cache' }} 
        style={styles.fullMedia} 
        resizeMode="cover"
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setError(true); }}
      />
      {loading && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
      {error && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1c1c1e', alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="image-outline" size={40} color="#666" />
          <Text style={{ color: '#888', fontSize: 12, marginTop: 8 }}>Immagine non disponibile</Text>
        </View>
      )}
    </View>
  );
}

// Single user's story page (rendered inside the horizontal pager)
function UserStoryPage({
  userStories, storyIdx, progress, isActive, onTap, onClose, onSwipeUp, onSwipeDown, onSendMessage, onLike, onShare, onHoldStart, onHoldEnd, isPaused
}: {
  userStories: UserStories; storyIdx: number; progress: number;
  isActive: boolean; onTap: (side: 'left' | 'right') => void; onClose: () => void;
  onSwipeUp: () => void; onSwipeDown: () => void;
  onSendMessage: (message: string) => void; onLike: () => void; onShare: () => void;
  onHoldStart: () => void; onHoldEnd: () => void; isPaused: boolean;
}) {
  const story = userStories.stories[storyIdx];
  const [messageText, setMessageText] = useState('');
  const [reactions, setReactions] = useState<any[]>([]);
  const [currentReactionIdx, setCurrentReactionIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // Load reactions for current story
  useEffect(() => {
    if (story?.id && isActive) {
      loadReactions();
    }
  }, [story?.id, isActive]);

  // Animate through reactions (rotate every 2 seconds like Instagram)
  useEffect(() => {
    if (reactions.length <= 1) return;
    const interval = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentReactionIdx(prev => (prev + 1) % reactions.length);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [reactions.length]);

  const loadReactions = async () => {
    try {
      const res = await api.get(`/stories/${story.id}/reactions`);
      setReactions(res.data.reactions || []);
    } catch (e) {
      // Story might not have reactions endpoint yet, fail silently
    }
  };

  if (!story) return null;
  const mediaUrl = getMediaUrl(story.media) || '';
  const isVideo = story.type === 'video';
  const touchY = useRef(0);
  const wasSwipe = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect vertical swipes - threshold reduced to 40px for better sensitivity
  const handlePressIn = (e: any) => {
    touchY.current = e.nativeEvent.pageY;
    wasSwipe.current = false;
    // Start hold timer for pause
    holdTimerRef.current = setTimeout(() => {
      onHoldStart();
    }, 200);
  };

  const handlePressOut = (e: any) => {
    // Clear hold timer
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    
    // If paused, resume on release
    if (isPaused) {
      onHoldEnd();
      return;
    }
    
    const dy = e.nativeEvent.pageY - touchY.current;
    const absDy = Math.abs(dy);
    if (absDy > 40) {
      wasSwipe.current = true;
      if (dy < 0) onSwipeUp();
      else onSwipeDown();
    }
  };

  const handleTap = (side: 'left' | 'right') => {
    if (!wasSwipe.current && !isPaused) {
      onTap(side);
    }
  };

  const handleSendMessage = () => {
    if (messageText.trim()) {
      onSendMessage(messageText.trim());
      setMessageText('');
    }
  };

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {isVideo ? (
          <StoryVideoPlayer 
            key={story.id} 
            url={mediaUrl} 
            isActive={isActive} 
            isPaused={isPaused}
            musicUrl={story.editor_data?.music?.file_url ? getMediaUrl(story.editor_data.music.file_url) || undefined : undefined}
          />
        ) : (
          <StoryImageLoader key={story.id} url={mediaUrl} />
        )}
      </View>

      {/* Story overlays (texts, stickers, drawings from editor) */}
      <StoryOverlays editorData={story.editor_data} />

      {/* Tap zones with vertical swipe detection and hold to pause */}
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

      {/* Instagram-style viewers section with reactions */}
      {reactions.length > 0 && (
        <Animated.View style={[styles.viewersSection, { opacity: fadeAnim }]}>
          <View style={styles.viewersAvatars}>
            {reactions.slice(0, 3).map((r, i) => (
              <View key={r.id} style={[styles.viewerAvatar, { zIndex: 3 - i, marginLeft: i > 0 ? -10 : 0 }]}>
                {r.user?.profile_image ? (
                  <Image 
                    source={{ uri: getMediaUrl(r.user.profile_image) || '' }} 
                    style={styles.viewerAvatarInner} 
                  />
                ) : (
                  <View style={[styles.viewerAvatarInner, { backgroundColor: ['#FF6B6B', '#4ECDC4', '#45B7D1'][i] }]} />
                )}
              </View>
            ))}
          </View>
          <View style={styles.reactionsPreview}>
            <Text style={styles.reactionsText}>
              {reactions[currentReactionIdx]?.emoji || '❤️'} {reactions[currentReactionIdx]?.user?.username || ''}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Instagram-style bottom bar */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar} pointerEvents="box-none">
        <View style={styles.bottomBarContent}>
          <View style={styles.messageInputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Invia messaggio..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={messageText}
              onChangeText={setMessageText}
              onSubmitEditing={handleSendMessage}
              returnKeyType="send"
            />
          </View>
          <TouchableOpacity style={styles.bottomIcon} onPress={onLike}>
            <Ionicons name="heart-outline" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomIcon} onPress={onSwipeUp}>
            <Ionicons name="happy-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomIcon} onPress={onShare}>
            <Ionicons name="paper-plane-outline" size={24} color="#fff" />
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
  const [likedStory, setLikedStory] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pagerRef = useRef<FlatList>(null);
  const isScrolling = useRef(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const pausedProgress = useRef(0);
  
  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);

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

  // Hold to pause (Instagram-style)
  const onHoldStart = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      pausedProgress.current = progress;
    }
    setIsPaused(true);
  };

  const onHoldEnd = () => {
    setIsPaused(false);
    // Resume timer from where we left off
    const story = allUserStories[currentUserIdx]?.stories[currentStoryIdx];
    const isVid = story?.type === 'video';
    const duration = isVid ? VIDEO_DURATION : PHOTO_DURATION;
    let elapsed = pausedProgress.current * duration;
    
    timerRef.current = setInterval(() => {
      elapsed += 50;
      setProgress(elapsed / duration);
      if (elapsed >= duration) {
        goNextStory();
      }
    }, 50);
  };

  // Handle reaction selection
  const onReactionSelect = async (emoji: string) => {
    setShowReactions(false);
    const currentStory = allUserStories[currentUserIdx]?.stories[currentStoryIdx];
    if (currentStory?.id) {
      try {
        await api.post(`/stories/${currentStory.id}/react`, { emoji });
      } catch (e) {
        console.error('Failed to send reaction', e);
      }
    }
    startTimer(); // Resume timer after reaction
  };

  // Close reactions panel
  const closeReactions = () => {
    setShowReactions(false);
    startTimer();
  };

  // Send message to story owner - create/find conversation first
  const onSendMessage = async (message: string) => {
    const currentUser = allUserStories[currentUserIdx];
    try {
      // Create or find conversation with this user (backend expects "user_id")
      const res = await api.post('/conversations', { user_id: currentUser.user_id });
      const conversationId = res.data.id;
      // Send the message
      await api.post(`/conversations/${conversationId}/messages`, { text: message });
      // Navigate to chat
      router.push(`/(main)/chat/${conversationId}`);
    } catch (e) {
      console.error('Failed to send message', e);
    }
  };

  // Like story
  const onLike = () => {
    setLikedStory(true);
    // Show heart animation briefly
    setTimeout(() => setLikedStory(false), 1000);
    // TODO: Send like to backend
  };

  // Share story
  const onShare = () => {
    setShowShareModal(true);
  };

  if (isLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Horizontal pager with 3D cube transition */}
      <Animated.FlatList
        ref={pagerRef}
        data={allUserStories}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(item) => item.user_id}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        onScrollBeginDrag={() => { isScrolling.current = true; if (timerRef.current) clearInterval(timerRef.current); }}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item, index }) => {
          // 3D cube transition effect
          const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
          const rotateY = scrollX.interpolate({
            inputRange,
            outputRange: ['45deg', '0deg', '-45deg'],
            extrapolate: 'clamp',
          });
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.9, 1, 0.9],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.6, 1, 0.6],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View style={{
              width,
              height,
              transform: [
                { perspective: 1000 },
                { rotateY },
                { scale },
              ],
              opacity,
            }}>
              <UserStoryPage
                userStories={item}
                storyIdx={index === currentUserIdx ? currentStoryIdx : 0}
                progress={index === currentUserIdx ? progress : 0}
                isActive={index === currentUserIdx}
                onTap={onTap}
                onClose={onClose}
                onSwipeUp={onSwipeUp}
                onSwipeDown={onSwipeDown}
                onSendMessage={onSendMessage}
                onLike={onLike}
                onShare={onShare}
                onHoldStart={onHoldStart}
                onHoldEnd={onHoldEnd}
                isPaused={isPaused}
              />
            </Animated.View>
          );
        }}
      />

      {/* Like animation */}
      {likedStory && (
        <View style={styles.likeAnimation}>
          <Animated.Text style={{ fontSize: 80 }}>❤️</Animated.Text>
        </View>
      )}

      {/* Arrow buttons for changing user */}

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
      
      {/* Share Modal */}
      {allUserStories[currentUserIdx] && (
        <ShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          mediaUrl={allUserStories[currentUserIdx]?.stories?.[currentStoryIdx]?.media}
          mediaType={allUserStories[currentUserIdx]?.stories?.[currentStoryIdx]?.type === 'video' ? 'video' : 'photo'}
          postId={allUserStories[currentUserIdx]?.stories?.[currentStoryIdx]?.id}
        />
      )}
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
  // Instagram-style bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  bottomBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 20,
  },
  messageInputContainer: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginRight: 12,
  },
  messageInput: {
    color: '#fff',
    fontSize: 15,
  },
  bottomIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeAnimation: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  // Instagram-style viewers section
  viewersSection: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 25,
  },
  viewersAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000',
    overflow: 'hidden',
  },
  viewerAvatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  reactionsPreview: {
    marginLeft: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reactionsText: {
    fontSize: 14,
  },
  // Story overlay styles
  overlayText: {
    position: 'absolute',
    maxWidth: width - 40,
  },
  overlayTextShadow: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  overlaySticker: {
    position: 'absolute',
  },
  widgetStickerView: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    maxWidth: 180,
  },
  widgetStickerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Interactive Poll Widget styles
  pollWidget: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 16,
    minWidth: 200,
    maxWidth: 280,
  },
  pollQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  pollOption: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pollOptionSelected: {
    backgroundColor: '#e8f5e9',
    borderWidth: 2,
    borderColor: '#34C759',
  },
  pollOptionText: {
    fontSize: 15,
    color: '#333',
  },
  pollOptionTextSelected: {
    fontWeight: '600',
    color: '#34C759',
  },
  // Interactive Question Widget styles
  questionWidget: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 16,
    minWidth: 220,
    maxWidth: 300,
  },
  questionWidgetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  questionInputButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  questionInputPlaceholder: {
    fontSize: 15,
    color: '#888',
  },
  questionInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#000',
  },
  // Overlay Images
  overlayImage: {
    position: 'absolute',
  },
});
