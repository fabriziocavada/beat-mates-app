import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

interface CallRatingModalProps {
  visible: boolean;
  onSubmit: (rating: number, comment: string) => void;
  onSkip: () => void;
  teacherName: string;
}

export default function CallRatingModal({
  visible,
  onSubmit,
  onSkip,
  teacherName,
}: CallRatingModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    Keyboard.dismiss();
    if (rating > 0) {
      onSubmit(rating, comment);
      setRating(0);
      setComment('');
    } else {
      onSkip();
    }
  };

  const handleSkip = () => {
    Keyboard.dismiss();
    setRating(0);
    setComment('');
    onSkip();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'position' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          <View style={styles.container}>
            {/* Icon */}
            <View style={styles.iconRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="videocam" size={32} color="#FFF" />
              </View>
            </View>

            <Text style={styles.title}>Com'e andata la lezione?</Text>
            <Text style={styles.subtitle}>Valuta la tua esperienza con {teacherName}</Text>

            {/* Stars */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setRating(s)} style={styles.starBtn} data-testid={`rating-star-${s}`}>
                  <Ionicons name={s <= rating ? 'star' : 'star-outline'} size={38} color={s <= rating ? '#FFD700' : '#444'} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Buttons - RIGHT after stars */}
            <View style={styles.btnsRow}>
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} data-testid="skip-rating-btn">
                <Text style={styles.skipText}>Salta</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, !rating && { opacity: 0.4 }]}
                onPress={handleSubmit}
                disabled={!rating}
                data-testid="submit-rating-btn"
              >
                <Text style={styles.sendText}>Invia</Text>
              </TouchableOpacity>
            </View>

            {/* Comment - at bottom, optional */}
            {rating > 0 && (
              <TextInput
                style={styles.input}
                placeholder="Commento (opzionale)"
                placeholderTextColor="#666"
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={300}
                numberOfLines={2}
                textAlignVertical="top"
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  iconRow: { marginBottom: 12 },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  subtitle: { color: '#888', fontSize: 13, marginBottom: 14, textAlign: 'center' },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  starBtn: { padding: 2 },
  btnsRow: { flexDirection: 'row', width: '100%', gap: 10, marginBottom: 12 },
  skipBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
  },
  skipText: { color: '#999', fontSize: 15, fontWeight: '600' },
  sendBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  sendText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  input: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    color: '#FFF',
    fontSize: 14,
    minHeight: 50,
    maxHeight: 80,
    borderWidth: 1,
    borderColor: '#333',
  },
});
