import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import Colors from '../../../src/constants/colors';
import TabBar from '../../../src/components/TabBar';
import api, { getMediaUrl } from '../../../src/services/api';

const COVER_IMAGE = 'https://customer-assets.emergentagent.com/job_85985a78-150c-4001-8ae8-5317d7c958f4/artifacts/y8dr9eyj_Image_for_dance_theme_756727aca7.jpeg';

interface Song {
  id: string; title: string; artist: string; genre: string;
  file_url: string; duration: number; playlist_name: string | null;
}

export default function PlayerScreen() {
  const router = useRouter();
  const { id: songId } = useLocalSearchParams<{ id: string }>();
  const [song, setSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(1);
  const [speedVal, setSpeedVal] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { loadSong(); return () => unloadSound(); }, [songId]);

  const loadSong = async () => {
    try {
      const res = await api.get('/music/songs');
      const found = res.data.find((s: Song) => s.id === songId);
      if (found) { setSong(found); setDuration(found.duration || 1); await loadAudio(found); }
    } catch (e) { console.error('Load song error', e); }
  };

  const loadAudio = async (s: Song) => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
      const url = getMediaUrl(s.file_url);
      if (!url) return;
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: false });
      soundRef.current = sound;
      const st = await sound.getStatusAsync();
      if (st.isLoaded && st.durationMillis) setDuration(st.durationMillis / 1000);
    } catch (e) { console.error('Audio load error', e); }
  };

  const unloadSound = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    soundRef.current?.stopAsync().catch(() => {});
    soundRef.current?.unloadAsync().catch(() => {});
    soundRef.current = null;
  };

  const togglePlay = async () => {
    if (!soundRef.current) return;
    if (isPlaying) {
      await soundRef.current.pauseAsync();
      if (timerRef.current) clearInterval(timerRef.current);
      setIsPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setIsPlaying(true);
      timerRef.current = setInterval(async () => {
        if (isSeeking) return;
        const st = await soundRef.current?.getStatusAsync();
        if (st?.isLoaded) {
          setPosition(st.positionMillis / 1000);
          if (st.didJustFinish) { setIsPlaying(false); setPosition(0); if (timerRef.current) clearInterval(timerRef.current); }
        }
      }, 300);
    }
  };

  const onSeek = async (val: number) => {
    setPosition(val);
    if (soundRef.current) await soundRef.current.setPositionAsync(val * 1000).catch(() => {});
    setIsSeeking(false);
  };

  const onSpeedChange = async (val: number) => {
    const clamped = Math.max(-5, Math.min(5, Math.round(val)));
    setSpeedVal(clamped);
    if (soundRef.current) await soundRef.current.setRateAsync(1 + clamped * 0.1, true).catch(() => {});
  };

  const skip = async (secs: number) => {
    if (!soundRef.current) return;
    const np = Math.max(0, Math.min(position + secs, duration));
    await soundRef.current.setPositionAsync(np * 1000).catch(() => {});
    setPosition(np);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  if (!song) return (
    <View style={s.container}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
        <Text style={{ color: '#FFF' }}>Caricamento...</Text>
      </SafeAreaView>
      <TabBar />
    </View>
  );

  return (
    <View style={s.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={26} color="#FFF" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>BEAT <Text style={{ color: Colors.primary }}>MATES</Text></Text>
            <View style={{ width: 26 }} />
          </View>

          {/* Cover */}
          <View style={s.cover}>
            <Image source={{ uri: COVER_IMAGE }} style={s.coverImg} resizeMode="cover" />
            <View style={s.coverOverlay}>
              <Text style={s.coverText}>BEATMATES!</Text>
              <Text style={s.coverSub}>THE RHYTHM</Text>
            </View>
          </View>

          {/* Song info */}
          <Text style={s.title}>{song.title}</Text>
          <Text style={s.artist}>{song.artist}</Text>

          {/* TIMELINE SLIDER - Native component */}
          <View style={s.sliderRow}>
            <Text style={s.time}>{fmt(position)}</Text>
            <Slider
              style={s.slider}
              minimumValue={0}
              maximumValue={duration}
              value={position}
              onSlidingStart={() => setIsSeeking(true)}
              onSlidingComplete={onSeek}
              onValueChange={(v) => setPosition(v)}
              minimumTrackTintColor={Colors.primary}
              maximumTrackTintColor="#333"
              thumbTintColor={Colors.primary}
            />
            <Text style={s.time}>{fmt(duration)}</Text>
          </View>

          {/* Controls */}
          <View style={s.controls}>
            <TouchableOpacity onPress={() => skip(-10)}>
              <Ionicons name="play-skip-back" size={30} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={s.playBtn} onPress={togglePlay}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={34} color="#000" style={!isPlaying ? { marginLeft: 3 } : {}} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => skip(10)}>
              <Ionicons name="play-skip-forward" size={30} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* SPEED SLIDER - Native component */}
          <View style={s.speedSection}>
            <Text style={s.speedLabel}>slow down or speed up</Text>
            <View style={s.speedRow}>
              <Text style={s.speedEnd}>-5</Text>
              <Slider
                style={s.slider}
                minimumValue={-5}
                maximumValue={5}
                step={1}
                value={speedVal}
                onValueChange={(v) => setSpeedVal(v)}
                onSlidingComplete={onSpeedChange}
                minimumTrackTintColor={Colors.primary}
                maximumTrackTintColor="#333"
                thumbTintColor={Colors.primary}
              />
              <Text style={s.speedEnd}>+5</Text>
            </View>
            <Text style={s.speedValue}>{speedVal >= 0 ? '+' : ''}{speedVal * 10}% ({(1 + speedVal * 0.1).toFixed(1)}x)</Text>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      </SafeAreaView>
      <TabBar />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  cover: { marginHorizontal: 16, height: 180, borderRadius: 12, overflow: 'hidden', marginBottom: 14 },
  coverImg: { width: '100%', height: '100%' },
  coverOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  coverText: { color: '#FFD700', fontSize: 26, fontWeight: '900', letterSpacing: 3 },
  coverSub: { color: '#FF6978', fontSize: 14, fontWeight: '700', letterSpacing: 2, marginTop: 2 },
  title: { color: '#FFF', fontSize: 20, fontWeight: '700', paddingHorizontal: 16, letterSpacing: 1 },
  artist: { color: '#888', fontSize: 13, paddingHorizontal: 16, marginTop: 2, marginBottom: 16 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  time: { color: Colors.primary, fontSize: 11, width: 36, textAlign: 'center' },
  slider: { flex: 1, height: 40 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36, marginBottom: 18 },
  playBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  speedSection: { paddingHorizontal: 16, marginTop: 4, paddingBottom: 10 },
  speedLabel: { color: '#FFF', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  speedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  speedEnd: { color: Colors.primary, fontSize: 12, fontWeight: '700', width: 24, textAlign: 'center' },
  speedValue: { color: '#888', fontSize: 12, textAlign: 'center', marginTop: 8 },
});
