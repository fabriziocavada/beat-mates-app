import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../src/constants/colors';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

interface LessonRequest {
  id: string;
  student_id: string;
  teacher_id: string;
  student?: {
    id: string;
    username: string;
    name: string;
    profile_image: string | null;
  };
  status: string;
  amount: number;
  created_at: string;
}

export default function LessonRequestsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<LessonRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
    // Poll for new requests every 10 seconds
    const interval = setInterval(loadRequests, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadRequests = async () => {
    try {
      const response = await api.get('/live-sessions/pending');
      setRequests(response.data);
    } catch (error) {
      console.error('Failed to load pending requests', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleAccept = async (sessionId: string) => {
    setAcceptingId(sessionId);
    try {
      await api.post(`/live-sessions/${sessionId}/accept`);
      Alert.alert(
        'Lezione Accettata!',
        'La videolezione sta per iniziare...',
        [
          {
            text: 'Inizia Video Call',
            onPress: () => router.push(`/(main)/video-call/${sessionId}`),
          },
        ]
      );
      // Remove from list
      setRequests(prev => prev.filter(r => r.id !== sessionId));
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to accept session');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleReject = async (sessionId: string) => {
    Alert.alert(
      'Rifiuta Richiesta',
      'Sei sicuro di voler rifiutare questa richiesta di lezione?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Si, Rifiuta',
          style: 'destructive',
          onPress: async () => {
            setRejectingId(sessionId);
            try {
              await api.post(`/live-sessions/${sessionId}/reject`);
              setRequests(prev => prev.filter(r => r.id !== sessionId));
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to reject session');
            } finally {
              setRejectingId(null);
            }
          },
        },
      ]
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return 'Adesso';
    if (diffMin < 60) return `${diffMin} min fa`;
    return `${Math.floor(diffMin / 60)}h fa`;
  };

  const renderRequest = ({ item }: { item: LessonRequest }) => {
    const isAccepting = acceptingId === item.id;
    const isRejecting = rejectingId === item.id;

    return (
      <View style={styles.requestCard}>
        {/* Pulsating indicator */}
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE REQUEST</Text>
        </View>

        <View style={styles.cardContent}>
          {/* Student info */}
          <View style={styles.studentInfo}>
            <View style={styles.avatar}>
              {item.student?.profile_image ? (
                <Image source={{ uri: item.student.profile_image }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={28} color={Colors.textSecondary} />
              )}
            </View>
            <View style={styles.studentDetails}>
              <Text style={styles.studentName}>
                {item.student?.name || 'Studente'}
              </Text>
              <Text style={styles.studentUsername}>
                @{item.student?.username || 'unknown'}
              </Text>
            </View>
            <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
          </View>

          {/* Lesson details */}
          <View style={styles.lessonDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="videocam" size={18} color={Colors.primary} />
              <Text style={styles.detailText}>Videolezione Live - 30 min</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="card" size={18} color="#4CAF50" />
              <Text style={styles.detailText}>
                Pagamento: €{item.amount.toFixed(2)} (Confermato)
              </Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleReject(item.id)}
              disabled={isRejecting || isAccepting}
            >
              {isRejecting ? (
                <ActivityIndicator size="small" color={Colors.text} />
              ) : (
                <>
                  <Ionicons name="close" size={20} color={Colors.text} />
                  <Text style={styles.rejectButtonText}>Rifiuta</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAccept(item.id)}
              disabled={isAccepting || isRejecting}
            >
              {isAccepting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="videocam" size={20} color="#FFF" />
                  <Text style={styles.acceptButtonText}>Accetta & Inizia</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Richieste di Lezione</Text>
        <View style={{ width: 28 }} />
      </View>

      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>Nessuna richiesta</Text>
          <Text style={styles.emptyText}>
            Quando uno studente ti invia una richiesta di lezione live, apparirà qui.
          </Text>
          <Text style={styles.emptyHint}>
            Assicurati di avere la disponibilità attiva nel tuo profilo!
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequest}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                loadRequests();
              }}
              tintColor={Colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  requestCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  liveText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.primary,
    letterSpacing: 1,
  },
  cardContent: {
    padding: 16,
    gap: 16,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  studentUsername: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  timeText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  lessonDetails: {
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    fontSize: 14,
    color: Colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  acceptButton: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyHint: {
    fontSize: 13,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: 8,
  },
});
