import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';
import { getMediaUrl } from '../services/api';
import api from '../services/api';

const SCREEN_W = Dimensions.get('window').width;
const POPUP_W = SCREEN_W - 32;
const CARD_W = POPUP_W - 56; // card width with peek of next
const CARD_GAP = 12;
const SNAP = CARD_W + CARD_GAP;

interface Review {
  id: string;
  rating: number;
  text?: string;
  reviewer_username: string;
  reviewer_image: string | null;
  created_at: string;
}

interface ReviewsPopupProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  username: string;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m fa`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h fa`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}g fa`;
  const months = Math.floor(days / 30);
  return `${months} mes${months === 1 ? 'e' : 'i'} fa`;
}

export default function ReviewsPopup({ visible, onClose, userId, username }: ReviewsPopupProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (visible && userId) {
      setLoading(true);
      setActiveIdx(0);
      api.get(`/users/${userId}/reviews`)
        .then(res => setReviews(res.data))
        .catch(() => setReviews([]))
        .finally(() => setLoading(false));
    }
  }, [visible, userId]);

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <Ionicons
        key={i}
        name={i < rating ? 'star' : 'star-outline'}
        size={16}
        color={i < rating ? '#FFD700' : '#444'}
      />
    ));

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0';

  const handleScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    setActiveIdx(Math.round(x / SNAP));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      {/* Overlay - tap to close */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Container - plain View so touches pass through to ScrollView */}
        <View
          style={styles.container}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => {}}
        >
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Recensioni</Text>
              <Text style={styles.headerSubtitle}>{username}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} data-testid="close-reviews-popup">
              <Ionicons name="close" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Average summary */}
          <View style={styles.summary}>
            <Text style={styles.avgNumber}>{avgRating}</Text>
            <View style={styles.summaryRight}>
              <View style={styles.starsRow}>{renderStars(Math.round(Number(avgRating)))}</View>
              <Text style={styles.reviewCountText}>{reviews.length} recension{reviews.length === 1 ? 'e' : 'i'}</Text>
            </View>
          </View>

          {/* Content */}
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 40 }} />
          ) : reviews.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color="#444" />
              <Text style={styles.emptyText}>Nessuna recensione ancora</Text>
            </View>
          ) : (
            <>
              {/* Horizontal ScrollView carousel - swipe works on entire area */}
              <ScrollView
                horizontal
                pagingEnabled={false}
                snapToInterval={SNAP}
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContent}
                onMomentumScrollEnd={handleScroll}
                scrollEventThrottle={16}
              >
                {reviews.map((item, idx) => (
                  <View
                    key={item.id}
                    style={[styles.card, idx < reviews.length - 1 && { marginRight: CARD_GAP }]}
                    data-testid={`review-card-${item.id}`}
                  >
                    <View style={styles.cardHeader}>
                      {item.reviewer_image ? (
                        <Image source={{ uri: getMediaUrl(item.reviewer_image) || '' }} style={styles.avatar} />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Ionicons name="person" size={20} color="#777" />
                        </View>
                      )}
                      <View style={styles.cardHeaderInfo}>
                        <Text style={styles.reviewerName} numberOfLines={1}>{item.reviewer_username}</Text>
                        <Text style={styles.dateText}>{timeAgo(item.created_at)}</Text>
                      </View>
                    </View>
                    <View style={styles.starsRow}>{renderStars(item.rating)}</View>
                    {item.text ? (
                      <Text style={styles.commentText} numberOfLines={5}>{item.text}</Text>
                    ) : (
                      <Text style={styles.noCommentText}>Nessun commento</Text>
                    )}
                  </View>
                ))}
              </ScrollView>

              {/* Dots + counter */}
              {reviews.length > 1 && (
                <View style={styles.footer}>
                  <View style={styles.dotsRow}>
                    {reviews.map((_, i) => (
                      <View key={i} style={[styles.dot, i === activeIdx && styles.dotActive]} />
                    ))}
                  </View>
                  <Text style={styles.pageCounter}>{activeIdx + 1} / {reviews.length}</Text>
                </View>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    width: POPUP_W,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#444',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerLeft: { flex: 1 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: '#888', fontSize: 13, marginTop: 1 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#282848',
  },
  avgNumber: { color: '#FFF', fontSize: 40, fontWeight: '800', marginRight: 12 },
  summaryRight: { flex: 1 },
  starsRow: { flexDirection: 'row', gap: 2 },
  reviewCountText: { color: '#888', fontSize: 12, marginTop: 3 },
  carouselContent: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  card: {
    width: CARD_W,
    backgroundColor: '#222244',
    borderRadius: 14,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardHeaderInfo: { flex: 1 },
  reviewerName: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  dateText: { color: '#666', fontSize: 11, marginTop: 1 },
  commentText: { color: '#CCC', fontSize: 13, lineHeight: 19, marginTop: 8 },
  noCommentText: { color: '#555', fontSize: 12, fontStyle: 'italic', marginTop: 8 },
  footer: {
    alignItems: 'center',
    paddingBottom: 16,
    gap: 6,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 18,
  },
  pageCounter: {
    color: '#555',
    fontSize: 11,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
});
