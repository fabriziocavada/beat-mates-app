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
  ScrollView,
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
  const [hoveredStar, setHoveredStar] = useState(0);

  const handleSubmit = () => {
    Keyboard.dismiss();
    if (rating > 0) {
      onSubmit(rating, comment);
      setRating(0);
      setComment('');
    }
  };

  const handleSkip = () => {
    Keyboard.dismiss();
    setRating(0);
    setComment('');
    onSkip();
  };

  const getRatingText = (r: number) => {
    switch (r) {
      case 1: return 'Scarsa';
      case 2: return 'Sufficiente';
      case 3: return 'Buona';
      case 4: return 'Ottima';
      case 5: return 'Eccellente!';
      default: return 'Tocca per valutare';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        {/* Fixed OK button at top - always visible above keyboard */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.topOkButton}
            onPress={handleSubmit}
            data-testid="review-top-ok"
          >
            <Text style={styles.topOkText}>{rating > 0 ? 'Invia' : 'Salta'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Header icon */}
            <View style={styles.iconContainer}>
              <Ionicons name="videocam" size={40} color="#FFF" />
            </View>

            {/* Title */}
            <Text style={styles.title}>Com'e andata la lezione?</Text>
            <Text style={styles.subtitle}>
              Valuta la tua esperienza con {teacherName}
            </Text>

            {/* Stars */}
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  onPressIn={() => setHoveredStar(star)}
                  onPressOut={() => setHoveredStar(0)}
                  style={styles.starButton}
                  data-testid={`rating-star-${star}`}
                >
                  <Ionicons
                    name={star <= (hoveredStar || rating) ? 'star' : 'star-outline'}
                    size={44}
                    color={star <= (hoveredStar || rating) ? '#FFD700' : '#444'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Rating text */}
            <Text style={[styles.ratingText, rating > 0 && styles.ratingTextActive]}>
              {getRatingText(rating)}
            </Text>

            {/* Comment input - only show when rated */}
            {rating > 0 && (
              <TextInput
                style={styles.commentInput}
                placeholder="Aggiungi un commento (opzionale)"
                placeholderTextColor="#666"
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={3}
                maxLength={500}
                textAlignVertical="top"
              />
            )}

            {/* BUTTONS - always visible, inside scrollable area */}
            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                data-testid="skip-rating-btn"
              >
                <Text style={styles.skipButtonText}>Salta</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, !rating && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={!rating}
                data-testid="submit-rating-btn"
              >
                <Ionicons name="send" size={16} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.submitButtonText}>Invia</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  topBar: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 20,
    alignItems: 'flex-end',
  },
  topOkButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 16,
  },
  topOkText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  ratingTextActive: {
    color: Colors.primary,
  },
  commentInput: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 15,
    minHeight: 80,
    maxHeight: 120,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  buttonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 4,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    color: '#999',
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
