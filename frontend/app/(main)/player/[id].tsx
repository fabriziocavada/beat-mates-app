import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Image,
  LayoutChangeEvent, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import Colors from '../../../src/constants/colors';
import TabBar from '../../../src/components/TabBar';
import api, { getMediaUrl } from '../../../src/services/api';

const { width: SCREEN_W } = Dimensions.get('window');
const COVER_IMAGE = 'https://customer-assets.emergentagent.com/job_85985a78-150c-4001-8ae8-5317d7c958f4/artifacts/y8dr9eyj_Image_for_dance_theme_756727aca7.jpeg';

interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string;
  file_url: string;
  duration: number;
  playlist_name: string | null;
}

export default function PlayerScreen() {
  const router = useRouter();
  const { id: songId } = useLocalSearchParams<{ id: string }>();
  const [song, setSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedVal, setSpeedVal] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const positionInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs for bar positions (measured via onLayout)
  const progressBarRef = useRef<View>(null);
  const speedBarRef = useRef<View>(null);
  const [progressBarLayout, setProgressBarLayout] = useState({ x: 0, width: SCREEN_W - 100 });
  const [speedBarLayout, setSpeedBarLayout] = useState({ x: 0, width: SCREEN_W - 140 });

  useEffect(() => {
    loadSong();
    return () => { unloadSound(); };
  }, [songId]);

  const loadSong = async () => {
    try {
      const res = await api.get('/music/songs');
      const found = res.data.find((s: Song) => s.id === songId);
      if (found) {
        setSong(found);
        setDuration(found.duration || 0);
        await loadAudio(found);
      }
    } catch (e) { console.error('Failed to load song', e); }
  };

  const loadAudio = async (songData: Song) => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
      const url = getMediaUrl(songData.file_url);
      if (!url) return;
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: false });
      soundRef.current = sound;
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        setDuration(status.durationMillis / 1000);
      }
    } catch (e) { console.error('Failed to load audio', e); }
  };

  const unloadSound = () => {
    if (positionInterval.current) clearInterval(positionInterval.current);
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
  };

  const togglePlayback = async () => {
    if (!soundRef.current) return;
    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
        if (positionInterval.current) clearInterval(positionInterval.current);
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
        positionInterval.current = setInterval(async () => {
          if (isSeeking) return;
          try {
            const status = await soundRef.current?.getStatusAsync();
            if (status?.isLoaded) {
              setPosition(status.positionMillis / 1000);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
                if (positionInterval.current) clearInterval(positionInterval.current);
              }
            }
          } catch {}
        }, 250);
      }
    } catch (e) { console.error('Playback error', e); }
  };

  const seekTo = async (pct: number) => {
    if (!soundRef.current || duration === 0) return;
    const c = Math.max(0, Math.min(1, pct));
    try {
      await soundRef.current.setPositionAsync(c * duration * 1000);
      setPosition(c * duration);
    } catch {}
  };

  const applySpeed = async (newSpeed: number) => {
    const c = Math.max(-5, Math.min(5, newSpeed));
    setSpeedVal(c);
    if (!soundRef.current) return;
    try { await soundRef.current.setRateAsync(1 + (c * 0.1), true); } catch {}
  };

  const skipForward = async () => {
    if (!soundRef.current) return;
    const np = Math.min(position + 10, duration);
    await soundRef.current.setPositionAsync(np * 1000).catch(() => {});
    setPosition(np);
  };
  const skipBackward = async () => {
    if (!soundRef.current) return;
    const np = Math.max(position - 10, 0);
    await soundRef.current.setPositionAsync(np * 1000).catch(() => {});
    setPosition(np);
  };

  const fmt = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ============ Touch handlers using pageX (reliable on web + native) ============
  const handleProgressTouch = (pageX: number, final: boolean) => {
    const barLeft = progressBarLayout.x;
    const barW = progressBarLayout.width;
    const x = pageX - barLeft;
    const pct = Math.max(0, Math.min(1, x / barW));
    setPosition(pct * duration);
    if (final) {
      seekTo(pct);
      setIsSeeking(false);
    }
  };

  const handleSpeedTouch = (pageX: number, final: boolean) => {
    const barLeft = speedBarLayout.x;
    const barW = speedBarLayout.width;
    const x = pageX - barLeft;
    const pct = Math.max(0, Math.min(1, x / barW));
    const newSpeed = -5 + pct * 10;
    if (final) {
      applySpeed(newSpeed);
    } else {
      setSpeedVal(Math.max(-5, Math.min(5, newSpeed)));
    }
  };

  const progress = duration > 0 ? position / duration : 0;
  const speedPct = (speedVal + 5) / 10;
  const rateValue = 1 + (speedVal * 0.1);
  const speedLabel = `${speedVal >= 0 ? '+' : ''}${Math.round(speedVal * 10)}%`;

  // Waveform bars
  const waveformBars = useMemo(() => {
    const bars = [];
    for (let i = 0; i < 50; i++) {
      const seed = songId ? songId.charCodeAt(i % songId.length) : i;
      const h = 12 + ((seed * (i + 1) * 7) % 40);
      bars.push({ height: h, active: (i / 50) <= progress, key: i });
    }
    return bars;
  }, [progress, songId]);

  if (!song) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
          <Text style={{ color: '#FFF' }}>Caricamento...</Text>
        </SafeAreaView>
        <TabBar />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView style={{ flex: 1 }} bounces={false} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} data-testid="player-back-btn">
              <Ionicons name="chevron-back" size={26} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>BEAT <Text style={{ color: Colors.primary }}>MATES</Text></Text>
            <View style={{ width: 26 }} />
          </View>

          {/* Cover art */}
          <View style={styles.coverArt}>
            <Image source={{ uri: COVER_IMAGE }} style={styles.coverImage} resizeMode="cover" />
            <View style={styles.coverOverlay}>
              <Text style={styles.coverText}>BEATMATES!</Text>
              <Text style={styles.coverSubtext}>THE RHYTHM</Text>
            </View>
          </View>

          {/* Song info */}
          <Text style={styles.songTitle}>{song.title}</Text>
          <Text style={styles.songArtist}>{song.artist}</Text>

          {/* ========= PROGRESS BAR (touch-based) ========= */}
          <View style={styles.progressContainer}>
            <Text style={styles.timeText}>{fmt(position)}</Text>
            <View
              ref={progressBarRef}
              style={styles.progressBarOuter}
              onLayout={(e: LayoutChangeEvent) => {
                const { x, width } = e.nativeEvent.layout;
                // Measure absolute position on screen
                progressBarRef.current?.measureInWindow?.((px: number) => {
                  setProgressBarLayout({ x: px, width });
                });
                setProgressBarLayout(prev => ({ ...prev, width }));
              }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(e) => {
                setIsSeeking(true);
                handleProgressTouch(e.nativeEvent.pageX, false);
              }}
              onResponderMove={(e) => handleProgressTouch(e.nativeEvent.pageX, false)}
              onResponderRelease={(e) => handleProgressTouch(e.nativeEvent.pageX, true)}
            >
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
              <View style={[styles.progressDot, { left: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.timeText}>{fmt(duration)}</Text>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity onPress={skipBackward} data-testid="skip-back-btn">
              <Ionicons name="play-skip-back" size={30} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.playButton} onPress={togglePlayback} data-testid="play-pause-btn">
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={34} color="#000" style={!isPlaying ? { marginLeft: 3 } : {}} />
            </TouchableOpacity>
            <TouchableOpacity onPress={skipForward} data-testid="skip-forward-btn">
              <Ionicons name="play-skip-forward" size={30} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Waveform */}
          <View style={styles.waveformContainer}>
            <View style={styles.waveform}>
              {waveformBars.map(bar => (
                <View key={bar.key} style={[styles.waveBar, { height: bar.height }, bar.active && styles.waveBarActive]} />
              ))}
            </View>
          </View>

          {/* ========= SPEED CONTROL (touch-based) ========= */}
          <View style={styles.speedSection}>
            <Text style={styles.speedLabel}>slow down or speed up</Text>
            <View style={styles.speedRow}>
              <TouchableOpacity style={styles.speedEndBtn} onPress={() => applySpeed(-5)}>
                <Text style={styles.speedEndText}>-5</Text>
              </TouchableOpacity>
              <View
                ref={speedBarRef}
                style={styles.speedSliderOuter}
                onLayout={(e: LayoutChangeEvent) => {
                  const { width } = e.nativeEvent.layout;
                  speedBarRef.current?.measureInWindow?.((px: number) => {
                    setSpeedBarLayout({ x: px, width });
                  });
                  setSpeedBarLayout(prev => ({ ...prev, width }));
                }}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(e) => handleSpeedTouch(e.nativeEvent.pageX, false)}
                onResponderMove={(e) => handleSpeedTouch(e.nativeEvent.pageX, false)}
                onResponderRelease={(e) => handleSpeedTouch(e.nativeEvent.pageX, true)}
              >
                <View style={styles.speedTrack} />
                {/* Speed fill */}
                <View style={[styles.speedFill, {
                  left: Math.min(speedPct, 0.5) * 100 + '%',
                  width: Math.abs(speedPct - 0.5) * 100 + '%',
                }]} />
                {/* Thumb dot */}
                <View style={[styles.speedThumb, { left: `${speedPct * 100}%` }]} />
              </View>
              <TouchableOpacity style={styles.speedEndBtn} onPress={() => applySpeed(5)}>
                <Text style={styles.speedEndText}>+5</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.speedValueText}>{speedLabel} ({rateValue.toFixed(1)}x)</Text>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      </SafeAreaView>
      <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  coverArt: { marginHorizontal: 16, height: 180, borderRadius: 12, overflow: 'hidden', marginBottom: 14, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  coverText: { color: '#FFD700', fontSize: 26, fontWeight: '900', letterSpacing: 3 },
  coverSubtext: { color: '#FF6978', fontSize: 14, fontWeight: '700', letterSpacing: 2, marginTop: 2 },
  songTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', paddingHorizontal: 16, letterSpacing: 1 },
  songArtist: { color: '#888', fontSize: 13, paddingHorizontal: 16, marginTop: 2, marginBottom: 16 },

  // Progress
  progressContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 18 },
  timeText: { color: Colors.primary, fontSize: 11, width: 36, textAlign: 'center' },
  progressBarOuter: { flex: 1, height: 36, justifyContent: 'center', marginHorizontal: 6, position: 'relative' },
  progressTrack: { height: 4, backgroundColor: '#333', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  progressDot: { position: 'absolute', top: 10, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primary, marginLeft: -8, borderWidth: 2, borderColor: '#FFF' },

  // Controls
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36, marginBottom: 18 },
  playButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },

  // Waveform
  waveformContainer: { paddingHorizontal: 16, marginBottom: 16 },
  waveform: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 40, gap: 2 },
  waveBar: { width: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.15)' },
  waveBarActive: { backgroundColor: Colors.primary },

  // Speed
  speedSection: { paddingHorizontal: 16, marginTop: 4, paddingBottom: 10 },
  speedLabel: { color: '#FFF', fontSize: 13, textAlign: 'center', marginBottom: 14 },
  speedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  speedEndBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  speedEndText: { color: Colors.primary, fontSize: 10, fontWeight: '700' },
  speedSliderOuter: { flex: 1, height: 36, justifyContent: 'center', position: 'relative' },
  speedTrack: { height: 3, backgroundColor: '#333', borderRadius: 1.5, position: 'absolute', left: 0, right: 0, top: 16 },
  speedFill: { height: 3, backgroundColor: Colors.primary, borderRadius: 1.5, position: 'absolute', top: 16 },
  speedThumb: { position: 'absolute', top: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary, marginLeft: -10, borderWidth: 2, borderColor: '#FFF' },
  speedValueText: { color: '#888', fontSize: 12, textAlign: 'center', marginTop: 10 },
});
