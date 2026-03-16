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
const TOP_SAFE = Platform.OS === 'ios' ? 54 : 30; // iPhone dynamic island margin

// CSS/JS to inject into Daily.co to make it fullscreen
const DAILY_INJECT = `
(function() {
  if (window.__injected) return;
  window.__injected = true;
  var s = document.createElement('style');
  s.textContent = [
    '.top-bar, [data-testid="top-bar"], [class*="TopBar"], [class*="top-bar"] { display:none!important; }',
    '.bottom-bar-info, [class*="BottomInfo"], [class*="HomePageLink"] { display:none!important; }',
    '[class*="bottom-bar-info"] { display:none!important; }',
    'a[href*="daily.co"] { display:none!important; }',
    '.app { height:100vh!important; }',
  ].join('');
  document.head.appendChild(s);
  // Retry injection after Daily loads its SPA
  setTimeout(function() {
    var s2 = document.createElement('style');
    s2.textContent = s.textContent;
    document.head.appendChild(s2);
    // Hide "Home page" and "X people in call" link
    var links = document.querySelectorAll('a');
    links.forEach(function(l) {
      if (l.textContent.includes('Home page') || l.textContent.includes('people in call')) {
        l.style.display = 'none';
      }
    });
  }, 3000);
})();
true;
`;

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
  const [coachingKey, setCoachingKey] = useState(0); // increment to create new coaching session
  const [isTeacher, setIsTeacher] = useState(false);
  const [androidCallActive, setAndroidCallActive] = useState(false);
  const currentUser = useAuthStore(s => s.user);
  const retryCount = useRef(0);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coachPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webViewRef = useRef<WebView>(null);

  // PiP dragging
  const pipPos = useRef(new Animated.ValueXY({ x: SW - PIP_W - 12, y: TOP_SAFE + 60 })).current;
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

  // Block hardware back button (WhatsApp-like)
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (roomUrl || androidCallActive) { handleEndCall(); return true; }
      return false;
    });
    return () => handler.remove();
  }, [roomUrl, androidCallActive]);

  // Coaching toggle - creates NEW session each time
  const openCoaching = useCallback(() => {
    setCoachingKey(k => k + 1); // new key = new coaching session
    setShowCoaching(true);
    api.post(`/coaching/${sessionId}/command`, { action: 'start_coaching' }).catch(() => {});
  }, [sessionId]);

  const closeCoaching = useCallback(() => {
    setShowCoaching(false);
    api.post(`/coaching/${sessionId}/command`, { action: 'stop_coaching' }).catch(() => {});
  }, [sessionId]);

  // Poll coaching state
  useEffect(() => {
    if (!sessionId || (!roomUrl && !androidCallActive)) return;
    coachPollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/coaching/${sessionId}/state`);
        if (typeof res.data?.coaching_active === 'boolean') {
          setShowCoaching(prev => {
            if (res.data.coaching_active && !prev) { setCoachingKey(k => k + 1); return true; }
            if (!res.data.coaching_active && prev) return false;
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
      setError('Impossibile caricare la sessione.');
    } finally { setLoading(false); }
  };

  const handleEndCall = useCallback(() => {
    Alert.alert('Termina lezione', 'Sei sicuro? Non potrai rientrare.',
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

  const onRatingSkip = useCallback(() => { setShowRating(false); router.replace('/(main)/home'); }, [router]);

  const onWebViewLoadEnd = useCallback(() => {
    setWebViewReady(true);
    if (loadTimer.current) clearTimeout(loadTimer.current);
    // Re-inject CSS to customize Daily.co
    setTimeout(() => webViewRef.current?.injectJavaScript(DAILY_INJECT), 2000);
    setTimeout(() => webViewRef.current?.injectJavaScript(DAILY_INJECT), 5000);
  }, []);

  useEffect(() => {
    if (roomUrl && !webViewReady) {
      loadTimer.current = setTimeout(() => setWebViewReady(true), 15000);
    }
    return () => { if (loadTimer.current) clearTimeout(loadTimer.current); };
  }, [roomUrl, webViewReady]);

  // --- LOADING ---
  if (loading) return (
    <View style={st.center}><StatusBar barStyle="light-content" />
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={st.statusText}>Connessione alla lezione...</Text>
    </View>
  );

  // --- ANDROID BROWSER ---
  if (IS_ANDROID && androidCallActive) return (
    <View style={st.center}><StatusBar barStyle="light-content" />
      <Ionicons name="videocam" size={64} color={Colors.primary} />
      <Text style={st.statusText}>Videolezione in corso nel browser</Text>
      <Text style={[st.statusText, { fontSize: 13, color: '#888' }]}>Chiudi il browser quando hai finito</Text>
      <TouchableOpacity style={st.primaryBtn} onPress={handleEndCall}>
        <Text style={st.primaryBtnText}>Termina lezione</Text>
      </TouchableOpacity>
    </View>
  );

  // --- ERROR ---
  if (error || !roomUrl) return (
    <View style={st.center}><StatusBar barStyle="light-content" />
      <Ionicons name="videocam-off-outline" size={64} color="#666" />
      <Text style={st.statusText}>{error || 'Stanza non disponibile'}</Text>
      <TouchableOpacity style={st.primaryBtn} onPress={() => { retryCount.current = 0; loadSession(); }}>
        <Text style={st.primaryBtnText}>Riprova</Text>
      </TouchableOpacity>
      <TouchableOpacity style={st.secondaryBtn} onPress={() => { clearActiveSession(); router.replace('/(main)/home'); }}>
        <Text style={st.secondaryBtnText}>Torna alla home</Text>
      </TouchableOpacity>
    </View>
  );

  // ==============================================================
  // MAIN RENDER
  // Architecture:
  // - LAYER 1: WebView fullscreen (NEVER changes layout)
  // - LAYER 2: Our controls at TOP only (no overlap with Daily.co bottom)
  // - LAYER 3: Coaching modal overlay (WebView untouched behind)
  // ==============================================================
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar hidden />

      {/* LAYER 1: WebView - ALWAYS fullscreen */}
      <View style={StyleSheet.absoluteFill}>
        <WebView
          ref={webViewRef}
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
          injectedJavaScript={DAILY_INJECT}
        />
      </View>

      {/* LAYER 2: Our controls - TOP ONLY, no overlap with Daily.co bottom */}
      {!showCoaching && webViewReady && (
        <View style={st.topControls} pointerEvents="box-none">
          <TouchableOpacity onPress={openCoaching} style={st.topControlBtn} data-testid="coaching-btn">
            <Ionicons name="analytics" size={20} color="#FFF" />
            <Text style={st.topControlLabel}>Coach</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleEndCall} style={st.topEndBtn} data-testid="end-call-btn">
            <Ionicons name="call" size={18} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
      )}

      {/* LAYER 3: Coaching overlay - fullscreen modal, WebView stays alive behind */}
      {showCoaching && (
        <View style={StyleSheet.absoluteFill} data-testid="coaching-modal">
          {/* Coaching content */}
          <CoachingReview
            key={`coaching-${coachingKey}`}
            sessionId={sessionId || ''}
            isTeacher={isTeacher}
            onClose={closeCoaching}
          />

          {/* Draggable PiP indicator */}
          <Animated.View
            style={[st.pipWindow, { transform: pipPos.getTranslateTransform() }]}
            {...pipPan.panHandlers}
            data-testid="pip-window"
          >
            <TouchableOpacity style={st.pipContent} onPress={closeCoaching} activeOpacity={0.8}>
              <Ionicons name="videocam" size={24} color="#FFF" />
              <Text style={st.pipText}>LIVE</Text>
              <View style={st.pipDot} />
              <Text style={st.pipExpand}>Tocca per tornare</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Top bar in coaching mode */}
          <View style={st.coachingTopBar}>
            <TouchableOpacity onPress={closeCoaching} style={st.coachingBackBtn}>
              <Ionicons name="videocam" size={18} color="#FFF" />
              <Text style={st.coachingBackText}>Videochiamata</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={openCoaching} style={st.coachingNewBtn}>
              <Ionicons name="add" size={18} color="#FFF" />
              <Text style={st.coachingBackText}>Nuovo</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleEndCall} style={st.coachingEndBtn}>
              <Ionicons name="call" size={16} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
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
  primaryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: Colors.primary, borderRadius: 12 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  secondaryBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: '#333', borderRadius: 12 },
  secondaryBtnText: { color: '#FFF', fontSize: 14 },

  // TOP controls - positioned at top right, above Daily.co's UI
  topControls: {
    position: 'absolute',
    top: TOP_SAFE,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    zIndex: 20,
  },
  topControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  topControlLabel: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  topEndBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },

  // PiP window
  pipWindow: {
    position: 'absolute',
    width: PIP_W, height: PIP_H,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderWidth: 2, borderColor: Colors.primary,
    zIndex: 50,
  },
  pipContent: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  pipText: { color: Colors.primary, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  pipDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  pipExpand: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 4 },

  // Coaching top bar
  coachingTopBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingTop: TOP_SAFE,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 60,
  },
  coachingBackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#333', borderRadius: 16,
  },
  coachingNewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.primary, borderRadius: 16,
  },
  coachingBackText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  coachingEndBtn: {
    marginLeft: 'auto',
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FF3B30',
    alignItems: 'center', justifyContent: 'center',
  },
});
