import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
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

  const goNext = () => setActiveIdx(i => Math.min(i + 1, reviews.length - 1));
  const goPrev = () => setActiveIdx(i => Math.max(i - 1, 0));

  const current = reviews[activeIdx];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={styles.container}>
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

          {/* Average */}
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
            <View style={styles.reviewSection}>
              {/* Single review card */}
              <View style={styles.card} data-testid={`review-card-${current.id}`}>
                <View style={styles.cardHeader}>
                  {current.reviewer_image ? (
                    <Image source={{ uri: getMediaUrl(current.reviewer_image) || '' }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={22} color="#777" />
                    </View>
                  )}
                  <View style={styles.cardHeaderInfo}>
                    <Text style={styles.reviewerName} numberOfLines={1}>{current.reviewer_username}</Text>
                    <Text style={styles.dateText}>{timeAgo(current.created_at)}</Text>
                  </View>
                </View>
                <View style={styles.starsRow}>{renderStars(current.rating)}</View>
                {current.text ? (
                  <Text style={styles.commentText}>{current.text}</Text>
                ) : (
                  <Text style={styles.noCommentText}>Nessun commento</Text>
                )}
              </View>

              {/* Navigation arrows + dots */}
              {reviews.length > 1 && (
                <View style={styles.navRow}>
                  <TouchableOpacity
                    onPress={goPrev}
                    style={[styles.arrowBtn, activeIdx === 0 && styles.arrowDisabled]}
                    disabled={activeIdx === 0}
                    data-testid="reviews-prev-btn"
                  >
                    <Ionicons name="chevron-back" size={22} color={activeIdx === 0 ? '#333' : '#FFF'} />
                  </TouchableOpacity>

                  <View style={styles.dotsRow}>
                    {reviews.map((_, i) => (
                      <TouchableOpacity key={i} onPress={() => setActiveIdx(i)}>
                        <View style={[styles.dot, i === activeIdx && styles.dotActive]} />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    onPress={goNext}
                    style={[styles.arrowBtn, activeIdx === reviews.length - 1 && styles.arrowDisabled]}
                    disabled={activeIdx === reviews.length - 1}
                    data-testid="reviews-next-btn"
                  >
                    <Ionicons name="chevron-forward" size={22} color={activeIdx === reviews.length - 1 ? '#333' : '#FFF'} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
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
  reviewSection: {
    padding: 18,
  },
  card: {
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
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardHeaderInfo: { flex: 1 },
  reviewerName: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  dateText: { color: '#666', fontSize: 11, marginTop: 2 },
  commentText: { color: '#CCC', fontSize: 14, lineHeight: 20, marginTop: 10 },
  noCommentText: { color: '#555', fontSize: 13, fontStyle: 'italic', marginTop: 10 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  arrowBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#282848',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: {
    backgroundColor: '#1a1a2e',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 20,
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
