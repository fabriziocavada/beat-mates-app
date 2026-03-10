import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, Dimensions, Animated,
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
const PIP_W = Math.round(SW * 0.28);
const PIP_H = Math.round(PIP_W * 1.4);

async function saveActiveSession(id: string) { try { await AsyncStorage.setItem('active_session_id', id); } catch {} }
async function clearActiveSession() { try { await AsyncStorage.removeItem('active_session_id'); } catch {} }

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
          <View style={rs.icon}><Ionicons name="videocam" size={40} color="#FFF" /></View>
          <Text style={rs.title}>Com'è andata la lezione?</Text>
          <Text style={rs.sub}>Valuta la tua esperienza con {teacherName}</Text>
          <View style={rs.stars}>
            {[1,2,3,4,5].map(s => (
              <TouchableOpacity key={s} onPress={() => setRating(s)} style={rs.starBtn}>
                <Ionicons name={s <= rating ? 'star' : 'star-outline'} size={46} color={s <= rating ? '#FFD700' : '#444'} />
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
  icon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { color: '#FFF', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  sub: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  stars: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  starBtn: { padding: 2 },
  label: { color: '#666', fontSize: 16, fontWeight: '600', marginBottom: 20 },
  input: { width: '100%', backgroundColor: '#1C1C1E', borderRadius: 12, padding: 14, color: '#FFF', fontSize: 14, minHeight: 70, textAlignVertical: 'top', marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  btns: { flexDirection: 'row', gap: 12, width: '100%' },
  skip: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#2C2C2E', alignItems: 'center' },
  skipT: { color: '#888', fontSize: 15, fontWeight: '600' },
  submit: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  submitT: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});

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

  useEffect(() => {
    loadSession();
    if (sessionId) saveActiveSession(sessionId);
    return () => { if (loadTimer.current) clearTimeout(loadTimer.current); };
  }, [sessionId]);

  const loadSession = async () => {
    setLoading(true); setError(null);
    try {
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

  const handleEndCall = () => {
    Alert.alert('Termina', 'Vuoi terminare la lezione?', [
      { text: 'No', style: 'cancel' },
      { text: 'Termina', style: 'destructive', onPress: async () => {
        try { await api.post(`/live-sessions/${sessionId}/end`); } catch {}
        await clearActiveSession();
        setShowRating(true);
      }},
    ]);
  };

  const onRatingSubmit = async (r: number, c: string) => {
    try { await api.post(`/live-sessions/${sessionId}/review`, { rating: r, text: c }); } catch {}
    setShowRating(false);
    router.replace('/(main)/home');
  };
  const onRatingSkip = () => { setShowRating(false); router.replace('/(main)/home'); };

  const onWebViewLoadStart = () => {
    if (loadTimer.current) clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => setWebViewReady(true), 15000);
  };
  const onWebViewLoadEnd = () => {
    setWebViewReady(true);
    if (loadTimer.current) clearTimeout(loadTimer.current);
  };

  // Loading
  if (loading) return (
    <View style={st.center}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={st.statusText}>Connessione alla lezione...</Text>
    </View>
  );

  // Error
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
              onPress={() => setShowCoaching(prev => !prev)}
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

        {/* Main area */}
        <View style={{ flex: 1 }}>
          {/* Coaching review (behind the PiP in z-order but takes most space) */}
          {showCoaching && (
            <View style={st.coachingArea}>
              <CoachingReview
                sessionId={sessionId || ''}
                isTeacher={isTeacher}
                onClose={() => setShowCoaching(false)}
              />
            </View>
          )}

          {/* Daily.co WebView - ALWAYS rendered, just changes size/position */}
          <View style={showCoaching ? st.pipContainer : st.fullScreen}>
            <WebView
              source={{ uri: roomUrl }}
              style={st.webview}
              javaScriptEnabled
              domStorageEnabled
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback
              mediaCapturePermissionGrantType="grant"
              onLoadStart={onWebViewLoadStart}
              onLoadEnd={onWebViewLoadEnd}
              scrollEnabled={false}
              bounces={false}
            />
            {/* Loading overlay - only in full screen mode */}
            {!webViewReady && !showCoaching && (
              <View style={st.webViewOverlay}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={st.statusText}>Caricamento videochiamata...</Text>
                <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>Potrebbe richiedere qualche secondo</Text>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>

      <CallRatingModal
        visible={showRating}
        teacherName={teacherName}
        onSubmit={onRatingSubmit}
        onSkip={onRatingSkip}
      />
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
  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 20 },
  topBtn: { padding: 8 },
  topTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  topActions: { flexDirection: 'row', alignItems: 'center' },
  coachingBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  endBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },
  // Full screen Daily.co
  fullScreen: { flex: 1, position: 'relative' },
  webview: { flex: 1 },
  webViewOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  // PiP mode: small vertical box bottom-right (WhatsApp style)
  pipContainer: { position: 'absolute', bottom: 12, right: 12, width: PIP_W, height: PIP_H, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', zIndex: 15, backgroundColor: '#111' },
  // Coaching takes full remaining space
  coachingArea: { flex: 1, zIndex: 10 },
});
