import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Platform, Dimensions,
  StatusBar, BackHandler, PermissionsAndroid, Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import Colors from '../../../src/constants/colors';
import api from '../../../src/services/api';
import { useAuthStore } from '../../../src/store/authStore';

const { width: SW, height: SH } = Dimensions.get('window');
const IS_ANDROID = Platform.OS === 'android';
const TOP_SAFE = Platform.OS === 'ios' ? 54 : 30;

// JS injection for group call layout - keep grid, hide leave, hide branding
const GROUP_INJECT = `
(function() {
  if (window.__groupInjected) return;
  window.__groupInjected = true;

  var css = document.createElement('style');
  css.textContent = 'body,html{margin:0!important;padding:0!important;background:#000!important;overflow:hidden!important}';
  document.head.appendChild(css);

  function tweakUI() {
    // Hide specific UI elements
    document.querySelectorAll('button, a, span').forEach(function(el) {
      var t = (el.textContent || '').trim().toLowerCase();
      if (t === 'leave' || t === 'home page') {
        el.style.cssText = 'display:none!important;';
      }
    });
    // Hide Daily.co branding links
    document.querySelectorAll('a[href*="daily.co"]').forEach(function(el) {
      el.style.cssText = 'display:none!important;';
    });
  }

  tweakUI();
  [1500, 3000, 5000, 8000, 15000].forEach(function(t) { setTimeout(tweakUI, t); });
  new MutationObserver(function() { setTimeout(tweakUI, 300); }).observe(document.body, { childList: true, subtree: true });

  // Auto-play paused videos
  function autoPlayVideos() {
    document.querySelectorAll('video').forEach(function(v) {
      if (v.paused && !v.ended && v.readyState >= 2) {
        v.play().catch(function(){});
      }
    });
  }
  [2000, 4000, 6000, 10000].forEach(function(t) { setTimeout(autoPlayVideos, t); });
})();
true;
`;

