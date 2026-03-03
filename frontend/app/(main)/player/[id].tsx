import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, PanResponder, Image,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import Colors from '../../../src/constants/colors';
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
  const [speed, setSpeed] = useState(0); // continuous float -5 to +5
  const [isSeeking, setIsSeeking] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const positionInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Layout widths for sliders
  const [progressBarWidth, setProgressBarWidth] = useState(SCREEN_W - 100);
  const [speedBarWidth, setSpeedBarWidth] = useState(SCREEN_W - 140);

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
    } catch (e) {
      console.error('Failed to load song', e);
    }
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
    } catch (e) {
      console.error('Failed to load audio', e);
    }
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
        }, 200);
      }
    } catch (e) {
      console.error('Playback error', e);
    }
  };

  const seekTo = async (pct: number) => {
    if (!soundRef.current || duration === 0) return;
    const clamped = Math.max(0, Math.min(1, pct));
    const ms = clamped * duration * 1000;
    try {
      await soundRef.current.setPositionAsync(ms);
      setPosition(clamped * duration);
    } catch {}
  };

  const applySpeed = async (newSpeed: number) => {
    const clamped = Math.max(-5, Math.min(5, newSpeed));
    setSpeed(clamped);
    if (!soundRef.current) return;
    const rate = 1 + (clamped * 0.1);
    try {
      await soundRef.current.setRateAsync(rate, true);
    } catch {}
  };

  const skipForward = async () => {
    if (!soundRef.current) return;
    const newPos = Math.min(position + 10, duration);
    await soundRef.current.setPositionAsync(newPos * 1000);
    setPosition(newPos);
  };

  const skipBackward = async () => {
    if (!soundRef.current) return;
    const newPos = Math.max(position - 10, 0);
    await soundRef.current.setPositionAsync(newPos * 1000);
    setPosition(newPos);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ========= PROGRESS BAR PanResponder =========
  const progressPanResponder = useMemo(() => {
    let barX = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsSeeking(true);
        const x = evt.nativeEvent.locationX;
        const pct = x / progressBarWidth;
        setPosition(Math.max(0, Math.min(1, pct)) * duration);
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const pct = x / progressBarWidth;
        const clampedPct = Math.max(0, Math.min(1, pct));
        setPosition(clampedPct * duration);
      },
      onPanResponderRelease: (evt) => {
        const x = evt.nativeEvent.locationX;
        const pct = Math.max(0, Math.min(1, x / progressBarWidth));
        seekTo(pct);
        setIsSeeking(false);
      },
    });
  }, [progressBarWidth, duration]);

  // ========= SPEED SLIDER PanResponder =========
  const speedPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const pct = x / speedBarWidth;
        const newSpeed = -5 + (Math.max(0, Math.min(1, pct)) * 10);
        setSpeed(newSpeed);
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const pct = x / speedBarWidth;
        const newSpeed = -5 + (Math.max(0, Math.min(1, pct)) * 10);
        setSpeed(newSpeed);
      },
      onPanResponderRelease: (evt) => {
        const x = evt.nativeEvent.locationX;
        const pct = Math.max(0, Math.min(1, x / speedBarWidth));
        const finalSpeed = -5 + pct * 10;
        applySpeed(finalSpeed);
      },
    });
  }, [speedBarWidth]);

  const progress = duration > 0 ? position / duration : 0;
  const speedPct = (speed + 5) / 10; // 0 to 1
  const rateValue = 1 + (speed * 0.1);
  const rateLabel = speed === 0 ? '1.0x' : `${rateValue.toFixed(1)}x`;
  const speedPercentLabel = `${speed >= 0 ? '+' : ''}${Math.round(speed * 10)}%`;

  // Waveform bars
  const waveformBars = useMemo(() => {
    const numBars = 60;
    const bars = [];
    for (let i = 0; i < numBars; i++) {
      const seed = songId ? songId.charCodeAt(i % songId.length) : i;
      const h = 15 + ((seed * (i + 1) * 7) % 45);
      const isActive = (i / numBars) <= progress;
      bars.push({ height: h, active: isActive, key: i });
    }
    return bars;
  }, [progress, songId]);

  if (!song) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#FFF' }}>Caricamento...</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="search" size={22} color="#FFF" />
          <Text style={styles.headerTitle}>BEAT <Text style={{ color: Colors.primary }}>MATES</Text></Text>
          <View style={styles.headerRight}>
            <Ionicons name="heart-outline" size={22} color="#FFF" />
            <Ionicons name="paper-plane-outline" size={22} color="#FFF" style={{ marginLeft: 16 }} />
          </View>
        </View>

        {/* Playlist info */}
        <View style={styles.playlistInfo}>
          <Text style={styles.playlistLabel}>PLAYING FROM PLAYLIST:</Text>
          <Text style={styles.playlistName}>{song.playlist_name || song.genre}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} data-testid="player-close-btn">
            <Ionicons name="close" size={26} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Cover art with real image */}
        <View style={styles.coverArt}>
          <Image source={{ uri: COVER_IMAGE }} style={styles.coverImage} resizeMode="cover" />
          <View style={styles.coverOverlay}>
            <Text style={styles.coverText}>BEATMATES!</Text>
            <Text style={styles.coverSubtext}>THE RHYTHM</Text>
          </View>
        </View>

        {/* Song title */}
        <Text style={styles.songTitle}>{song.title}</Text>
        <Text style={styles.songArtist}>{song.artist}</Text>

        {/* Progress bar - PanResponder based for smooth dragging */}
        <View style={styles.progressContainer}>
          <Text style={styles.timeText}>{formatTime(position)}</Text>
          <View
            style={styles.progressBar}
            onLayout={(e: LayoutChangeEvent) => setProgressBarWidth(e.nativeEvent.layout.width)}
            {...progressPanResponder.panHandlers}
          >
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              <View style={[styles.progressDot, { left: `${progress * 100}%` }]} />
            </View>
          </View>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={() => {}}>
            <Ionicons name="shuffle" size={24} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity onPress={skipBackward}>
            <Ionicons name="play-skip-back" size={32} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playButton} onPress={togglePlayback} data-testid="play-pause-btn">
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color="#000" style={!isPlaying ? { marginLeft: 4 } : {}} />
          </TouchableOpacity>
          <TouchableOpacity onPress={skipForward}>
            <Ionicons name="play-skip-forward" size={32} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Waveform */}
        <View style={styles.waveformContainer}>
          <View style={styles.waveform}>
            {waveformBars.map(bar => (
              <View key={bar.key} style={[styles.waveBar, { height: bar.height }, bar.active && styles.waveBarActive]} />
            ))}
          </View>
          <View style={styles.waveformTimes}>
            <Text style={styles.waveTimeText}>{formatTime(position)}</Text>
            <Text style={styles.waveTimeText}>{formatTime(duration)}</Text>
          </View>
        </View>

        {/* Speed control - PanResponder based for smooth dragging */}
        <View style={styles.speedSection}>
          <Text style={styles.speedLabel}>slow down or speed up</Text>
          <View style={styles.speedRow}>
            <TouchableOpacity style={styles.speedEndBtn} onPress={() => applySpeed(-5)}>
              <Text style={styles.speedEndText}>-5</Text>
            </TouchableOpacity>
            <View
              style={styles.speedSliderContainer}
              onLayout={(e: LayoutChangeEvent) => setSpeedBarWidth(e.nativeEvent.layout.width)}
              {...speedPanResponder.panHandlers}
            >
              <View style={styles.speedSliderTrack} />
              {/* Speed indicator pill */}
              <View style={[styles.speedIndicator, { left: `${speedPct * 100}%` }]}>
                <Text style={styles.speedIndicatorText}>{speedPercentLabel}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.speedEndBtn} onPress={() => applySpeed(5)}>
              <Text style={styles.speedEndText}>+5</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.speedRateText}>{rateLabel}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  headerRight: { flexDirection: 'row' },
  playlistInfo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  playlistLabel: { color: '#888', fontSize: 10, letterSpacing: 1 },
  playlistName: { color: Colors.primary, fontSize: 14, fontWeight: '600', marginLeft: 6, flex: 1 },
  closeBtn: { padding: 4 },
  coverArt: { marginHorizontal: 16, height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 16, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  coverText: { color: '#FFD700', fontSize: 28, fontWeight: '900', letterSpacing: 3 },
  coverSubtext: { color: '#FF6978', fontSize: 16, fontWeight: '700', letterSpacing: 2, marginTop: 2 },
  songTitle: { color: '#FFF', fontSize: 22, fontWeight: '700', paddingHorizontal: 16, letterSpacing: 1 },
  songArtist: { color: '#888', fontSize: 14, paddingHorizontal: 16, marginTop: 2, marginBottom: 12 },
  progressContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  timeText: { color: Colors.primary, fontSize: 11, width: 36, textAlign: 'center' },
  progressBar: { flex: 1, height: 30, justifyContent: 'center', marginHorizontal: 4 },
  progressBg: { height: 4, backgroundColor: '#333', borderRadius: 2, position: 'relative' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  progressDot: { position: 'absolute', top: -6, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primary, marginLeft: -8, borderWidth: 2, borderColor: '#FFF' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, marginBottom: 16 },
  playButton: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  waveformContainer: { paddingHorizontal: 16, marginBottom: 12 },
  waveform: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, gap: 2 },
  waveBar: { width: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.2)' },
  waveBarActive: { backgroundColor: Colors.primary },
  waveformTimes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  waveTimeText: { color: '#888', fontSize: 11 },
  speedSection: { paddingHorizontal: 16, marginTop: 4 },
  speedLabel: { color: '#FFF', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  speedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  speedEndBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  speedEndText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
  speedSliderContainer: { flex: 1, height: 44, justifyContent: 'center', position: 'relative' },
  speedSliderTrack: { height: 3, backgroundColor: '#444', borderRadius: 1.5, position: 'absolute', left: 0, right: 0 },
  speedIndicator: {
    position: 'absolute',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: '#111',
    transform: [{ translateX: -28 }],
  },
  speedIndicatorText: { color: '#FFF', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  speedRateText: { color: '#888', fontSize: 12, textAlign: 'center', marginTop: 8 },
});
