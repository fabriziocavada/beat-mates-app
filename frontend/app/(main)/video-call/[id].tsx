import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, Dimensions,
  Platform, PermissionsAndroid, Linking, StatusBar, BackHandler,
  Animated, PanResponder,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '../../../src/constants/colors';
import api from '../../../src/services/api';
import { useAuthStore } from '../../../src/store/authStore';
import CoachingReview from '../../../src/components/CoachingReview';

const { width: SW, height: SH } = Dimensions.get('window');
const IS_ANDROID = Platform.OS === 'android';
const PIP_W = 120;
const PIP_H = 170;

async function saveActiveSession(id: string) {
  try { await AsyncStorage.setItem('active_session_id', id); } catch {}
}
async function clearActiveSession() {
  try { await AsyncStorage.removeItem('active_session_id'); } catch {}
}

// ---- Rating Modal ----
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
          <Text style={rs.title}>Com'e andata la lezione?</Text>
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

// ---- Main Screen ----
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
  const [androidCallActive, setAndroidCallActive] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const currentUser = useAuthStore(s => s.user);
  const retryCount = useRef(0);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coachPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // PiP dragging for coaching mode
  const pipPos = useRef(new Animated.ValueXY({ x: SW - PIP_W - 12, y: 50 })).current;
  const pipPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pipPos.setOffset({ x: (pipPos.x as any)._value, y: (pipPos.y as any)._value });
        pipPos.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pipPos.x, dy: pipPos.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => { pipPos.flattenOffset(); },
    })
  ).current;

  // Block hardware back button during call (WhatsApp-like)
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (roomUrl || androidCallActive) {
        handleEndCall();
        return true; // prevent default back
      }
      return false;
    });
    return () => handler.remove();
  }, [roomUrl, androidCallActive]);

  // Auto-hide controls after 4 seconds
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  useEffect(() => {
    if (roomUrl && webViewReady && !showCoaching) resetControlsTimer();
    return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); };
  }, [roomUrl, webViewReady, showCoaching]);

  // Coaching toggle
  const openCoaching = useCallback(() => {
    setShowCoaching(true);
    setShowControls(true);
    api.post(`/coaching/${sessionId}/command`, { action: 'start_coaching' }).catch(() => {});
  }, [sessionId]);

  const closeCoaching = useCallback(() => {
    setShowCoaching(false);
    resetControlsTimer();
    api.post(`/coaching/${sessionId}/command`, { action: 'stop_coaching' }).catch(() => {});
  }, [sessionId]);

  // Poll coaching state
  useEffect(() => {
    if (!sessionId || (!roomUrl && !androidCallActive)) return;
    coachPollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/coaching/${sessionId}/state`);
        const s = res.data;
        if (typeof s.coaching_active === 'boolean') {
          setShowCoaching(prev => {
            if (s.coaching_active && !prev) return true;
            if (!s.coaching_active && prev) return false;
            return prev;
          });
        }
      } catch {}
    }, 1200);
    return () => { if (coachPollRef.current) clearInterval(coachPollRef.current); };
  }, [sessionId, roomUrl, androidCallActive]);

  const requestAndroidPermissions = async (): Promise<boolean> => {
    try {
      const grants = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
      const camOk = grants[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
      const micOk = grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
      if (!camOk || !micOk) {
        Alert.alert('Permessi necessari', 'Serve accesso a camera e microfono.',
          [{ text: 'Apri Impostazioni', onPress: () => Linking.openSettings() }, { text: 'Annulla', style: 'cancel' }]);
        return false;
      }
      return true;
    } catch { return false; }
  };

  const buildRoomUrl = async (session: any): Promise<string | null> => {
    if (!session.room_url) return null;
    let finalUrl = session.room_url;
    if (session.room_name) {
      try {
        const tokenRes = await api.post(`/video-call/token?room_name=${session.room_name}`);
        if (tokenRes.data?.token) finalUrl = `${session.room_url}?t=${tokenRes.data.token}`;
      } catch {}
    }
    return finalUrl;
  };

  useEffect(() => {
    loadSession();
    if (sessionId) saveActiveSession(sessionId);
    return () => { if (loadTimer.current) clearTimeout(loadTimer.current); };
  }, [sessionId]);

  const loadSession = async () => {
    setLoading(true); setError(null);
    try {
      if (IS_ANDROID) {
        const permOk = await requestAndroidPermissions();
        if (!permOk) { setError('Servono i permessi per camera e microfono.'); setLoading(false); return; }
      }
      const res = await api.get(`/live-sessions/${sessionId}`);
      const s = res.data;
      if (s.teacher) {
        setTeacherName(s.teacher.name || s.teacher.username || 'Insegnante');
        setIsTeacher(currentUser?.id === s.teacher_id);
      }
      if (s.room_url) {
        const finalUrl = await buildRoomUrl(s);
        if (!finalUrl) { setError('URL della stanza non disponibile'); return; }
        if (IS_ANDROID) {
          setLoading(false);
          setAndroidCallActive(true);
          try {
            await WebBrowser.openBrowserAsync(finalUrl, { dismissButtonStyle: 'close', showTitle: true, enableBarCollapsing: true });
          } catch {}
          setAndroidCallActive(false);
          try { await api.post(`/live-sessions/${sessionId}/end`); } catch {}
          await clearActiveSession();
          setShowRating(true);
        } else {
          setRoomUrl(finalUrl);
        }
      } else if (s.status === 'completed') setError('Questa lezione e gia terminata.');
      else setError('La sessione non e ancora attiva');
    } catch {
      if (retryCount.current < 3) { retryCount.current++; setTimeout(loadSession, 2000); return; }
      setError('Impossibile caricare la sessione. Controlla la connessione.');
    } finally { setLoading(false); }
  };

  const handleEndCall = useCallback(() => {
    Alert.alert('Termina lezione', 'Sei sicuro di voler abbandonare la videolezione? Non potrai rientrare.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Termina', style: 'destructive', onPress: async () => {
          setShowCoaching(false);
          try { await api.post(`/live-sessions/${sessionId}/end`); } catch {}
          await clearActiveSession();
          setShowRating(true);
        }},
      ]);
  }, [sessionId]);

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
    resetControlsTimer();
  }, []);

  useEffect(() => {
    if (roomUrl && !webViewReady) {
      loadTimer.current = setTimeout(() => setWebViewReady(true), 15000);
    }
    return () => { if (loadTimer.current) clearTimeout(loadTimer.current); };
  }, [roomUrl, webViewReady]);

  // --- LOADING ---
  if (loading) return (
    <View style={st.center}>
      <StatusBar barStyle="light-content" />
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={st.statusText}>Connessione alla lezione...</Text>
    </View>
  );

  // --- ANDROID BROWSER ---
  if (IS_ANDROID && androidCallActive) return (
    <View style={st.center}>
      <StatusBar barStyle="light-content" />
      <Ionicons name="videocam" size={64} color={Colors.primary} />
      <Text style={st.statusText}>Videolezione in corso nel browser</Text>
      <Text style={[st.statusText, { fontSize: 13, color: '#888' }]}>Chiudi il browser quando hai finito</Text>
      <TouchableOpacity style={st.retryBtn} onPress={handleEndCall}>
        <Text style={st.retryBtnText}>Termina lezione</Text>
      </TouchableOpacity>
    </View>
  );

  // --- ERROR ---
  if (error || !roomUrl) return (
    <View style={st.center}>
      <StatusBar barStyle="light-content" />
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

  // ==============================================================
  // MAIN RENDER - WhatsApp-like fullscreen video call
  // KEY ARCHITECTURE:
  // - WebView is ALWAYS fullscreen (flex:1). NEVER changes layout.
  // - Coaching opens as a MODAL overlay on top.
  // - WebView stays mounted and active behind the modal.
  // - No PiP style change = no crash, no blank view.
  // ==============================================================
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar hidden />

      {/* LAYER 1: WebView - ALWAYS fullscreen, NEVER changes */}
      <View style={StyleSheet.absoluteFill} data-testid="webview-container">
        <WebView
          source={{ uri: roomUrl }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaCapturePermissionGrantType="grant"
          bounces={false}
          onLoadEnd={onWebViewLoadEnd}
          originWhitelist={['*']}
        />
      </View>

      {/* LAYER 2: Floating controls (auto-hide) - tap screen to show */}
      {!showCoaching && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={resetControlsTimer}
          data-testid="controls-tap-area"
        >
          {showControls && (
            <>
              {/* Top bar */}
              <View style={st.floatingTop}>
                <Text style={st.topTitle}>Lezione Live</Text>
                <Text style={st.topSubtitle}>con {teacherName}</Text>
              </View>

              {/* Bottom controls */}
              <View style={st.floatingBottom}>
                <TouchableOpacity
                  onPress={openCoaching}
                  style={st.controlBtn}
                  data-testid="coaching-toggle-btn"
                >
                  <Ionicons name="analytics" size={26} color="#FFF" />
                  <Text style={st.controlLabel}>Coach</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleEndCall}
                  style={st.endCallBtn}
                  data-testid="end-call-btn"
                >
                  <Ionicons name="call" size={30} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>

                <View style={st.controlBtn}>
                  <Ionicons name="chatbubble-ellipses" size={26} color="rgba(255,255,255,0.3)" />
                  <Text style={[st.controlLabel, { color: 'rgba(255,255,255,0.3)' }]}>Chat</Text>
                </View>
              </View>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* LAYER 3: Coaching modal - covers screen, WebView stays alive behind */}
      {showCoaching && (
        <View style={StyleSheet.absoluteFill} data-testid="coaching-modal">
          {/* Coaching content */}
          <CoachingReview
            sessionId={sessionId || ''}
            isTeacher={isTeacher}
            onClose={closeCoaching}
          />

          {/* Draggable PiP window showing video call info */}
          <Animated.View
            style={[st.pipWindow, { transform: pipPos.getTranslateTransform() }]}
            {...pipPan.panHandlers}
            data-testid="pip-window"
          >
            <View style={st.pipContent}>
              <Ionicons name="videocam" size={22} color="#FFF" />
              <Text style={st.pipText}>LIVE</Text>
              <TouchableOpacity onPress={closeCoaching} style={st.pipClose}>
                <Ionicons name="expand" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Coaching controls bar */}
          <View style={st.coachingBottomBar}>
            <TouchableOpacity onPress={closeCoaching} style={st.coachingBackBtn}>
              <Ionicons name="videocam" size={20} color="#FFF" />
              <Text style={st.coachingBackText}>Torna alla videochiamata</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleEndCall} style={st.coachingEndBtn}>
              <Ionicons name="call" size={18} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Loading overlay */}
      {!webViewReady && (
        <View style={st.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={st.statusText}>Caricamento videochiamata...</Text>
        </View>
      )}

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

  // Floating top bar (WhatsApp-like)
  floatingTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  topTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  topSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 2 },

  // Floating bottom controls (WhatsApp-like)
  floatingBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly',
    paddingBottom: 50, paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  controlBtn: { alignItems: 'center', gap: 6, width: 70 },
  controlLabel: { color: '#FFF', fontSize: 12, fontWeight: '500' },
  endCallBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FF3B30',
    alignItems: 'center', justifyContent: 'center',
  },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },

  // PiP window during coaching
  pipWindow: {
    position: 'absolute',
    width: PIP_W, height: PIP_H,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderWidth: 2, borderColor: Colors.primary,
    zIndex: 50,
  },
  pipContent: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  pipText: {
    color: Colors.primary, fontSize: 13, fontWeight: '800',
    letterSpacing: 2,
  },
  pipClose: {
    position: 'absolute', top: 6, right: 6,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Coaching bottom bar
  coachingBottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 40, paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.9)', gap: 12,
  },
  coachingBackBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: '#333', borderRadius: 12,
  },
  coachingBackText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  coachingEndBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FF3B30',
    alignItems: 'center', justifyContent: 'center',
  },
});
