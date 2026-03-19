import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
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
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (visible && userId) {
      setLoading(true);
      setIdx(0);
      api.get(`/users/${userId}/reviews`)
        .then(res => setReviews(res.data))
        .catch(() => setReviews([]))
        .finally(() => setLoading(false));
    }
  }, [visible, userId]);

  const stars = (n: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <Ionicons key={i} name={i < n ? 'star' : 'star-outline'} size={16} color={i < n ? '#FFD700' : '#444'} />
    ));

  const avg = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '0';

  const r = reviews[idx];
  const hasPrev = idx > 0;
  const hasNext = idx < reviews.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.popup}>
          <View style={s.handleBar} />

          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Recensioni</Text>
              <Text style={s.subtitle}>{username}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.xBtn} data-testid="close-reviews-popup">
              <Ionicons name="close" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={s.avgRow}>
            <Text style={s.avgNum}>{avg}</Text>
            <View>
              <View style={s.row}>{stars(Math.round(Number(avg)))}</View>
              <Text style={s.countTxt}>{reviews.length} recension{reviews.length === 1 ? 'e' : 'i'}</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 40 }} />
          ) : reviews.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color="#444" />
              <Text style={s.emptyTxt}>Nessuna recensione ancora</Text>
            </View>
          ) : (
            <View style={s.body}>
              {/* Card */}
              <View style={s.card}>
                <View style={s.cardTop}>
                  {r.reviewer_image ? (
                    <Image source={{ uri: getMediaUrl(r.reviewer_image) || '' }} style={s.avatar} />
                  ) : (
                    <View style={s.avatarPh}>
                      <Ionicons name="person" size={22} color="#777" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.name} numberOfLines={1}>{r.reviewer_username}</Text>
                    <Text style={s.date}>{timeAgo(r.created_at)}</Text>
                  </View>
                </View>
                <View style={s.row}>{stars(r.rating)}</View>
                {r.text ? (
                  <Text style={s.comment}>{r.text}</Text>
                ) : (
                  <Text style={s.noComment}>Nessun commento</Text>
                )}
              </View>

              {/* Navigation */}
              {reviews.length > 1 && (
                <View style={s.nav}>
                  <TouchableOpacity
                    onPress={() => setIdx(i => i - 1)}
                    disabled={!hasPrev}
                    style={[s.arrow, !hasPrev && s.arrowOff]}
                    data-testid="reviews-prev-btn"
                  >
                    <Ionicons name="chevron-back" size={24} color={hasPrev ? '#FFF' : '#333'} />
                  </TouchableOpacity>

                  <View style={s.dots}>
                    {reviews.map((_, i) => (
                      <TouchableOpacity key={i} onPress={() => setIdx(i)} data-testid={`review-dot-${i}`}>
                        <View style={[s.dot, i === idx && s.dotOn]} />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    onPress={() => setIdx(i => i + 1)}
                    disabled={!hasNext}
                    style={[s.arrow, !hasNext && s.arrowOff]}
                    data-testid="reviews-next-btn"
                  >
                    <Ionicons name="chevron-forward" size={24} color={hasNext ? '#FFF' : '#333'} />
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

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  popup: { backgroundColor: '#1a1a2e', borderRadius: 20, width: POPUP_W },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#444', alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#888', fontSize: 13, marginTop: 1 },
  xBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  avgRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#282848' },
  avgNum: { color: '#FFF', fontSize: 40, fontWeight: '800', marginRight: 12 },
  row: { flexDirection: 'row', gap: 2 },
  countTxt: { color: '#888', fontSize: 12, marginTop: 3 },
  body: { padding: 18 },
  card: { backgroundColor: '#222244', borderRadius: 14, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 10, borderWidth: 1, borderColor: '#333' },
  avatarPh: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  name: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  date: { color: '#666', fontSize: 11, marginTop: 2 },
  comment: { color: '#CCC', fontSize: 14, lineHeight: 20, marginTop: 10 },
  noComment: { color: '#555', fontSize: 13, fontStyle: 'italic', marginTop: 10 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  arrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#282848', alignItems: 'center', justifyContent: 'center' },
  arrowOff: { backgroundColor: '#1a1a2e' },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#333' },
  dotOn: { backgroundColor: Colors.primary, width: 20 },
  empty: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  emptyTxt: { color: '#666', fontSize: 14 },
});