export default function GroupVideoCallScreen() {
  const router = useRouter();
  const { id: lessonId } = useLocalSearchParams<{ id: string }>();
  const currentUser = useAuthStore(s => s.user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [isTeacher, setIsTeacher] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [webViewReady, setWebViewReady] = useState(false);
  const [webViewError, setWebViewError] = useState<string | null>(null);
  const [androidCallActive, setAndroidCallActive] = useState(false);

  const webViewRef = useRef<WebView>(null);
  const retryCount = useRef(0);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Block hardware back on Android
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (roomUrl || androidCallActive) { handleLeave(); return true; }
      return false;
    });
    return () => handler.remove();
  }, [roomUrl, androidCallActive]);

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

  useEffect(() => {
    loadLesson();
    return () => { if (loadTimer.current) clearTimeout(loadTimer.current); };
  }, [lessonId]);

  const loadLesson = async () => {
    setLoading(true);
    setError(null);
    try {
      if (IS_ANDROID) {
        const permOk = await requestAndroidPermissions();
        if (!permOk) { setError('Servono i permessi per camera e microfono.'); setLoading(false); return; }
      }

      const res = await api.get(`/group-lessons/${lessonId}`);
      const lesson = res.data;

      setLessonTitle(lesson.title || 'Lezione di Gruppo');
      setIsTeacher(currentUser?.id === lesson.teacher_id);
      setParticipantCount(lesson.booked_count || 0);

      if (lesson.status !== 'live' || !lesson.room_url) {
        setError('La lezione non e ancora iniziata.');
        setLoading(false);
        return;
      }

      const finalUrl = lesson.room_url;

      if (IS_ANDROID) {
        setLoading(false);
        setAndroidCallActive(true);
        try {
          await WebBrowser.openBrowserAsync(finalUrl, {
            dismissButtonStyle: 'close',
            showTitle: true,
            enableBarCollapsing: true,
          });
        } catch {}
        setAndroidCallActive(false);
        router.replace('/(main)/available');
      } else {
        setRoomUrl(finalUrl);
      }
    } catch {
      if (retryCount.current < 3) {
        retryCount.current++;
        setTimeout(loadLesson, 2000);
        return;
      }
      setError('Impossibile caricare la lezione.');
    } finally {
      setLoading(false);
    }
  };

  // Teacher ends the lesson for everyone
  const handleEndLesson = useCallback(() => {
    Alert.alert('Termina Lezione', 'Terminare la lezione per tutti i partecipanti?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Termina', style: 'destructive', onPress: async () => {
        try { await api.post(`/group-lessons/${lessonId}/end`); } catch {}
        router.replace('/(main)/available');
      }},
    ]);
  }, [lessonId, router]);

  // Student leaves the call
  const handleLeave = useCallback(() => {
    Alert.alert('Esci dalla lezione', 'Sei sicuro di voler uscire?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Esci', onPress: () => {
        router.replace('/(main)/available');
      }},
    ]);
  }, [router]);

  const onWebViewLoadEnd = useCallback(() => {
    setWebViewReady(true);
    if (loadTimer.current) clearTimeout(loadTimer.current);
    setTimeout(() => webViewRef.current?.injectJavaScript(GROUP_INJECT), 2000);
    setTimeout(() => webViewRef.current?.injectJavaScript(GROUP_INJECT), 5000);
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
      <Text style={st.statusText}>Connessione alla lezione di gruppo...</Text>
    </View>
  );

  // --- ANDROID BROWSER ---
  if (IS_ANDROID && androidCallActive) return (
    <View style={st.center}>
      <StatusBar barStyle="light-content" />
      <Ionicons name="people" size={64} color={Colors.primary} />
      <Text style={st.statusText}>Lezione di gruppo in corso nel browser</Text>
      <Text style={[st.statusText, { fontSize: 13, color: '#888' }]}>Chiudi il browser quando hai finito</Text>
      {isTeacher ? (
        <TouchableOpacity style={[st.primaryBtn, { backgroundColor: '#FF3B30' }]} onPress={handleEndLesson} data-testid="android-end-lesson-btn">
          <Text style={st.primaryBtnText}>Termina Lezione</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={st.primaryBtn} onPress={() => router.replace('/(main)/available')} data-testid="android-leave-btn">
          <Text style={st.primaryBtnText}>Torna alle lezioni</Text>
        </TouchableOpacity>
      )}
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

      {/* LAYER 1: WebView fullscreen */}
      <View style={StyleSheet.absoluteFill}>
        {webViewError ? (
          <View style={st.center}>
            <Ionicons name="wifi-outline" size={48} color="#FF6978" />
            <Text style={[st.statusText, { marginTop: 12 }]}>Errore di connessione</Text>
            <Text style={{ color: '#888', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20, paddingHorizontal: 30 }}>{webViewError}</Text>
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
              const desc = e.nativeEvent.description || 'Connessione fallita';
              if (retryCount.current < 3) {
                retryCount.current += 1;
                setTimeout(() => loadLesson(), 2000);
              } else {
                setWebViewError(desc);
              }
            }}
            originWhitelist={['*']}
            injectedJavaScript={GROUP_INJECT}
          />
        )}
      </View>

      {/* LAYER 2: Top controls */}
      {webViewReady && (
        <View style={st.topControls} pointerEvents="box-none">
          {/* Lesson info badge */}
          <View style={st.infoBadge} data-testid="lesson-info-badge">
            <View style={st.liveIndicator} />
            <Text style={st.infoText} numberOfLines={1}>{lessonTitle}</Text>
            <View style={st.participantBadge}>
              <Ionicons name="people" size={12} color="#FFF" />
              <Text style={st.participantText}>{participantCount}</Text>
            </View>
          </View>

          <View style={{ flex: 1 }} />

          {/* End/Leave button */}
          {isTeacher ? (
            <TouchableOpacity onPress={handleEndLesson} style={st.endBtn} data-testid="end-lesson-btn">
              <Ionicons name="stop-circle" size={18} color="#FFF" />
              <Text style={st.endBtnText}>Termina</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleLeave} style={st.leaveBtn} data-testid="leave-lesson-btn">
              <Ionicons name="exit-outline" size={18} color="#FFF" />
              <Text style={st.leaveBtnText}>Esci</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Loading overlay */}
      {!webViewReady && (
        <View style={st.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={st.statusText}>Caricamento lezione di gruppo...</Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  statusText: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
  },
  secondaryBtnText: {
    color: '#FFF',
    fontSize: 14,
  },
  topControls: {
    position: 'absolute',
    top: TOP_SAFE,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 20,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    maxWidth: SW * 0.55,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  infoText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  participantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  participantText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 20,
  },
  endBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  leaveBtn: {
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
  leaveBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
