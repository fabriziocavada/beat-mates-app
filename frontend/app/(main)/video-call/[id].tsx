import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Platform, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Colors from '../../../src/constants/colors';
import api from '../../../src/services/api';
import { useAuthStore } from '../../../src/store/authStore';
import CoachingReview from '../../../src/components/CoachingReview';

// Inline CallRatingModal to avoid import issues
function CallRatingModal({ visible, teacherName, sessionId, onSubmit, onSkip }: {
  visible: boolean;
  teacherName: string;
  sessionId: string;
  onSubmit: (rating: number, comment: string) => void;
  onSkip: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const getRatingText = (r: number) => {
    switch (r) {
      case 1: return 'Scarsa';
      case 2: return 'Sufficiente';
      case 3: return 'Buona';
      case 4: return 'Ottima';
      case 5: return 'Eccellente!';
      default: return 'Tocca per valutare';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={ratingStyles.overlay}>
        <View style={ratingStyles.container}>
          <View style={ratingStyles.iconContainer}>
            <Ionicons name="videocam" size={40} color="#FFF" />
          </View>
          <Text style={ratingStyles.title}>Com'è andata la lezione?</Text>
          <Text style={ratingStyles.subtitle}>Valuta la tua esperienza con {teacherName}</Text>
          <View style={ratingStyles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} style={ratingStyles.starButton}>
                <Ionicons name={star <= rating ? 'star' : 'star-outline'} size={48} color={star <= rating ? '#FFD700' : '#444'} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[ratingStyles.ratingText, rating > 0 && { color: '#FFD700' }]}>{getRatingText(rating)}</Text>
          {rating > 0 && (
            <TextInput
              style={ratingStyles.commentInput}
              placeholder="Aggiungi un commento (opzionale)"
              placeholderTextColor="#666"
              value={comment}
              onChangeText={setComment}
              multiline
            />
          )}
          <View style={ratingStyles.buttonsContainer}>
            <TouchableOpacity style={ratingStyles.skipButton} onPress={onSkip}>
              <Text style={ratingStyles.skipButtonText}>Salta</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ratingStyles.submitButton, rating === 0 && { backgroundColor: '#333' }]}
              onPress={() => rating > 0 && onSubmit(rating, comment)}
              disabled={rating === 0}
            >
              <Text style={ratingStyles.submitButtonText}>Invia valutazione</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const ratingStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  container: { width: '100%', maxWidth: 400, backgroundColor: Colors.surface, borderRadius: 24, padding: 32, alignItems: 'center' },
  iconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { color: '#FFF', fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#888', fontSize: 15, textAlign: 'center', marginBottom: 32 },
  starsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  starButton: { padding: 4 },
  ratingText: { color: '#666', fontSize: 18, fontWeight: '600', marginBottom: 24 },
  commentInput: { width: '100%', backgroundColor: '#1C1C1E', borderRadius: 12, padding: 16, color: '#FFF', fontSize: 15, minHeight: 80, textAlignVertical: 'top', marginBottom: 24, borderWidth: 1, borderColor: '#333' },
  buttonsContainer: { flexDirection: 'row', gap: 12, width: '100%' },
  skipButton: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: '#2C2C2E', alignItems: 'center' },
  skipButtonText: { color: '#888', fontSize: 16, fontWeight: '600' },
  submitButton: { flex: 2, paddingVertical: 16, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});

