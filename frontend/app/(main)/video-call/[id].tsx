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
  const [error, setError] = useState<string | null>(null);
  const [callEnded, setCallEnded] = useState(false);

  useEffect(() => { loadSession(); }, [sessionId]);

  const loadSession = async () => {
    try {
      const res = await api.get(`/live-sessions/${sessionId}`);
      const session = res.data;
      if (session.room_url) {
        setRoomUrl(session.room_url);
      } else {
        // Try creating a room
        try {
          const roomRes = await api.post(`/video-call/create-room?session_id=${sessionId}`);
          if (roomRes.data.room_url) setRoomUrl(roomRes.data.room_url);
          else setError('Impossibile creare la stanza');
        } catch { setError('Nessuna stanza disponibile'); }
      }
    } catch { setError('Impossibile caricare la sessione'); }
    finally { setLoading(false); }
  };

  const handleEndCall = () => {
    Alert.alert('Termina', 'Vuoi terminare la lezione?', [
      { text: 'No', style: 'cancel' },
      { text: 'Termina', style: 'destructive', onPress: async () => {
        try { await api.post(`/live-sessions/${sessionId}/end`); } catch {}
        setCallEnded(true);
        setTimeout(() => router.back(), 1500);
      }},
    ]);
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.statusText}>Connessione...</Text>
    </View>
  );

  if (error || !roomUrl) return (
    <View style={styles.center}>
      <Ionicons name="videocam-off-outline" size={64} color="#666" />
      <Text style={styles.statusText}>{error || 'Stanza non disponibile'}</Text>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>Torna indietro</Text>
      </TouchableOpacity>
    </View>
  );

  if (callEnded) return (
    <View style={styles.center}>
      <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
      <Text style={styles.statusText}>Lezione terminata</Text>
    </View>
  );

  // Use Daily Prebuilt iframe - much faster and more reliable than SDK
  const callHtml = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>*{margin:0;padding:0}html,body{width:100%;height:100%;background:#000;overflow:hidden}
iframe{width:100%;height:100%;border:none}</style>
</head><body>
<iframe src="${roomUrl}" allow="camera;microphone;autoplay;display-capture;fullscreen" allowfullscreen></iframe>
</body></html>`;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.topBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Lezione Live</Text>
          <TouchableOpacity onPress={handleEndCall} style={styles.endBtn}>
            <Ionicons name="call" size={20} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
        <WebView
          source={{ html: callHtml }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          mediaCapturePermissionGrantType="grant"
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 16 },
  statusText: { color: '#FFF', fontSize: 16, marginTop: 12 },
  backBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: Colors.primary, borderRadius: 12 },
  backBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.8)' },
  topBtn: { padding: 8 },
  topTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  endBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },
});
