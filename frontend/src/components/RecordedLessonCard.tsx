import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMediaUrl } from '../services/api';
import Colors from '../constants/colors';

interface VideoLesson {
  id: string;
  title: string;
  description?: string;
  dance_category: string;
  price: number;
  currency: string;
  duration_minutes: number;
  video_url: string;
  thumbnail_url: string;
  reviews_count: number;
  avg_rating: number;
  user?: {
    id: string;
    username: string;
    name: string;
    profile_image: string | null;
  };
}

interface Props {
  lesson: VideoLesson;
  onPress: () => void;
  onInfoPress: () => void;
  onUserPress: () => void;
}

export default function RecordedLessonCard({ lesson, onPress, onInfoPress, onUserPress }: Props) {
  const thumbnailUrl = lesson.thumbnail_url ? getMediaUrl(lesson.thumbnail_url) : null;
  const userImageUrl = lesson.user?.profile_image ? getMediaUrl(lesson.user.profile_image) : null;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.85}>
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.placeholderThumbnail]}>
            <Ionicons name="play-circle" size={40} color="rgba(255,255,255,0.5)" />
          </View>
        )}
        
        {/* Duration badge */}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{lesson.duration_minutes} min</Text>
        </View>

        {/* Play icon overlay */}
        <View style={styles.playOverlay}>
          <Ionicons name="play" size={24} color="#fff" />
        </View>
      </View>

      {/* Info row */}
      <View style={styles.infoRow}>
        {/* User avatar */}
        <TouchableOpacity onPress={onUserPress} style={styles.userAvatar}>
          {userImageUrl ? (
            <Image source={{ uri: userImageUrl }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarImage, styles.placeholderAvatar]}>
              <Text style={styles.avatarLetter}>
                {lesson.user?.username?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Price */}
        <View style={styles.priceContainer}>
          <Text style={styles.priceText}>
            {lesson.price.toFixed(2)}€
          </Text>
        </View>

        {/* Info button */}
        <TouchableOpacity onPress={onInfoPress} style={styles.infoButton}>
          <Ionicons name="information-circle-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={1}>{lesson.title}</Text>
      
      {/* Rating */}
      {lesson.reviews_count > 0 && (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color="#FFD700" />
          <Text style={styles.ratingText}>{lesson.avg_rating.toFixed(1)}</Text>
          <Text style={styles.reviewsText}>({lesson.reviews_count})</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 150,
    marginRight: 12,
  },
  thumbnailContainer: {
    width: 150,
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  playOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -20,
    marginLeft: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  placeholderAvatar: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  priceContainer: {
    flex: 1,
  },
  priceText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  infoButton: {
    padding: 4,
  },
  title: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 2,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 2,
  },
  reviewsText: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
});
