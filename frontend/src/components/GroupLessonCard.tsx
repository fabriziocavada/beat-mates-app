import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';
import { getMediaUrl } from '../services/api';

interface GroupLesson {
  id: string;
  teacher_id: string;
  teacher?: {
    username: string;
    name: string;
    profile_image: string | null;
  };
  title: string;
  description: string;
  dance_category: string;
  scheduled_at: string;
  duration_minutes: number;
  max_participants: number;
  price: number;
  booked_count: number;
  booked_users: string[];
  status: string;
}

interface Props {
  lesson: GroupLesson;
  currentUserId: string;
  onBook: () => void;
  onCancel: () => void;
  onPress: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} - ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function GroupLessonCard({ lesson, currentUserId, onBook, onCancel, onPress }: Props) {
  const isBooked = lesson.booked_users?.includes(currentUserId);
  const isFull = lesson.booked_count >= lesson.max_participants;
  const isTeacher = lesson.teacher_id === currentUserId;
  const spotsLeft = lesson.max_participants - lesson.booked_count;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8} data-testid={`group-lesson-${lesson.id}`}>
      {/* Category badge */}
      <View style={s.catBadge}>
        <Text style={s.catText}>{lesson.dance_category}</Text>
      </View>

      {/* Title + price */}
      <View style={s.titleRow}>
        <Text style={s.title} numberOfLines={1}>{lesson.title}</Text>
        <Text style={s.price}>{lesson.price}€</Text>
      </View>

      {/* Description */}
      {lesson.description ? (
        <Text style={s.desc} numberOfLines={2}>{lesson.description}</Text>
      ) : null}

      {/* Date + duration */}
      <View style={s.infoRow}>
        <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
        <Text style={s.infoText}>{formatDate(lesson.scheduled_at)}</Text>
        <View style={s.dot} />
        <Ionicons name="time-outline" size={14} color={Colors.primary} />
        <Text style={s.infoText}>{lesson.duration_minutes} min</Text>
      </View>

      {/* Teacher + spots */}
      <View style={s.bottomRow}>
        <View style={s.teacherRow}>
          {lesson.teacher?.profile_image ? (
            <Image source={{ uri: getMediaUrl(lesson.teacher.profile_image) || '' }} style={s.avatar} />
          ) : (
            <View style={s.avatarPh}>
              <Ionicons name="person" size={14} color="#777" />
            </View>
          )}
          <Text style={s.teacherName}>{lesson.teacher?.name || lesson.teacher?.username || 'Insegnante'}</Text>
        </View>

        <View style={s.spotsRow}>
          <Ionicons name="people-outline" size={14} color={isFull ? Colors.error : '#888'} />
          <Text style={[s.spotsText, isFull && { color: Colors.error }]}>
            {spotsLeft > 0 ? `${spotsLeft} post${spotsLeft === 1 ? 'o' : 'i'}` : 'Completo'}
          </Text>
        </View>
      </View>

      {/* Action button */}
      {!isTeacher && (
        <View style={s.actionRow}>
          {isBooked ? (
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel} data-testid={`cancel-booking-${lesson.id}`}>
              <Ionicons name="close-circle-outline" size={16} color={Colors.error} />
              <Text style={s.cancelText}>Annulla prenotazione</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.bookBtn, isFull && s.bookBtnDisabled]}
              onPress={onBook}
              disabled={isFull}
              data-testid={`book-lesson-${lesson.id}`}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
              <Text style={s.bookText}>{isFull ? 'Completo' : 'Prenota'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isTeacher && (
        <View style={s.actionRow}>
          <View style={s.ownerBadge}>
            <Ionicons name="school-outline" size={14} color={Colors.primary} />
            <Text style={s.ownerText}>La tua lezione</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  catBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,105,120,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  catText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { color: '#FFF', fontSize: 17, fontWeight: '700', flex: 1, marginRight: 8 },
  price: { color: Colors.primary, fontSize: 18, fontWeight: '800' },
  desc: { color: '#999', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  infoText: { color: '#AAA', fontSize: 13 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#555', marginHorizontal: 4 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#333' },
  avatarPh: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  teacherName: { color: '#CCC', fontSize: 13, fontWeight: '500' },
  spotsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  spotsText: { color: '#888', fontSize: 12 },
  actionRow: { borderTopWidth: 1, borderTopColor: '#2C2C2E', paddingTop: 12 },
  bookBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10,
  },
  bookBtnDisabled: { backgroundColor: '#333' },
  bookText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: 10, paddingVertical: 10,
  },
  cancelText: { color: Colors.error, fontSize: 14, fontWeight: '600' },
  ownerBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 6,
  },
  ownerText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
});
