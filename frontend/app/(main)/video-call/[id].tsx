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
      } else {
        // No room yet - try to create one
        try {
          const roomRes = await api.post(`/video-call/create-room?session_id=${sessionId}`);
          if (roomRes.data.room_url) {
            setRoomUrl(roomRes.data.room_url);
          } else {
            setError('Impossibile creare la stanza video');
          }
        } catch (e) {
          setError('Nessuna stanza video disponibile');
        }
      }
    } catch (err) {
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
            } catch (e) {}
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

  // Daily.co prebuilt URL - add query params for UI customization
  const dailyUrl = `${roomUrl}?t=${encodeURIComponent('')}`;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Top bar with end call button */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.topBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Lezione Live</Text>
          <TouchableOpacity onPress={handleEndCall} style={styles.endBtn}>
            <Ionicons name="call" size={20} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>

        {/* Daily.co WebView */}
        {Platform.OS === 'web' ? (
          <View style={{ flex: 1 }}>
            {React.createElement('iframe', {
              src: roomUrl,
              style: { width: '100%', height: '100%', border: 'none' },
              allow: 'camera; microphone; autoplay; display-capture',
            })}
          </View>
        ) : (
          <WebView
            source={{ uri: roomUrl }}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            mediaCapturePermissionGrantType="grant"
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
