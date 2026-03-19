import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';
import { getMediaUrl } from '../services/api';
import api from '../services/api';

interface Review {
  id: string;
  rating: number;
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

export default function ReviewsPopup({ visible, onClose, userId, username }: ReviewsPopupProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && userId) {
      setLoading(true);
      api.get(`/users/${userId}/reviews`)
        .then(res => setReviews(res.data))
        .catch(() => setReviews([]))
        .finally(() => setLoading(false));
    }
  }, [visible, userId]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Ionicons
        key={i}
        name={i < rating ? 'star' : 'star-outline'}
        size={14}
        color={i < rating ? '#FFD700' : '#555'}
      />
    ));
  };

  const renderItem = ({ item }: { item: Review }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        {item.reviewer_image ? (
          <Image source={{ uri: getMediaUrl(item.reviewer_image) || '' }} style={styles.reviewerAvatar} />
        ) : (
          <View style={styles.reviewerAvatarPlaceholder}>
            <Ionicons name="person" size={14} color="#888" />
          </View>
        )}
        <View style={styles.reviewerInfo}>
          <Text style={styles.reviewerName}>{item.reviewer_username}</Text>
          <View style={styles.starsRow}>{renderStars(item.rating)}</View>
        </View>
      </View>
    </View>
  );

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0';

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header with X */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Recensioni di {username}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} data-testid="close-reviews-popup">
              <Ionicons name="close" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Summary */}
          <View style={styles.summary}>
            <Text style={styles.avgRating}>{avgRating}</Text>
            <View style={styles.starsRow}>{renderStars(Math.round(Number(avgRating)))}</View>
            <Text style={styles.reviewCount}>{reviews.length} recension{reviews.length === 1 ? 'e' : 'i'}</Text>
          </View>

          {/* Reviews list */}
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 30 }} />
          ) : reviews.length === 0 ? (
            <Text style={styles.emptyText}>Nessuna recensione ancora</Text>
          ) : (
            <FlatList
              data={reviews}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  avgRating: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '800',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  reviewCount: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  reviewCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  reviewerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 30,
  },
});
