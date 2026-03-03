import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
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
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callEnded, setCallEnded] = useState(false);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const response = await api.get(`/live-sessions/${sessionId}`);
      const session = response.data;
      if (session.room_url) {
        setRoomUrl(session.room_url);
        // Try to get a meeting token for auto-join
        try {
          const tokenRes = await api.post(`/video-call/token?session_id=${sessionId}`);
          setToken(tokenRes.data.token);
        } catch {
          // Token is optional, room URL alone works
        }
      } else {
        try {
          const roomRes = await api.post(`/video-call/create-room?session_id=${sessionId}`);
          if (roomRes.data.room_url) {
            setRoomUrl(roomRes.data.room_url);
          } else {
            setError('Impossibile creare la stanza video');
          }
        } catch {
          setError('Nessuna stanza video disponibile');
        }
      }
    } catch {
      setError('Impossibile caricare la sessione');
    } finally {
      setLoading(false);
    }
  };

  const handleEndCall = async () => {
    Alert.alert(
      'Termina Videochiamata',
      'Sei sicuro di voler terminare la lezione?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Si, termina',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/live-sessions/${sessionId}/end`);
            } catch {}
            setCallEnded(true);
            setTimeout(() => router.back(), 1500);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Connessione in corso...</Text>
      </View>
    );
  }

  if (error || !roomUrl) {
    return (
      <View style={styles.container}>
        <Ionicons name="videocam-off-outline" size={64} color={Colors.textSecondary} />
        <Text style={styles.errorText}>{error || 'Stanza non disponibile'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Torna indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (callEnded) {
    return (
      <View style={styles.container}>
        <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
        <Text style={styles.endedText}>Lezione terminata</Text>
      </View>
    );
  }

  // Build HTML that uses Daily.co JS SDK to auto-join without any pre-join UI
  const dailyHtml = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:100%; height:100%; background:#000; overflow:hidden; }
#call-frame { width:100%; height:100%; border:none; }
#loading { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#fff; font-family:sans-serif; text-align:center; }
#loading .spinner { width:40px; height:40px; border:3px solid rgba(255,255,255,0.2); border-top-color:#FF6978; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto 12px; }
@keyframes spin { to { transform:rotate(360deg); } }
</style>
</head><body>
<div id="loading"><div class="spinner"></div><div>Connessione...</div></div>
<script src="https://unpkg.com/@daily-co/daily-js"></script>
<script>
  const callFrame = window.DailyIframe.createFrame(document.body, {
    iframeStyle: {
      position: 'fixed',
      top: 0, left: 0,
      width: '100%',
      height: '100%',
      border: 'none',
      zIndex: 100,
    },
    showLeaveButton: false,
    showFullscreenButton: false,
  });
  
  callFrame.join({
    url: '${roomUrl}',
    ${token ? `token: '${token}',` : ''}
    startVideoOff: false,
    startAudioOff: false,
  }).then(() => {
    document.getElementById('loading').style.display = 'none';
  }).catch((err) => {
    document.getElementById('loading').innerHTML = '<div style="color:#FF6978">Errore connessione</div>';
  });
  
  callFrame.on('left-meeting', () => {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage('call-ended');
  });
</script>
</body></html>`;

  const handleWebViewMessage = (event: any) => {
    if (event.nativeEvent.data === 'call-ended') {
      setCallEnded(true);
      setTimeout(() => router.back(), 1500);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.topBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Lezione Live</Text>
          <TouchableOpacity onPress={handleEndCall} style={styles.endBtn} data-testid="end-call-btn">
            <Ionicons name="call" size={20} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>

        {/* Daily.co via JS SDK in WebView - auto-joins immediately */}
        {Platform.OS === 'web' ? (
          <View style={{ flex: 1 }}>
            {React.createElement('iframe', {
              srcDoc: dailyHtml,
              style: { width: '100%', height: '100%', border: 'none' },
              allow: 'camera; microphone; autoplay; display-capture',
            })}
          </View>
        ) : (
          <WebView
            source={{ html: dailyHtml }}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            mediaCapturePermissionGrantType="grant"
            onMessage={handleWebViewMessage}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webviewLoading}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Caricamento video...</Text>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 12,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  endedText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  topBtn: {
    padding: 8,
  },
  topTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  endBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webviewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
});
