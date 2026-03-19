import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Platform,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

const SCREEN_H = Dimensions.get('window').height;

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
  const [kbOpen, setKbOpen] = useState(false);
  const shiftY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      const kbH = e.endCoordinates.height;
      setKbOpen(true);
      Animated.timing(shiftY, {
        toValue: -(kbH / 2 + 20),
        duration: Platform.OS === 'ios' ? 250 : 150,
        useNativeDriver: true,
      }).start();
    };
    const onHide = () => {
      setKbOpen(false);
      Animated.timing(shiftY, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? 250 : 150,
        useNativeDriver: true,
      }).start();
    };

    const sub1 = Keyboard.addListener(showEvent, onShow);
    const sub2 = Keyboard.addListener(hideEvent, onHide);
    return () => { sub1.remove(); sub2.remove(); };
  }, []);

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
        <View style={styles.overlay}>
          <Animated.View style={[styles.container, { transform: [{ translateY: shiftY }] }]}>
            {/* Close keyboard hint when keyboard is open */}
            {kbOpen && (
              <TouchableOpacity
                style={styles.dismissKbBtn}
                onPress={Keyboard.dismiss}
                data-testid="dismiss-keyboard-btn"
              >
                <Ionicons name="chevron-down" size={16} color="#999" />
                <Text style={styles.dismissKbText}>Chiudi tastiera</Text>
              </TouchableOpacity>
            )}

            {/* Icon */}
            <View style={styles.iconRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="videocam" size={28} color="#FFF" />
              </View>
            </View>

            <Text style={styles.title}>Com'e andata la lezione?</Text>
            <Text style={styles.subtitle}>Valuta la tua esperienza con {teacherName}</Text>

            {/* Stars */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setRating(s)} style={styles.starBtn} data-testid={`rating-star-${s}`}>
                  <Ionicons name={s <= rating ? 'star' : 'star-outline'} size={36} color={s <= rating ? '#FFD700' : '#444'} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Comment - optional, appears when rating selected */}
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
                data-testid="rating-comment-input"
              />
            )}

            {/* Buttons - always visible */}
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
          </Animated.View>
        </View>
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
  dismissKbBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 4,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
  },
  dismissKbText: { color: '#999', fontSize: 12 },
  iconRow: { marginBottom: 10 },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  subtitle: { color: '#888', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  starBtn: { padding: 2 },
  btnsRow: { flexDirection: 'row', width: '100%', gap: 10, marginTop: 4 },
  skipBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
  },
  skipText: { color: '#999', fontSize: 15, fontWeight: '600' },
  sendBtn: {
    flex: 1,
    paddingVertical: 13,
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
    marginBottom: 10,
  },
});
