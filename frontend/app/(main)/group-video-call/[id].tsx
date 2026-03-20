import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Platform, Dimensions,
  StatusBar, BackHandler, PermissionsAndroid, Linking,
  ScrollView, Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import Colors from '../../../src/constants/colors';
import api from '../../../src/services/api';
import { useAuthStore } from '../../../src/store/authStore';

const { width: SW } = Dimensions.get('window');
const IS_ANDROID = Platform.OS === 'android';
const TOP_SAFE = Platform.OS === 'ios' ? 54 : 30;

// JS to customize Daily.co prebuilt layout for group lessons
const buildGroupInject = (teacherName: string) => `
(function() {
  if (window.__groupSetup) return;
  window.__groupSetup = true;

  var css = document.createElement('style');
  css.textContent = \`
    body,html{margin:0!important;padding:0!important;background:#000!important;overflow:hidden!important}
    /* Hide leave button and branding */
    a[href*="daily.co"]{display:none!important}
  \`;
  document.head.appendChild(css);

  function tweakUI() {
    document.querySelectorAll('button, a, span').forEach(function(el) {
      var t = (el.textContent || '').trim().toLowerCase();
      if (t === 'leave' || t === 'home page') {
        el.style.cssText = 'display:none!important;';
      }
    });
    document.querySelectorAll('a[href*="daily.co"]').forEach(function(el) {
      el.style.cssText = 'display:none!important;';
    });
  }

  tweakUI();
  [1500, 3000, 5000, 8000].forEach(function(t) { setTimeout(tweakUI, t); });
  new MutationObserver(function() { setTimeout(tweakUI, 300); }).observe(document.body, { childList: true, subtree: true });

  function autoPlayVideos() {
    document.querySelectorAll('video').forEach(function(v) {
      if (v.paused && !v.ended && v.readyState >= 2) v.play().catch(function(){});
    });
  }
  [2000, 4000, 8000].forEach(function(t) { setTimeout(autoPlayVideos, t); });
})();
true;
`;

interface HandEntry {
  user_id: string;
  user_name: string;
  raised_at: string;
}

