import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

const { width, height } = Dimensions.get('window');

interface CallRatingModalProps {
  visible: boolean;
  teacherName: string;
  sessionId: string;
  onSubmit: (rating: number, comment: string) => void;
  onSkip: () => void;
}

export default function CallRatingModal({
  visible,
  teacherName,
  sessionId,
  onSubmit,
  onSkip,
}: CallRatingModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoveredStar, setHoveredStar] = useState(0);

  const handleSubmit = () => {
    if (rating > 0) {
      onSubmit(rating, comment);
    }
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="videocam" size={40} color="#FFF" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Com'è andata la lezione?</Text>
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
                  size={48}
                  color={star <= (hoveredStar || rating) ? '#FFD700' : '#444'}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Rating text */}
          <Text style={[styles.ratingText, rating > 0 && styles.ratingTextActive]}>
            {getRatingText(rating)}
          </Text>

          {/* Comment input */}
          {rating > 0 && (
            <TextInput
              style={styles.commentInput}
              placeholder="Aggiungi un commento (opzionale)"
              placeholderTextColor="#666"
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={500}
            />
          )}

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={onSkip}
              data-testid="skip-rating-btn"
            >
              <Text style={styles.skipButtonText}>Salta</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={rating === 0}
              data-testid="submit-rating-btn"
            >
              <Text style={styles.submitButtonText}>Invia valutazione</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    color: '#666',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
  },
  ratingTextActive: {
    color: '#FFD700',
  },
  commentInput: {
    width: '100%',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#333',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
