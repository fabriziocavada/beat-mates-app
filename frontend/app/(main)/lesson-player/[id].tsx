import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Dimensions, 
  ActivityIndicator, Modal, ScrollView, Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Colors from '../../../src/constants/colors';
import api, { getMediaUrl } from '../../../src/services/api';
import { useAuthStore } from '../../../src/store/authStore';

const { width, height } = Dimensions.get('window');

interface VideoLesson {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  duration_minutes: number;
  video_url: string | null;
  thumbnail_url: string | null;
  user_id: string;
  user?: { username: string; name?: string; profile_image?: string };
}

export default function LessonPlayerScreen() {
  const router = useRouter();
  const { id: lessonId } = useLocalSearchParams<{ id: string }>();
  const currentUser = useAuthStore((state) => state.user);
  
  const [lesson, setLesson] = useState<VideoLesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => { loadLesson(); }, [lessonId]);

  const loadLesson = async () => {
    try {
      const res = await api.get('/video-lessons');
      const found = res.data.find((l: VideoLesson) => l.id === lessonId);
      if (found) {
        setLesson(found);
        // Check if this is the owner's lesson or if already purchased
        if (found.user_id === currentUser?.id) {
          setHasPurchased(true); // Owner can always view
        } else {
          // Check purchases
          try {
            const purchaseRes = await api.get(`/purchases/check/${lessonId}`);
            setHasPurchased(purchaseRes.data.purchased);
          } catch {
            setHasPurchased(false);
          }
        }
      }
    } catch (e) { console.error('Failed to load lesson', e); }
    finally { setIsLoading(false); }
  };

  const handleMockPurchase = () => {
    setProcessingPayment(true);
    // Simulate payment processing
    setTimeout(() => {
      setProcessingPayment(false);
      setHasPurchased(true);
      setShowPaymentModal(false);
      // In real app, would call API to record purchase
      api.post('/purchases/mock', { lesson_id: lessonId }).catch(() => {});
    }, 2000);
  };

  if (isLoading || !lesson) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </SafeAreaView>
      </View>
    );
  }

  const videoUrl = lesson.video_url ? getMediaUrl(lesson.video_url) : null;
  const thumbnailUrl = lesson.thumbnail_url ? getMediaUrl(lesson.thumbnail_url) : null;

  // If not purchased, show purchase screen
  if (!hasPurchased) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={28} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Acquista Lezione</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView contentContainerStyle={styles.purchaseContent}>
            {/* Thumbnail/Preview */}
            <View style={styles.previewContainer}>
              {thumbnailUrl ? (
                <Image source={{ uri: thumbnailUrl }} style={styles.previewImage} />
              ) : (
                <View style={[styles.previewImage, styles.previewPlaceholder]}>
                  <Ionicons name="videocam" size={64} color="#444" />
                </View>
              )}
              <View style={styles.previewOverlay}>
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={24} color="#FFF" />
                </View>
              </View>
              <View style={styles.durationBadge}>
                <Ionicons name="time-outline" size={14} color="#FFF" />
                <Text style={styles.durationText}>
                  {Math.floor(lesson.duration_minutes / 60)}:{String(lesson.duration_minutes % 60).padStart(2, '0')}
                </Text>
              </View>
            </View>

            {/* Lesson Info */}
            <Text style={styles.lessonTitle}>{lesson.title}</Text>
            <Text style={styles.lessonDescription}>{lesson.description}</Text>

            {/* Teacher Info */}
            {lesson.user && (
              <View style={styles.teacherRow}>
                {lesson.user.profile_image ? (
                  <Image source={{ uri: getMediaUrl(lesson.user.profile_image) || '' }} style={styles.teacherAvatar} />
                ) : (
                  <View style={[styles.teacherAvatar, styles.teacherAvatarPlaceholder]}>
                    <Ionicons name="person" size={20} color="#666" />
                  </View>
                )}
                <View>
                  <Text style={styles.teacherName}>{lesson.user.name || lesson.user.username}</Text>
                  <Text style={styles.teacherLabel}>Insegnante</Text>
                </View>
              </View>
            )}

            {/* Price Card */}
            <View style={styles.priceCard}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Prezzo</Text>
                <Text style={styles.priceValue}>{lesson.price.toFixed(2)} {lesson.currency}</Text>
              </View>
              <Text style={styles.priceNote}>Accesso illimitato alla lezione</Text>
            </View>

            {/* Purchase Button */}
            <TouchableOpacity 
              style={styles.purchaseButton}
              onPress={() => setShowPaymentModal(true)}
              data-testid="purchase-lesson-btn"
            >
              <Ionicons name="card-outline" size={20} color="#FFF" />
              <Text style={styles.purchaseButtonText}>Acquista Ora</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Payment Modal */}
          <Modal
            visible={showPaymentModal}
            transparent
            animationType="slide"
            statusBarTranslucent
          >
            <View style={styles.modalOverlay}>
              <View style={styles.paymentModal}>
                <View style={styles.paymentHeader}>
                  <Text style={styles.paymentTitle}>Conferma Acquisto</Text>
                  <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                    <Ionicons name="close" size={24} color="#888" />
                  </TouchableOpacity>
                </View>

                <View style={styles.paymentContent}>
                  <Text style={styles.paymentLessonTitle}>{lesson.title}</Text>
                  
                  <View style={styles.paymentPriceBox}>
                    <Text style={styles.paymentPriceLabel}>Totale</Text>
                    <Text style={styles.paymentPrice}>{lesson.price.toFixed(2)} {lesson.currency}</Text>
                  </View>

                  {/* Mock Card Info */}
                  <View style={styles.cardMockup}>
                    <View style={styles.cardRow}>
                      <Ionicons name="card" size={24} color={Colors.primary} />
                      <Text style={styles.cardText}>**** **** **** 4242</Text>
                    </View>
                    <Text style={styles.cardExpiry}>12/28</Text>
                  </View>

                  <Text style={styles.mockupNote}>
                    Questo è un mockup. In produzione verrà integrato Stripe.
                  </Text>

                  <TouchableOpacity 
                    style={[styles.confirmPayButton, processingPayment && styles.confirmPayButtonDisabled]}
                    onPress={handleMockPurchase}
                    disabled={processingPayment}
                    data-testid="confirm-purchase-btn"
                  >
                    {processingPayment ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                        <Text style={styles.confirmPayText}>Paga {lesson.price.toFixed(2)} {lesson.currency}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </View>
    );
  }

  // Purchased - show video
  const html = videoUrl ? `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
*{margin:0;padding:0;background:#000}
video{width:100vw;height:100vh;object-fit:contain}
</style>
</head><body>
<video src="${videoUrl}" autoplay playsinline webkit-playsinline controls></video>
<script>
var v=document.querySelector('video');
v.play();
</script>
</body></html>` : '';

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header overlay */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{lesson.title}</Text>
            <Text style={styles.headerSub}>{lesson.user?.username || ''}</Text>
          </View>
          <View style={styles.purchasedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CD964" />
            <Text style={styles.purchasedText}>Acquistato</Text>
          </View>
        </View>

        {/* Video player */}
        {videoUrl ? (
          <WebView
            source={{ html }}
            style={styles.video}
            scrollEnabled={false}
            bounces={false}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled={true}
          />
        ) : (
          <View style={styles.noVideo}>
            <Ionicons name="videocam-off-outline" size={48} color="#666" />
            <Text style={styles.noVideoText}>Video non disponibile</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 10,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, marginLeft: 8 },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  headerSub: { color: '#888', fontSize: 12, marginTop: 1 },
  video: { flex: 1 },
  noVideo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noVideoText: { color: '#888', fontSize: 14, marginTop: 8 },
  purchasedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  purchasedText: { color: '#4CD964', fontSize: 12, fontWeight: '600' },
  
  // Purchase screen styles
  purchaseContent: { padding: 20 },
  previewContainer: { 
    width: '100%', 
    aspectRatio: 16/9, 
    borderRadius: 16, 
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
  },
  previewImage: { width: '100%', height: '100%' },
  previewPlaceholder: { backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' },
  previewOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.primary,
  },
  durationBadge: {
    position: 'absolute', bottom: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20,
  },
  durationText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  lessonTitle: { color: '#FFF', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  lessonDescription: { color: '#AAA', fontSize: 14, lineHeight: 22, marginBottom: 20 },
  
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  teacherAvatar: { width: 44, height: 44, borderRadius: 22 },
  teacherAvatarPlaceholder: { backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  teacherName: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  teacherLabel: { color: '#888', fontSize: 12 },
  
  priceCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  priceLabel: { color: '#888', fontSize: 14 },
  priceValue: { color: '#4CD964', fontSize: 28, fontWeight: '700' },
  priceNote: { color: '#666', fontSize: 12 },
  
  purchaseButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 14,
  },
  purchaseButtonText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  
  // Modal styles
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.9)', 
    justifyContent: 'flex-end' 
  },
  paymentModal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  paymentTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  paymentContent: { padding: 20 },
  paymentLessonTitle: { color: '#FFF', fontSize: 16, fontWeight: '600', marginBottom: 20 },
  
  paymentPriceBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  paymentPriceLabel: { color: '#888', fontSize: 14 },
  paymentPrice: { color: '#4CD964', fontSize: 24, fontWeight: '700' },
  
  cardMockup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardText: { color: '#FFF', fontSize: 16, fontWeight: '500', letterSpacing: 2 },
  cardExpiry: { color: '#888', fontSize: 14 },
  
  mockupNote: { 
    color: '#666', 
    fontSize: 12, 
    textAlign: 'center', 
    marginBottom: 20,
    fontStyle: 'italic',
  },
  
  confirmPayButton: {
    backgroundColor: '#4CD964',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 14,
  },
  confirmPayButtonDisabled: { opacity: 0.7 },
  confirmPayText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
});
