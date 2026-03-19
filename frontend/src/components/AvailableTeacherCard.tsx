import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';
import { getMediaUrl } from '../services/api';

interface Teacher {
  id: string;
  username: string;
  name: string;
  profile_image: string | null;
  rating: number;
  review_count?: number;
  hourly_rate: number;
  dance_categories: string[];
  is_available?: boolean;
  is_busy?: boolean;
  remaining_minutes?: number;
}

interface AvailableTeacherCardProps {
  teacher: Teacher;
  onPress?: () => void;
  onBookPress?: () => void;
  onInfoPress?: () => void;
}

export default function AvailableTeacherCard({ teacher, onPress, onBookPress, onInfoPress }: AvailableTeacherCardProps) {
  const renderStars = () => {
    const stars = [];
    const rating = teacher.rating || 0;
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.3;
    for (let i = 1; i <= 5; i++) {
      let name: 'star' | 'star-half' | 'star-outline' = 'star-outline';
      if (i <= fullStars) name = 'star';
      else if (i === fullStars + 1 && hasHalf) name = 'star-half';
      stars.push(
        <Ionicons
          key={i}
          name={name}
          size={12}
          color={i <= fullStars || (i === fullStars + 1 && hasHalf) ? '#FFD700' : Colors.textMuted}
          style={{ marginRight: 1 }}
        />
      );
    }
    return stars;
  };

  const isBusy = teacher.is_busy === true;
  const isOnline = teacher.is_available === true;
  const borderColor = isOnline ? Colors.success : '#FF3B30';

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} data-testid={`teacher-card-${teacher.id}`}>
      <View style={styles.avatarContainer}>
        <View style={[styles.avatarBorder, { borderColor }]}>
          {teacher.profile_image ? (
            <Image
              source={{ uri: getMediaUrl(teacher.profile_image) || '' }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color={Colors.textSecondary} />
            </View>
          )}
        </View>
        <View style={[styles.statusDot, { backgroundColor: isOnline ? Colors.success : '#FF3B30' }]} />
      </View>

      <View style={styles.info}>
        <Text style={styles.username}>{teacher.username}</Text>
        <View style={styles.starsRow}>
          {renderStars()}
          {(teacher.review_count ?? 0) > 0 && (
            <TouchableOpacity onPress={onInfoPress} style={styles.infoBtn} data-testid={`info-btn-${teacher.id}`}>
              <Text style={styles.reviewCount}>({teacher.review_count})</Text>
              <Ionicons name="information-circle-outline" size={14} color={Colors.primary} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          )}
          {(teacher.review_count ?? 0) === 0 && onInfoPress && (
            <TouchableOpacity onPress={onInfoPress} style={styles.infoBtn} data-testid={`info-btn-${teacher.id}`}>
              <Ionicons name="information-circle-outline" size={14} color="#666" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {onBookPress && isOnline && !isBusy && (
        <TouchableOpacity onPress={onBookPress} style={styles.bookButton} data-testid={`book-btn-${teacher.id}`}>
          <Ionicons name="videocam" size={16} color="#FFF" />
          <Text style={styles.bookText}>Prenota</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.statusContainer, { borderColor }]}>
        {isBusy ? (
          <>
            <Ionicons name="call" size={14} color="#FF3B30" />
            <Text style={styles.busyText}>{teacher.remaining_minutes || 0}'</Text>
          </>
        ) : (
          <View style={[styles.availableDot, { backgroundColor: isOnline ? Colors.success : '#FF3B30' }]} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
  },
  avatarContainer: {
    marginRight: 12,
    position: 'relative',
  },
  avatarBorder: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  username: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  reviewCount: {
    color: Colors.textMuted,
    fontSize: 11,
    marginLeft: 4,
  },
  infoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 12,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  bookText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statusContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availableDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
  },
  busyText: {
    color: '#FF3B30',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.background,
  },
});