export default function VideoCallScreen() {
  const router = useRouter();
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [showCoaching, setShowCoaching] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const currentUser = useAuthStore(s => s.user);

  useEffect(() => {
    console.log('VideoCall: Loading session', sessionId);
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const res = await api.get(`/live-sessions/${sessionId}`);
      const session = res.data;
      console.log('VideoCall: Session loaded, status:', session.status, 'room:', session.room_url);
      
      // Save teacher info for rating
      if (session.teacher) {
        setTeacherName(session.teacher.name || session.teacher.username || 'Insegnante');
        setTeacherId(session.teacher_id);
        setIsTeacher(currentUser?.id === session.teacher_id);
      }
      
      if (session.room_url) {
        setRoomUrl(session.room_url);
      } else if (session.status === 'active') {
        setError('Stanza non ancora disponibile. Riprova.');
      } else {
        setError('La sessione non è ancora attiva');
      }
    } catch (e: any) {
      console.log('VideoCall: Error loading session:', e?.message);
      setError('Impossibile caricare la sessione');
    } finally {
      setLoading(false);
    }
  };

  const handleEndCall = () => {
    Alert.alert('Termina', 'Vuoi terminare la lezione?', [
      { text: 'No', style: 'cancel' },
      { text: 'Termina', style: 'destructive', onPress: async () => {
        try { await api.post(`/live-sessions/${sessionId}/end`); } catch {}
        // Show rating modal
        setShowRating(true);
      }},
    ]);
  };

  const handleSubmitRating = async (rating: number, comment: string) => {
    try {
      await api.post(`/live-sessions/${sessionId}/review`, {
        rating,
        text: comment,
      });
    } catch (e) {
      console.log('Failed to submit rating:', e);
    }
    setShowRating(false);
    router.back();
  };

  const handleSkipRating = () => {
    setShowRating(false);
    router.back();
  };

  // Loading session data
  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.statusText}>Connessione alla lezione...</Text>
    </View>
  );

  // Error state
  if (error || !roomUrl) return (
    <View style={styles.center}>
      <Ionicons name="videocam-off-outline" size={64} color="#666" />
      <Text style={styles.statusText}>{error || 'Stanza non disponibile'}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); setError(null); loadSession(); }}>
        <Text style={styles.retryBtnText}>Riprova</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>Torna indietro</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.topBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Lezione Live</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Coaching Review button */}
            <TouchableOpacity
              onPress={() => setShowCoaching(!showCoaching)}
              style={[styles.coachingBtn, showCoaching && { backgroundColor: Colors.primary }]}
              data-testid="coaching-toggle-btn"
            >
              <Ionicons name="analytics" size={18} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleEndCall} style={styles.endBtn}>
              <Ionicons name="call" size={20} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
        </View>

        {showCoaching ? (
          /* COACHING MODE: Review on top, Daily.co faces on bottom */
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
              <CoachingReview
                sessionId={sessionId || ''}
                isTeacher={isTeacher}
                onClose={() => setShowCoaching(false)}
              />
            </View>
            {/* Daily.co faces - small strip at bottom */}
            <View style={{ height: 120, borderTopWidth: 1, borderTopColor: '#222' }}>
              <WebView
                source={{ uri: roomUrl }}
                style={{ flex: 1 }}
                javaScriptEnabled
                domStorageEnabled
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback
                mediaCapturePermissionGrantType="grant"
              />
            </View>
          </View>
        ) : (
          /* NORMAL MODE: Full screen Daily.co */
          <View style={{ flex: 1 }}>
            <WebView
              source={{ uri: roomUrl }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback
              mediaCapturePermissionGrantType="grant"
              onLoadStart={() => {
                console.log('VideoCall: WebView loading started');
                setWebViewLoading(true);
              }}
              onLoadEnd={() => {
                console.log('VideoCall: WebView loaded');
                setWebViewLoading(false);
              }}
              onError={(e) => {
                console.log('VideoCall: WebView error', e.nativeEvent.description);
                setError('Errore di connessione alla videochiamata');
              }}
            />
            
            {/* Loading overlay while WebView loads */}
            {webViewLoading && (
              <View style={styles.webViewOverlay}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.statusText}>Caricamento videochiamata...</Text>
                <Text style={styles.subText}>Potrebbe richiedere qualche secondo</Text>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>

      {/* Rating Modal - WhatsApp style */}
      <CallRatingModal
        visible={showRating}
        teacherName={teacherName}
        sessionId={sessionId || ''}
        onSubmit={handleSubmitRating}
        onSkip={handleSkipRating}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 16 },
  statusText: { color: '#FFF', fontSize: 16, marginTop: 12 },
  subText: { color: '#888', fontSize: 13, marginTop: 4 },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: Colors.primary, borderRadius: 12 },
  retryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  backBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: '#333', borderRadius: 12 },
  backBtnText: { color: '#FFF', fontSize: 14 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.8)' },
  topBtn: { padding: 8 },
  topTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  endBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },
  webViewOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
});
