import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Colors from '../../../src/constants/colors';
import api from '../../../src/services/api';

export default function VideoCallScreen() {
  const router = useRouter();
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('VideoCall: Loading session', sessionId);
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const res = await api.get(`/live-sessions/${sessionId}`);
      const session = res.data;
      console.log('VideoCall: Session loaded, status:', session.status, 'room:', session.room_url);
      
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
        router.back();
      }},
    ]);
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
          <TouchableOpacity onPress={handleEndCall} style={styles.endBtn}>
            <Ionicons name="call" size={20} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>

        {/* WebView with Daily.co room - direct URL, not iframe */}
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
      </SafeAreaView>
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
