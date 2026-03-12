import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, Dimensions,
  Animated, PanResponder, Platform, PermissionsAndroid, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '../../../src/constants/colors';
import api from '../../../src/services/api';
import { useAuthStore } from '../../../src/store/authStore';
import CoachingReview from '../../../src/components/CoachingReview';

const { width: SW, height: SH } = Dimensions.get('window');
const PIP_W = Math.round(SW * 0.30);
const PIP_H = Math.round(PIP_W * 1.4);
const TOP_BAR = 56;
const CONTENT_H = SH - TOP_BAR - 50;

async function saveActiveSession(id: string) {
  try { await AsyncStorage.setItem('active_session_id', id); } catch {}
}
async function clearActiveSession() {
  try { await AsyncStorage.removeItem('active_session_id'); } catch {}
}

// ─── Rating Modal (inline) ───
function CallRatingModal({ visible, teacherName, onSubmit, onSkip }: {
  visible: boolean; teacherName: string;
  onSubmit: (r: number, c: string) => void; onSkip: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const labels = ['', 'Scarsa', 'Sufficiente', 'Buona', 'Ottima', 'Eccellente!'];
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={rs.overlay}>
        <View style={rs.box}>
          <View style={rs.icon}><Ionicons name="videocam" size={36} color="#FFF" /></View>
          <Text style={rs.title}>Com'è andata la lezione?</Text>
          <Text style={rs.sub}>Valuta la tua esperienza con {teacherName}</Text>
          <View style={rs.stars}>
            {[1,2,3,4,5].map(s => (
              <TouchableOpacity key={s} onPress={() => setRating(s)} style={rs.starBtn}>
                <Ionicons name={s <= rating ? 'star' : 'star-outline'} size={42} color={s <= rating ? '#FFD700' : '#444'} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[rs.label, rating > 0 && { color: '#FFD700' }]}>{labels[rating] || 'Tocca per valutare'}</Text>
          {rating > 0 && (
            <TextInput style={rs.input} placeholder="Commento (opzionale)" placeholderTextColor="#666"
              value={comment} onChangeText={setComment} multiline />
          )}
          <View style={rs.btns}>
            <TouchableOpacity style={rs.skip} onPress={onSkip}><Text style={rs.skipT}>Salta</Text></TouchableOpacity>
            <TouchableOpacity style={[rs.submit, !rating && { backgroundColor: '#333' }]}
              onPress={() => rating > 0 && onSubmit(rating, comment)} disabled={!rating}>
              <Text style={rs.submitT}>Invia</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const rs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  box: { width: '100%', maxWidth: 400, backgroundColor: Colors.surface, borderRadius: 24, padding: 28, alignItems: 'center' },
  icon: { width: 68, height: 68, borderRadius: 34, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { color: '#FFF', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  sub: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  stars: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  starBtn: { padding: 2 },
  label: { color: '#666', fontSize: 15, fontWeight: '600', marginBottom: 18 },
  input: { width: '100%', backgroundColor: '#1C1C1E', borderRadius: 12, padding: 14, color: '#FFF', fontSize: 14, minHeight: 60, textAlignVertical: 'top', marginBottom: 18, borderWidth: 1, borderColor: '#333' },
  btns: { flexDirection: 'row', gap: 12, width: '100%' },
  skip: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#2C2C2E', alignItems: 'center' },
  skipT: { color: '#888', fontSize: 15, fontWeight: '600' },
  submit: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  submitT: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});

// ─── Main Screen ───
export default function VideoCallScreen() {
  const router = useRouter();
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [webViewReady, setWebViewReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [showCoaching, setShowCoaching] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const currentUser = useAuthStore(s => s.user);
  const retryCount = useRef(0);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coachPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animated WebView dimensions (ALWAYS absolute, never changes layout type)
  const webW = useRef(new Animated.Value(SW)).current;
  const webH = useRef(new Animated.Value(CONTENT_H)).current;
  const webX = useRef(new Animated.Value(0)).current;
  const webY = useRef(new Animated.Value(0)).current;
  const webRadius = useRef(new Animated.Value(0)).current;

  // PiP drag
  const pipDragOffset = useRef({ x: 0, y: 0 });
  const pipPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        webX.stopAnimation(v => { pipDragOffset.current.x = v; });
        webY.stopAnimation(v => { pipDragOffset.current.y = v; });
      },
      onPanResponderMove: (_, g) => {
        webX.setValue(pipDragOffset.current.x + g.dx);
        webY.setValue(pipDragOffset.current.y + g.dy);
      },
      onPanResponderRelease: (_, g) => {
        const curX = pipDragOffset.current.x + g.dx;
        const curY = pipDragOffset.current.y + g.dy;
        const snapX = (curX + PIP_W / 2) > SW / 2 ? SW - PIP_W - 12 : 12;
        const snapY = Math.max(12, Math.min(CONTENT_H - PIP_H - 12, curY));
        pipDragOffset.current = { x: snapX, y: snapY };
        Animated.parallel([
          Animated.spring(webX, { toValue: snapX, useNativeDriver: false, friction: 7 }),
          Animated.spring(webY, { toValue: snapY, useNativeDriver: false, friction: 7 }),
        ]).start();
      },
    })
  ).current;

  // Animate WebView between full-screen and PiP
  const animateToPiP = useCallback(() => {
    const tx = SW - PIP_W - 12;
    pipDragOffset.current = { x: tx, y: 12 };
    Animated.parallel([
      Animated.spring(webW, { toValue: PIP_W, useNativeDriver: false, friction: 8 }),
      Animated.spring(webH, { toValue: PIP_H, useNativeDriver: false, friction: 8 }),
      Animated.spring(webX, { toValue: tx, useNativeDriver: false, friction: 8 }),
      Animated.spring(webY, { toValue: 12, useNativeDriver: false, friction: 8 }),
      Animated.timing(webRadius, { toValue: 14, duration: 200, useNativeDriver: false }),
    ]).start();
  }, []);

  const animateToFull = useCallback(() => {
    Animated.parallel([
      Animated.spring(webW, { toValue: SW, useNativeDriver: false, friction: 8 }),
      Animated.spring(webH, { toValue: CONTENT_H, useNativeDriver: false, friction: 8 }),
      Animated.spring(webX, { toValue: 0, useNativeDriver: false, friction: 8 }),
      Animated.spring(webY, { toValue: 0, useNativeDriver: false, friction: 8 }),
      Animated.timing(webRadius, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  }, []);

  // Coaching toggle (sends sync command to other device)
  const openCoaching = useCallback(() => {
    setShowCoaching(true);
    animateToPiP();
    api.post(`/coaching/${sessionId}/command`, { action: 'start_coaching' }).catch(() => {});
  }, [sessionId, animateToPiP]);

  const closeCoaching = useCallback(() => {
    setShowCoaching(false);
    animateToFull();
    api.post(`/coaching/${sessionId}/command`, { action: 'stop_coaching' }).catch(() => {});
  }, [sessionId, animateToFull]);

  // Poll coaching state to sync coaching_active between devices
  useEffect(() => {
    if (!sessionId || !roomUrl) return;
    coachPollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/coaching/${sessionId}/state`);
        const s = res.data;
        if (typeof s.coaching_active === 'boolean') {
          setShowCoaching(prev => {
            if (s.coaching_active && !prev) {
              animateToPiP();
              return true;
            }
            if (!s.coaching_active && prev) {
              animateToFull();
              return false;
            }
            return prev;
          });
        }
      } catch {}
    }, 1200);
    return () => { if (coachPollRef.current) clearInterval(coachPollRef.current); };
  }, [sessionId, roomUrl, animateToPiP, animateToFull]);

  useEffect(() => {
    loadSession();
    if (sessionId) saveActiveSession(sessionId);
    return () => { if (loadTimer.current) clearTimeout(loadTimer.current); };
  }, [sessionId]);

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'web') return true;
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        const camOk = grants[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
        const micOk = grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
        if (!camOk || !micOk) {
          Alert.alert(
            'Permessi necessari',
            'Serve accesso a camera e microfono per la videolezione. Vai nelle impostazioni dell\'app per abilitarli.',
            [
              { text: 'Apri Impostazioni', onPress: () => Linking.openSettings() },
              { text: 'Annulla', style: 'cancel' },
            ]
          );
          return false;
        }
        return true;
      } catch { return false; }
    }
    // iOS: use expo-camera-like approach via react-native
    return true;
  };

  const loadSession = async () => {
    setLoading(true); setError(null);
    try {
      const permOk = await requestPermissions();
      if (!permOk) {
        setError('Servono i permessi per camera e microfono per la videolezione.');
        setLoading(false);
        return;
      }
      const res = await api.get(`/live-sessions/${sessionId}`);
      const s = res.data;
      if (s.teacher) {
        setTeacherName(s.teacher.name || s.teacher.username || 'Insegnante');
        setIsTeacher(currentUser?.id === s.teacher_id);
      }
      if (s.room_url) setRoomUrl(s.room_url);
      else if (s.status === 'completed') setError('Questa lezione è già terminata.');
      else setError('La sessione non è ancora attiva');
    } catch {
      if (retryCount.current < 3) { retryCount.current++; setTimeout(loadSession, 2000); return; }
      setError('Impossibile caricare la sessione. Controlla la connessione.');
    } finally { setLoading(false); }
  };

  const handleEndCall = useCallback(() => {
    Alert.alert(
      'Termina lezione',
      'Sei sicuro di voler abbandonare la videolezione? Non potrai rientrare.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Termina', style: 'destructive', onPress: async () => {
          setShowCoaching(false);
          animateToFull();
          try { await api.post(`/live-sessions/${sessionId}/end`); } catch {}
          await clearActiveSession();
          setShowRating(true);
        }},
      ]
    );
  }, [sessionId, animateToFull]);

  const onRatingSubmit = useCallback(async (r: number, c: string) => {
    try { await api.post(`/live-sessions/${sessionId}/review`, { rating: r, text: c }); } catch {}
    setShowRating(false);
    router.replace('/(main)/home');
  }, [sessionId, router]);

  const onRatingSkip = useCallback(() => {
    setShowRating(false);
    router.replace('/(main)/home');
  }, [router]);

  const onWebViewLoadEnd = useCallback(() => {
    setWebViewReady(true);
    if (loadTimer.current) clearTimeout(loadTimer.current);
  }, []);

  useEffect(() => {
    if (roomUrl && !webViewReady) {
      loadTimer.current = setTimeout(() => setWebViewReady(true), 15000);
    }
    return () => { if (loadTimer.current) clearTimeout(loadTimer.current); };
  }, [roomUrl, webViewReady]);

  if (loading) return (
    <View style={st.center}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={st.statusText}>Connessione alla lezione...</Text>
    </View>
  );

  if (error || !roomUrl) return (
    <View style={st.center}>
      <Ionicons name="videocam-off-outline" size={64} color="#666" />
      <Text style={st.statusText}>{error || 'Stanza non disponibile'}</Text>
      <TouchableOpacity style={st.retryBtn} onPress={() => { retryCount.current = 0; loadSession(); }}>
        <Text style={st.retryBtnText}>Riprova</Text>
      </TouchableOpacity>
      <TouchableOpacity style={st.backBtn} onPress={() => { clearActiveSession(); router.replace('/(main)/home'); }}>
        <Text style={st.backBtnText}>Torna alla home</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Top bar */}
        <View style={st.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={st.topBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={st.topTitle}>Lezione Live</Text>
          <View style={st.topActions}>
            <TouchableOpacity
              onPress={showCoaching ? closeCoaching : openCoaching}
              style={[st.coachingBtn, showCoaching && { backgroundColor: Colors.primary }]}
              data-testid="coaching-toggle-btn"
            >
              <Ionicons name="analytics" size={20} color="#FFF" />
            </TouchableOpacity>
            <View style={{ width: 20 }} />
            <TouchableOpacity onPress={handleEndCall} style={st.endBtn} data-testid="end-call-btn">
              <Ionicons name="call" size={20} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          {/* Coaching overlay */}
          {showCoaching && (
            <View style={StyleSheet.absoluteFill}>
              <CoachingReview
                sessionId={sessionId || ''}
                isTeacher={isTeacher}
                onClose={closeCoaching}
              />
            </View>
          )}

          {/* WebView (always absolute, animated dimensions) */}
          <Animated.View
            collapsable={false}
            style={{
              position: 'absolute',
              width: webW,
              height: webH,
              left: webX,
              top: webY,
              borderRadius: webRadius,
              overflow: 'hidden',
              zIndex: showCoaching ? 25 : 1,
              borderWidth: showCoaching ? 2 : 0,
              borderColor: 'rgba(255,255,255,0.3)',
              backgroundColor: '#111',
            }}
            {...(showCoaching ? pipPan.panHandlers : {})}
          >
            <WebView
              source={{ uri: roomUrl }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback
              allowsFullscreenVideo
              mediaCapturePermissionGrantType="grant"
              nestedScrollEnabled
              overScrollMode="never"
              bounces={false}
              onLoadEnd={onWebViewLoadEnd}
              originWhitelist={['*']}
              userAgent="Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36"
              injectedJavaScriptBeforeContentLoaded={`
                (function() {
                  // Auto-grant permissions so Daily.co skips its permission dialog
                  var origQuery = navigator.permissions && navigator.permissions.query;
                  if (navigator.permissions) {
                    navigator.permissions.query = function(desc) {
                      if (desc.name === 'camera' || desc.name === 'microphone') {
                        return Promise.resolve({ state: 'granted', onchange: null });
                      }
                      return origQuery ? origQuery.call(navigator.permissions, desc) : Promise.resolve({ state: 'granted' });
                    };
                  }
                })();
                true;
              `}
            />
          </Animated.View>

          {/* Loading overlay */}
          {!webViewReady && !showCoaching && (
            <View style={st.overlay} pointerEvents="none">
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={st.statusText}>Caricamento videochiamata...</Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      <CallRatingModal visible={showRating} teacherName={teacherName} onSubmit={onRatingSubmit} onSkip={onRatingSkip} />
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  statusText: { color: '#FFF', fontSize: 16, marginTop: 12, textAlign: 'center' },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: Colors.primary, borderRadius: 12 },
  retryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  backBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: '#333', borderRadius: 12 },
  backBtnText: { color: '#FFF', fontSize: 14 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: TOP_BAR, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 30 },
  topBtn: { padding: 8 },
  topTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  topActions: { flexDirection: 'row', alignItems: 'center' },
  coachingBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  endBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', zIndex: 5 },
});
