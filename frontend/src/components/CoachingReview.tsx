import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  ActivityIndicator, PanResponder, Alert, GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import api, { getVideoPlayerUrl } from '../services/api';
import Colors from '../constants/colors';

const { width: SW } = Dimensions.get('window');
const TIMELINE_H_PAD = 48; // left text + right text space

interface CoachingReviewProps {
  sessionId: string;
  isTeacher: boolean;
  onClose: () => void;
}

interface DrawPath {
  d: string;
  color: string;
}

export default function CoachingReview({ sessionId, isTeacher, onClose }: CoachingReviewProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(20);
  const [speed, setSpeed] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [drawings, setDrawings] = useState<DrawPath[]>([]);
  const [drawColor, setDrawColor] = useState('#FF6978');
  const [toolActive, setToolActive] = useState(false);
  const [liveStroke, setLiveStroke] = useState(''); // current drawing path while finger is down

  const webRef = useRef<WebView>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs to avoid stale closures in PanResponder
  const drawColorRef = useRef(drawColor);
  const toolActiveRef = useRef(toolActive);

  useEffect(() => { drawColorRef.current = drawColor; }, [drawColor]);
  useEffect(() => { toolActiveRef.current = toolActive; }, [toolActive]);

  // Student polls teacher's state (including initial video URL)
  useEffect(() => {
    if (isTeacher) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/coaching/${sessionId}/state`);
        const s = res.data;
        if (s.video_url) setVideoUrl(s.video_url);
        if (typeof s.is_playing === 'boolean') {
          setIsPlaying(prev => {
            if (prev !== s.is_playing) {
              webRef.current?.injectJavaScript(
                `var v=document.getElementById('v');if(v){${s.is_playing ? 'v.play()' : 'v.pause()'}}true;`
              );
            }
            return s.is_playing;
          });
        }
        if (typeof s.current_time === 'number') {
          setCurrentTime(prev => {
            if (Math.abs(prev - s.current_time) > 0.5) {
              webRef.current?.injectJavaScript(
                `var v=document.getElementById('v');if(v)v.currentTime=${s.current_time};true;`
              );
              return s.current_time;
            }
            return prev;
          });
        }
        if (typeof s.speed === 'number') {
          setSpeed(prev => {
            if (prev !== s.speed) {
              webRef.current?.injectJavaScript(
                `var v=document.getElementById('v');if(v)v.playbackRate=${s.speed};true;`
              );
            }
            return s.speed;
          });
        }
        if (Array.isArray(s.drawings)) {
          setDrawings(s.drawings.map((d: string) => {
            try { return JSON.parse(d); } catch { return { d: '', color: '#FFF' }; }
          }));
        }
      } catch {}
    }, 600);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isTeacher, sessionId]);

  // Record clip via camera
  const handleRecord = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permesso necessario', 'Serve accesso alla fotocamera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 20,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadClip(result.assets[0]);
  };

  // Upload from gallery
  const handleUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 30,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadClip(result.assets[0]);
  };

  const uploadClip = async (asset: ImagePicker.ImagePickerAsset) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: 'video/mp4',
        name: 'coaching_clip.mp4',
      } as any);
      const res = await api.post(`/coaching/${sessionId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      setVideoUrl(res.data.video_url);
      setDuration(asset.duration ? asset.duration / 1000 : 20);
    } catch (e) {
      Alert.alert('Errore', 'Upload del video fallito. Riprova.');
    } finally {
      setIsUploading(false);
    }
  };

  // Teacher sends commands to sync with student
  const sendCommand = useCallback(async (action: string, value?: string) => {
    if (!isTeacher) return;
    try {
      await api.post(`/coaching/${sessionId}/command`, { action, value });
    } catch {}
  }, [isTeacher, sessionId]);

  const handleSeek = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(duration, time));
    setCurrentTime(clamped);
    webRef.current?.injectJavaScript(`var v=document.getElementById('v');if(v)v.currentTime=${clamped};true;`);
    if (isTeacher) sendCommand('seek', String(clamped));
  }, [duration, isTeacher, sendCommand]);

  const handleSpeed = useCallback((s: number) => {
    setSpeed(s);
    webRef.current?.injectJavaScript(`var v=document.getElementById('v');if(v)v.playbackRate=${s};true;`);
    if (isTeacher) sendCommand('speed', String(s));
  }, [isTeacher, sendCommand]);

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => {
      const next = !prev;
      webRef.current?.injectJavaScript(
        `var v=document.getElementById('v');if(v){${next ? 'v.play()' : 'v.pause()'}}true;`
      );
      if (isTeacher) sendCommand(next ? 'play' : 'pause');
      return next;
    });
  }, [isTeacher, sendCommand]);

  const clearDrawings = useCallback(() => {
    setDrawings([]);
    if (isTeacher) sendCommand('clear_drawings');
  }, [isTeacher, sendCommand]);

  const undoDrawing = useCallback(() => {
    setDrawings(prev => {
      const next = prev.slice(0, -1);
      // For undo, we send the full remaining drawings array... or just clear and re-draw
      // Simpler: send clear + redraw all remaining
      if (isTeacher) {
        sendCommand('clear_drawings');
        next.forEach(p => sendCommand('draw', JSON.stringify(p)));
      }
      return next;
    });
  }, [isTeacher, sendCommand]);

  // Ref for the live stroke path string (avoids re-creating PanResponder)
  const liveStrokeRef = useRef('');

  // Drawing PanResponder - both teacher and student can draw
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => toolActiveRef.current,
      onMoveShouldSetPanResponder: () => toolActiveRef.current,
      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        liveStrokeRef.current = `M${x.toFixed(1)},${y.toFixed(1)}`;
        setLiveStroke(liveStrokeRef.current);
      },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        liveStrokeRef.current += ` L${x.toFixed(1)},${y.toFixed(1)}`;
        setLiveStroke(liveStrokeRef.current);
      },
      onPanResponderRelease: () => {
        const pathD = liveStrokeRef.current;
        if (pathD) {
          const newPath: DrawPath = { d: pathD, color: drawColorRef.current };
          setDrawings(prev => [...prev, newPath]);
          // Sync to student
          api.post(`/coaching/${sessionId}/command`, { action: 'draw', value: JSON.stringify(newPath) }).catch(() => {});
        }
        liveStrokeRef.current = '';
        setLiveStroke('');
      },
    })
  ).current;

  // Build player URL
  const playerUrl = videoUrl ? getVideoPlayerUrl(videoUrl, { controls: false, muted: true, autoplay: false, fit: 'contain' }) : '';

  // Time tracking from WebView
  const handleMessage = useCallback((e: any) => {
    const msg = e.nativeEvent.data;
    if (msg.startsWith('time:')) {
      const t = parseFloat(msg.split(':')[1]) || 0;
      setCurrentTime(t);
    } else if (msg.startsWith('duration:')) {
      setDuration(parseFloat(msg.split(':')[1]) || 20);
    }
  }, []);

  // Timeline tap handler
  const onTimelineTap = useCallback((e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    const width = SW - TIMELINE_H_PAD - 32; // approximate usable width
    const pct = Math.max(0, Math.min(1, x / width));
    handleSeek(pct * duration);
  }, [duration, handleSeek]);

  // === EMPTY STATE: No video yet ===
  if (!videoUrl) {
    return (
      <View style={st.container}>
        <View style={st.header}>
          <Text style={st.title}>Coaching Review</Text>
          <TouchableOpacity onPress={onClose} style={st.closeBtn} data-testid="coaching-close-btn">
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
        <View style={st.emptyState}>
          {isUploading ? (
            <>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={st.emptyText}>Caricamento e compressione video...</Text>
              <Text style={st.emptySubText}>Potrebbe richiedere qualche secondo</Text>
            </>
          ) : (
            <>
              <Ionicons name="videocam-outline" size={56} color="#555" />
              <Text style={st.emptyText}>Registra o carica un video da analizzare insieme</Text>
              <TouchableOpacity style={st.recordBtn} onPress={handleRecord} data-testid="coaching-record-btn">
                <Ionicons name="radio-button-on" size={22} color="#FFF" />
                <Text style={st.recordBtnText}>Registra clip (max 20s)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.uploadBtn} onPress={handleUpload} data-testid="coaching-upload-btn">
                <Ionicons name="cloud-upload-outline" size={18} color="#FFF" />
                <Text style={st.uploadBtnText}>Carica dalla galleria</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  // === VIDEO LOADED: Review player ===
  const speeds = [0.25, 0.5, 0.75, 1];
  const colors = ['#FF6978', '#4CD964', '#007AFF', '#FFD700', '#FFF'];
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View style={st.container}>
      {/* Header */}
      <View style={st.header}>
        <Text style={st.title}>Coaching Review</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setToolActive(!toolActive)}
            style={[st.toolToggle, toolActive && { backgroundColor: Colors.primary }]}
            data-testid="coaching-draw-toggle"
          >
            <Ionicons name="brush" size={16} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={st.closeBtn} data-testid="coaching-close-btn">
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Video + Drawing Overlay */}
      <View style={st.playerArea} {...(toolActive ? panResponder.panHandlers : {})}>
        <WebView
          ref={webRef}
          source={{ uri: playerUrl }}
          style={st.webview}
          scrollEnabled={false}
          bounces={false}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          originWhitelist={['*']}
          pointerEvents={toolActive ? 'none' : 'auto'}
          onMessage={handleMessage}
          injectedJavaScript={`
            var v=document.getElementById('v');
            if(v){
              v.playbackRate=${speed};
              setInterval(function(){
                window.ReactNativeWebView.postMessage('time:'+v.currentTime);
              },250);
              v.addEventListener('loadedmetadata',function(){
                window.ReactNativeWebView.postMessage('duration:'+v.duration);
              });
            }true;
          `}
        />
        {/* SVG Drawing overlay */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {drawings.map((p, i) => (
            <Path key={`${i}-${p.d.length}`} d={p.d} stroke={p.color} strokeWidth={3} fill="none" strokeLinecap="round" />
          ))}
          {liveStroke ? (
            <Path d={liveStroke} stroke={drawColor} strokeWidth={3} fill="none" strokeLinecap="round" />
          ) : null}
        </Svg>
        {/* Drawing active indicator */}
        {toolActive && (
          <View style={st.drawIndicator}>
            <View style={[st.drawDot, { backgroundColor: drawColor }]} />
            <Text style={st.drawLabel}>Disegno attivo</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={st.controls}>
        {/* Play / Skip / Speed */}
        <View style={st.controlRow}>
          <TouchableOpacity onPress={() => handleSeek(Math.max(0, currentTime - 2))} style={st.ctrlBtn} data-testid="coaching-skip-back">
            <Ionicons name="play-back" size={18} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={togglePlay} style={st.playBtn} data-testid="coaching-play-btn">
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleSeek(Math.min(duration, currentTime + 2))} style={st.ctrlBtn} data-testid="coaching-skip-forward">
            <Ionicons name="play-forward" size={18} color="#FFF" />
          </TouchableOpacity>
          <View style={st.speedRow}>
            {speeds.map(sp => (
              <TouchableOpacity
                key={sp}
                onPress={() => handleSpeed(sp)}
                style={[st.speedBtn, speed === sp && { backgroundColor: Colors.primary }]}
                data-testid={`coaching-speed-${sp}`}
              >
                <Text style={[st.speedText, speed === sp && { color: '#FFF' }]}>{sp}x</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Timeline */}
        <View style={st.timelineRow}>
          <Text style={st.timeText}>{currentTime.toFixed(1)}s</Text>
          <TouchableOpacity
            activeOpacity={1}
            style={st.timelineTouch}
            onPress={onTimelineTap}
            data-testid="coaching-timeline"
          >
            <View style={st.timelineTrack}>
              <View style={[st.timelineFill, { width: `${Math.min(100, progressPct)}%` }]} />
            </View>
            <View style={[st.timelineThumb, { left: `${Math.min(100, progressPct)}%` }]} />
          </TouchableOpacity>
          <Text style={st.timeText}>{duration.toFixed(1)}s</Text>
        </View>

        {/* Drawing tools (both teacher and student) */}
        {toolActive && (
          <View style={st.drawTools}>
            {colors.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => setDrawColor(c)}
                style={[st.colorBtn, { backgroundColor: c }, drawColor === c && st.colorActive]}
                data-testid={`coaching-color-${c}`}
              />
            ))}
            <TouchableOpacity onPress={undoDrawing} style={st.undoBtn} data-testid="coaching-undo-btn">
              <Ionicons name="arrow-undo" size={16} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={clearDrawings} style={st.clearBtn} data-testid="coaching-clear-btn">
              <Ionicons name="trash-outline" size={16} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}

        {/* Role label */}
        <View style={st.roleRow}>
          <View style={[st.roleBadge, { backgroundColor: isTeacher ? Colors.primary : '#333' }]}>
            <Ionicons name={isTeacher ? 'school' : 'person'} size={12} color="#FFF" />
            <Text style={st.roleText}>{isTeacher ? 'Insegnante' : 'Studente'}</Text>
          </View>
          {!isTeacher && (
            <Text style={st.syncLabel}>Controlli sincronizzati con l'insegnante</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  title: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  closeBtn: { padding: 4 },
  toolToggle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },

  // Empty state
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  emptyText: { color: '#999', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptySubText: { color: '#666', fontSize: 12, textAlign: 'center' },
  recordBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FF3B30', paddingHorizontal: 22, paddingVertical: 13, borderRadius: 28 },
  recordBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#222', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 20 },
  uploadBtnText: { color: '#CCC', fontSize: 13 },

  // Player
  playerArea: { flex: 1, backgroundColor: '#000', position: 'relative' },
  webview: { flex: 1 },
  drawIndicator: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  drawDot: { width: 10, height: 10, borderRadius: 5 },
  drawLabel: { color: '#FFF', fontSize: 11, fontWeight: '600' },

  // Controls
  controls: { backgroundColor: '#0a0a1a', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  ctrlBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  speedRow: { flexDirection: 'row', gap: 4, marginLeft: 'auto' },
  speedBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: '#1c1c2e' },
  speedText: { color: '#777', fontSize: 11, fontWeight: '700' },

  // Timeline
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  timeText: { color: '#777', fontSize: 10, width: 34, textAlign: 'center', fontVariant: ['tabular-nums'] },
  timelineTouch: { flex: 1, height: 24, justifyContent: 'center', position: 'relative' },
  timelineTrack: { height: 4, backgroundColor: '#222', borderRadius: 2, overflow: 'hidden' },
  timelineFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  timelineThumb: { position: 'absolute', top: 4, width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFF', marginLeft: -7 },

  // Drawing tools
  drawTools: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#1a1a2e' },
  colorBtn: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  colorActive: { borderColor: '#FFF', transform: [{ scale: 1.15 }] },
  undoBtn: { padding: 6, backgroundColor: '#1c1c2e', borderRadius: 12 },
  clearBtn: { marginLeft: 'auto', padding: 6 },

  // Role badge
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  roleText: { color: '#FFF', fontSize: 10, fontWeight: '600' },
  syncLabel: { color: '#555', fontSize: 10, fontStyle: 'italic' },
});