export default function GroupVideoCallScreen() {
  const router = useRouter();
  const { id: lessonId } = useLocalSearchParams<{ id: string }>();
  const currentUser = useAuthStore(s => s.user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [isTeacher, setIsTeacher] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [participantCount, setParticipantCount] = useState(0);
  const [webViewReady, setWebViewReady] = useState(false);
  const [webViewError, setWebViewError] = useState<string | null>(null);
  const [androidCallActive, setAndroidCallActive] = useState(false);

  // Hand raise state
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<HandEntry[]>([]);
  const [allowedSpeakers, setAllowedSpeakers] = useState<string[]>([]);
  const [canSpeak, setCanSpeak] = useState(false);
  const [showHandsPanel, setShowHandsPanel] = useState(false);

  const webViewRef = useRef<WebView>(null);
  const retryCount = useRef(0);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for hand raise
  useEffect(() => {
    if (handRaised) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [handRaised]);

  // Back button handler
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (roomUrl || androidCallActive) { handleLeave(); return true; }
      return false;
    });
    return () => handler.remove();
  }, [roomUrl, androidCallActive]);

  // Poll for hand raises
  useEffect(() => {
    if (!lessonId || !roomUrl) return;
    const poll = async () => {
      try {
        const res = await api.get(`/group-lessons/${lessonId}/hands`);
        setRaisedHands(res.data.raised_hands || []);
        setAllowedSpeakers(res.data.allowed_speakers || []);
        if (!isTeacher && currentUser?.id) {
          const wasAllowed = canSpeak;
          const nowAllowed = (res.data.allowed_speakers || []).includes(currentUser.id);
          setCanSpeak(nowAllowed);
          if (nowAllowed && !wasAllowed) {
            Alert.alert('Puoi parlare!', 'Il maestro ti ha dato il permesso. Attiva il microfono.');
          }
        }
      } catch {}
    };
    poll();
    handPollRef.current = setInterval(poll, 3000);
    return () => { if (handPollRef.current) clearInterval(handPollRef.current); };
  }, [lessonId, roomUrl, isTeacher, canSpeak]);

  const requestAndroidPermissions = async (): Promise<boolean> => {
    try {
      const grants = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
      return grants[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
             grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
    } catch { return false; }
  };

  useEffect(() => {
    loadLesson();
    return () => {
      if (loadTimer.current) clearTimeout(loadTimer.current);
      if (handPollRef.current) clearInterval(handPollRef.current);
    };
  }, [lessonId]);

  const loadLesson = async () => {
    setLoading(true);
    setError(null);
    try {
      if (IS_ANDROID) {
        const permOk = await requestAndroidPermissions();
        if (!permOk) { setError('Servono i permessi per camera e microfono.'); setLoading(false); return; }
      }

      // Get token with role-based permissions
      const tokenRes = await api.post(`/group-lessons/${lessonId}/token`);
      const { token, is_teacher, room_url, teacher_id } = tokenRes.data;

      setIsTeacher(is_teacher);

      // Get lesson details for title
      const lessonRes = await api.get(`/group-lessons/${lessonId}`);
      const lesson = lessonRes.data;
      setLessonTitle(lesson.title || 'Lezione di Gruppo');
      setParticipantCount(lesson.booked_count || 0);
      setTeacherName(lesson.teacher?.name || lesson.teacher?.username || 'Insegnante');

      if (is_teacher) setCanSpeak(true);

      const finalUrl = `${room_url}?t=${token}`;

      if (IS_ANDROID) {
        setLoading(false);
        setAndroidCallActive(true);
        try {
          await WebBrowser.openBrowserAsync(finalUrl, { dismissButtonStyle: 'close', showTitle: true });
        } catch {}
        setAndroidCallActive(false);
        router.replace('/(main)/available');
      } else {
        setRoomUrl(finalUrl);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || '';
      if (retryCount.current < 3) {
        retryCount.current++;
        setTimeout(loadLesson, 2000);
        return;
      }
      setError(detail || 'Impossibile connettersi alla lezione.');
    } finally {
      setLoading(false);
    }
  };

  const handleEndLesson = useCallback(() => {
    Alert.alert('Termina Lezione', 'Terminare la lezione per tutti?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Termina', style: 'destructive', onPress: async () => {
        try { await api.post(`/group-lessons/${lessonId}/end`); } catch {}
        router.replace('/(main)/available');
      }},
    ]);
  }, [lessonId]);

  const handleLeave = useCallback(() => {
    Alert.alert('Esci dalla lezione', 'Sei sicuro?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Esci', onPress: () => router.replace('/(main)/available') },
    ]);
  }, []);

  const toggleHandRaise = async () => {
    try {
      if (handRaised) {
        await api.post(`/group-lessons/${lessonId}/lower-hand`);
        setHandRaised(false);
      } else {
        await api.post(`/group-lessons/${lessonId}/raise-hand`);
        setHandRaised(true);
      }
    } catch {}
  };

  const allowStudent = async (studentId: string) => {
    try {
      await api.post(`/group-lessons/${lessonId}/allow-speak?student_id=${studentId}`);
    } catch {}
  };

  const revokeStudent = async (studentId: string) => {
    try {
      await api.post(`/group-lessons/${lessonId}/revoke-speak?student_id=${studentId}`);
    } catch {}
  };

  const onWebViewLoadEnd = useCallback(() => {
    setWebViewReady(true);
    if (loadTimer.current) clearTimeout(loadTimer.current);
    const js = buildGroupInject(teacherName);
    setTimeout(() => webViewRef.current?.injectJavaScript(js), 2000);
    setTimeout(() => webViewRef.current?.injectJavaScript(js), 5000);
  }, [teacherName]);

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

  // --- ANDROID ---
  if (IS_ANDROID && androidCallActive) return (
    <View style={st.center}>
      <StatusBar barStyle="light-content" />
      <Ionicons name="people" size={64} color={Colors.primary} />
      <Text style={st.statusText}>Lezione in corso nel browser</Text>
      <TouchableOpacity style={st.primaryBtn} onPress={() => router.replace('/(main)/available')}>
        <Text style={st.primaryBtnText}>Torna alle lezioni</Text>
      </TouchableOpacity>
    </View>
  );

  // --- ERROR ---
  if (error || !roomUrl) return (
    <View style={st.center}>
      <StatusBar barStyle="light-content" />
      <Ionicons name="people-outline" size={64} color="#666" />
      <Text style={st.statusText}>{error || 'Stanza non disponibile'}</Text>
      <TouchableOpacity style={st.primaryBtn} onPress={() => { retryCount.current = 0; loadLesson(); }} data-testid="retry-btn">
        <Text style={st.primaryBtnText}>Riprova</Text>
      </TouchableOpacity>
      <TouchableOpacity style={st.secondaryBtn} onPress={() => router.replace('/(main)/available')} data-testid="back-btn">
        <Text style={st.secondaryBtnText}>Torna alle lezioni</Text>
      </TouchableOpacity>
    </View>
  );

  // --- MAIN RENDER ---
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar hidden />

      {/* WebView */}
      <View style={StyleSheet.absoluteFill}>
        {webViewError ? (
          <View style={st.center}>
            <Ionicons name="wifi-outline" size={48} color="#FF6978" />
            <Text style={[st.statusText, { marginTop: 12 }]}>Errore di connessione</Text>
            <TouchableOpacity style={st.primaryBtn} onPress={() => { setWebViewError(null); loadLesson(); }}>
              <Text style={st.primaryBtnText}>Riprova</Text>
            </TouchableOpacity>
          </View>
        ) : (
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
            onError={(e) => {
              if (retryCount.current < 3) { retryCount.current++; setTimeout(loadLesson, 2000); }
              else setWebViewError(e.nativeEvent.description || 'Connessione fallita');
            }}
            originWhitelist={['*']}
            injectedJavaScript={buildGroupInject(teacherName)}
          />
        )}
      </View>

      {/* TOP BAR - info + controls */}
      {webViewReady && (
        <View style={st.topBar} pointerEvents="box-none">
          {/* Left: lesson info */}
          <View style={st.infoBadge} data-testid="lesson-info-badge">
            <View style={st.liveIndicator} />
            <Text style={st.infoText} numberOfLines={1}>{lessonTitle}</Text>
            <View style={st.participantBadge}>
              <Ionicons name="people" size={11} color="#FFF" />
              <Text style={st.participantText}>{participantCount}</Text>
            </View>
          </View>

          <View style={{ flex: 1 }} />

          {/* Teacher: show hands panel toggle */}
          {isTeacher && raisedHands.length > 0 && (
            <TouchableOpacity
              style={st.handsBtn}
              onPress={() => setShowHandsPanel(!showHandsPanel)}
              data-testid="toggle-hands-panel"
            >
              <Ionicons name="hand-left" size={16} color="#FFD60A" />
              <View style={st.handsBadge}>
                <Text style={st.handsBadgeText}>{raisedHands.length}</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* End/Leave */}
          {isTeacher ? (
            <TouchableOpacity onPress={handleEndLesson} style={st.endBtn} data-testid="end-lesson-btn">
              <Ionicons name="stop-circle" size={16} color="#FFF" />
              <Text style={st.endBtnText}>Termina</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleLeave} style={st.leaveBtn} data-testid="leave-lesson-btn">
              <Ionicons name="exit-outline" size={16} color="#FFF" />
              <Text style={st.leaveBtnText}>Esci</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* TEACHER: Raised Hands Panel */}
      {webViewReady && isTeacher && showHandsPanel && (
        <View style={st.handsPanel} data-testid="hands-panel">
          <View style={st.handsPanelHeader}>
            <Text style={st.handsPanelTitle}>Mani Alzate</Text>
            <TouchableOpacity onPress={() => setShowHandsPanel(false)}>
              <Ionicons name="close" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 200 }}>
            {raisedHands.map((h) => (
              <View key={h.user_id} style={st.handRow}>
                <Ionicons name="hand-left" size={16} color="#FFD60A" />
                <Text style={st.handName}>{h.user_name}</Text>
                <TouchableOpacity
                  style={st.allowBtn}
                  onPress={() => allowStudent(h.user_id)}
                  data-testid={`allow-${h.user_id}`}
                >
                  <Ionicons name="mic" size={14} color="#FFF" />
                  <Text style={st.allowBtnText}>Parla</Text>
                </TouchableOpacity>
              </View>
            ))}
            {raisedHands.length === 0 && (
              <Text style={st.noHandsText}>Nessuna mano alzata</Text>
            )}
          </ScrollView>

          {/* Currently allowed speakers */}
          {allowedSpeakers.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={[st.handsPanelTitle, { fontSize: 12, marginBottom: 6 }]}>Stanno parlando:</Text>
              {allowedSpeakers.map((sid) => {
                const hand = raisedHands.find(h => h.user_id === sid);
                return (
                  <View key={sid} style={st.handRow}>
                    <Ionicons name="mic" size={16} color="#28A745" />
                    <Text style={st.handName}>{hand?.user_name || 'Studente'}</Text>
                    <TouchableOpacity
                      style={[st.allowBtn, { backgroundColor: '#FF3B30' }]}
                      onPress={() => revokeStudent(sid)}
                      data-testid={`revoke-${sid}`}
                    >
                      <Ionicons name="mic-off" size={14} color="#FFF" />
                      <Text style={st.allowBtnText}>Muta</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* STUDENT: Hand Raise button + Can Speak indicator */}
      {webViewReady && !isTeacher && (
        <View style={st.studentControls} pointerEvents="box-none">
          {canSpeak && (
            <View style={st.canSpeakBadge} data-testid="can-speak-badge">
              <Ionicons name="mic" size={16} color="#FFF" />
              <Text style={st.canSpeakText}>Puoi parlare! Attiva il mic</Text>
            </View>
          )}

          <Animated.View style={[st.handRaiseContainer, { transform: [{ scale: handRaised ? pulseAnim : 1 }] }]}>
            <TouchableOpacity
              style={[st.handRaiseBtn, handRaised && st.handRaisedActive]}
              onPress={toggleHandRaise}
              data-testid="raise-hand-btn"
            >
              <Ionicons name="hand-left" size={24} color={handRaised ? '#000' : '#FFD60A'} />
            </TouchableOpacity>
            <Text style={st.handRaiseLabel}>
              {handRaised ? 'Abbassa' : 'Alza la mano'}
            </Text>
          </Animated.View>
        </View>
      )}

      {/* Loading overlay */}
      {!webViewReady && (
        <View style={st.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={st.statusText}>Caricamento lezione...</Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  center: {
    flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
  },
  statusText: { color: '#FFF', fontSize: 16, marginTop: 12, textAlign: 'center' },
  primaryBtn: {
    marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: Colors.primary, borderRadius: 12,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: '#333', borderRadius: 12,
  },
  secondaryBtnText: { color: '#FFF', fontSize: 14 },
  // Top bar
  topBar: {
    position: 'absolute', top: TOP_SAFE, left: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 20,
  },
  infoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', maxWidth: SW * 0.45,
  },
  liveIndicator: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF3B30' },
  infoText: { color: '#FFF', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  participantBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
  },
  participantText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  handsBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,214,10,0.4)',
  },
  handsBadge: {
    marginLeft: 4, backgroundColor: '#FF3B30', borderRadius: 8,
    width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  handsBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  endBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FF3B30', borderRadius: 16,
  },
  endBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  leaveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  leaveBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  // Hands panel (teacher)
  handsPanel: {
    position: 'absolute', top: TOP_SAFE + 50, right: 10,
    width: 220, backgroundColor: 'rgba(20,20,40,0.95)',
    borderRadius: 16, padding: 14, zIndex: 30,
    borderWidth: 1, borderColor: 'rgba(255,214,10,0.3)',
  },
  handsPanelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  handsPanelTitle: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  handRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  handName: { color: '#FFF', fontSize: 13, flex: 1 },
  allowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#28A745', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  allowBtnText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  noHandsText: { color: '#888', fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  // Student controls
  studentControls: {
    position: 'absolute', bottom: 100, left: 0, right: 0,
    alignItems: 'center', zIndex: 20,
  },
  canSpeakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(40,167,69,0.9)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, marginBottom: 12,
  },
  canSpeakText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  handRaiseContainer: { alignItems: 'center', gap: 4 },
  handRaiseBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,214,10,0.5)',
  },
  handRaisedActive: {
    backgroundColor: '#FFD60A', borderColor: '#FFD60A',
  },
  handRaiseLabel: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
});
