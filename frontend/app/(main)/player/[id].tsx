import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { WebView } from 'react-native-webview';
import Colors from '../../../src/constants/colors';
import api, { getMediaUrl } from '../../../src/services/api';

const { width: SCREEN_W } = Dimensions.get('window');

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
  const [speed, setSpeed] = useState(0); // -5 to +5, 0 = normal
  const soundRef = useRef<Audio.Sound | null>(null);
  const positionInterval = useRef<NodeJS.Timeout | null>(null);

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
    } catch (e) {
      console.error('Playback error', e);
    }
  };

  const seekTo = async (pct: number) => {
    if (!soundRef.current || duration === 0) return;
    const ms = pct * duration * 1000;
    try {
      await soundRef.current.setPositionAsync(ms);
      setPosition(pct * duration);
    } catch {}
  };

  const changeSpeed = useCallback(async (newSpeed: number) => {
    const clamped = Math.max(-5, Math.min(5, newSpeed));
    setSpeed(clamped);
    if (!soundRef.current) return;
    // Speed: 0 = 1.0x, -5 = 0.5x, +5 = 1.5x
    const rate = 1 + (clamped * 0.1);
    try {
      await soundRef.current.setRateAsync(rate, true);
    } catch (e) {
      console.log('Speed change not supported on this platform');
    }
  }, []);

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

  const progress = duration > 0 ? position / duration : 0;
  const rateLabel = speed === 0 ? '0%' : `${speed > 0 ? '+' : ''}${speed * 10}%`;

  // Generate waveform bars
  const waveformBars = useCallback(() => {
    const numBars = 60;
    const bars = [];
    for (let i = 0; i < numBars; i++) {
      // Pseudo-random but deterministic heights based on song ID
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

        {/* Cover art area */}
        <View style={styles.coverArt}>
          <View style={styles.coverGradient}>
            <Ionicons name="musical-notes" size={80} color="rgba(255,255,255,0.3)" />
            <Text style={styles.coverText}>BEATMATES!</Text>
            <Text style={styles.coverSubtext}>THE RHYTHM</Text>
          </View>
        </View>

        {/* Song title */}
        <Text style={styles.songTitle}>{song.title}</Text>
        <Text style={styles.songArtist}>{song.artist}</Text>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <Text style={styles.timeText}>{formatTime(position)}</Text>
          <TouchableOpacity
            style={styles.progressBar}
            onPress={(e) => {
              const x = e.nativeEvent.locationX;
              const barWidth = SCREEN_W - 100;
              seekTo(x / barWidth);
            }}
            activeOpacity={1}
          >
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              <View style={[styles.progressDot, { left: `${progress * 100}%` }]} />
            </View>
          </TouchableOpacity>
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
            {waveformBars().map(bar => (
              <View key={bar.key} style={[styles.waveBar, { height: bar.height }, bar.active && styles.waveBarActive]} />
            ))}
          </View>
          <View style={styles.waveformTimes}>
            <Text style={styles.waveTimeText}>{formatTime(position)}</Text>
            <Text style={styles.waveTimeText}>{formatTime(duration)}</Text>
          </View>
        </View>

        {/* Speed control */}
        <View style={styles.speedSection}>
          <Text style={styles.speedLabel}>slow down or speed up</Text>
          <View style={styles.speedRow}>
            <TouchableOpacity style={styles.speedEndBtn} onPress={() => changeSpeed(-5)}>
              <Text style={styles.speedEndText}>-5</Text>
            </TouchableOpacity>
            <View style={styles.speedSliderContainer}>
              <View style={styles.speedSliderTrack} />
              <TouchableOpacity
                style={styles.speedSliderTouchArea}
                onPress={(e) => {
                  const x = e.nativeEvent.locationX;
                  const w = SCREEN_W - 140;
                  const pct = x / w;
                  const newSpeed = Math.round(-5 + pct * 10);
                  changeSpeed(newSpeed);
                }}
                activeOpacity={1}
              >
                <View style={[styles.speedIndicator, { left: `${((speed + 5) / 10) * 100}%` }]}>
                  <Text style={styles.speedIndicatorText}>{rateLabel}</Text>
                </View>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.speedEndBtn} onPress={() => changeSpeed(5)}>
              <Text style={styles.speedEndText}>+5</Text>
            </TouchableOpacity>
          </View>
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
  coverArt: { marginHorizontal: 16, height: 220, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  coverGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a0a2e',
    // Gradient simulation
    borderWidth: 1,
    borderColor: 'rgba(255,105,120,0.3)',
  },
  coverText: { color: '#FFD700', fontSize: 28, fontWeight: '900', letterSpacing: 3, marginTop: 8 },
  coverSubtext: { color: '#FF6978', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  songTitle: { color: '#FFF', fontSize: 22, fontWeight: '700', paddingHorizontal: 16, letterSpacing: 1 },
  songArtist: { color: '#888', fontSize: 14, paddingHorizontal: 16, marginTop: 2, marginBottom: 12 },
  progressContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  timeText: { color: Colors.primary, fontSize: 11, width: 36 },
  progressBar: { flex: 1, paddingVertical: 10 },
  progressBg: { height: 3, backgroundColor: '#333', borderRadius: 1.5, position: 'relative' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 1.5 },
  progressDot: { position: 'absolute', top: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginLeft: -5 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, marginBottom: 20 },
  playButton: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  waveformContainer: { paddingHorizontal: 16, marginBottom: 16 },
  waveform: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60, gap: 2 },
  waveBar: { width: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.3)' },
  waveBarActive: { backgroundColor: '#FFF' },
  waveformTimes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  waveTimeText: { color: '#888', fontSize: 11 },
  speedSection: { paddingHorizontal: 16, marginTop: 4 },
  speedLabel: { color: '#FFF', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  speedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  speedEndBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  speedEndText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
  speedSliderContainer: { flex: 1, height: 40, justifyContent: 'center', position: 'relative' },
  speedSliderTrack: { height: 2, backgroundColor: '#666', borderRadius: 1, position: 'absolute', left: 0, right: 0 },
  speedSliderTouchArea: { flex: 1, justifyContent: 'center', position: 'relative' },
  speedIndicator: {
    position: 'absolute',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: '#000',
    transform: [{ translateX: -30 }],
  },
  speedIndicatorText: { color: '#FFF', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
