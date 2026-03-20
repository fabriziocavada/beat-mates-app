import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  lessonTitle: string;
  teacherName: string;
  price: number;
  date: string;
}

export default function PaymentModal({
  visible, onClose, onConfirm, lessonTitle, teacherName, price, date,
}: PaymentModalProps) {
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<'summary' | 'success'>('summary');

  const handlePay = async () => {
    setProcessing(true);
    // Simulated payment delay
    await new Promise(r => setTimeout(r, 1500));
    setProcessing(false);
    setStep('success');
  };

  const handleDone = () => {
    setStep('summary');
    onConfirm();
  };

  const handleClose = () => {
    setStep('summary');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />

          {step === 'summary' ? (
            <>
              {/* Header */}
              <View style={s.header}>
                <Text style={s.title}>Conferma Pagamento</Text>
                <TouchableOpacity onPress={handleClose} style={s.closeBtn} data-testid="close-payment-modal">
                  <Ionicons name="close" size={22} color="#FFF" />
                </TouchableOpacity>
              </View>

              {/* Lesson details */}
              <View style={s.lessonBox}>
                <Text style={s.lessonTitle}>{lessonTitle}</Text>
                <View style={s.detailRow}>
                  <Ionicons name="person-outline" size={16} color="#AAA" />
                  <Text style={s.detailText}>{teacherName}</Text>
                </View>
                <View style={s.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color="#AAA" />
                  <Text style={s.detailText}>{date}</Text>
                </View>
              </View>

              {/* Price breakdown */}
              <View style={s.priceBox}>
                <View style={s.priceRow}>
                  <Text style={s.priceLabel}>Lezione di gruppo</Text>
                  <Text style={s.priceValue}>{price.toFixed(2)} EUR</Text>
                </View>
                <View style={s.divider} />
                <View style={s.priceRow}>
                  <Text style={s.totalLabel}>Totale</Text>
                  <Text style={s.totalValue}>{price.toFixed(2)} EUR</Text>
                </View>
              </View>

              {/* Mock card display */}
              <View style={s.cardBox}>
                <View style={s.cardIconRow}>
                  <Ionicons name="card-outline" size={24} color={Colors.primary} />
                  <Text style={s.cardText}>**** **** **** 4242</Text>
                </View>
                <Text style={s.cardSub}>Visa - Mock Payment</Text>
              </View>

              {/* Pay button */}
              <TouchableOpacity
                style={[s.payBtn, processing && { opacity: 0.6 }]}
                onPress={handlePay}
                disabled={processing}
                data-testid="confirm-payment-btn"
              >
                {processing ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="lock-closed" size={18} color="#FFF" />
                    <Text style={s.payText}>Paga {price.toFixed(2)} EUR</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={s.disclaimer}>
                Pagamento simulato. Sara sostituito con Stripe.
              </Text>
            </>
          ) : (
            <>
              {/* Success */}
              <View style={s.successBox}>
                <View style={s.checkCircle}>
                  <Ionicons name="checkmark" size={40} color="#FFF" />
                </View>
                <Text style={s.successTitle}>Pagamento completato!</Text>
                <Text style={s.successSub}>
                  Hai prenotato "{lessonTitle}" con {teacherName}.{'\n'}
                  Riceverai una notifica quando la lezione iniziera.
                </Text>
                <TouchableOpacity style={s.doneBtn} onPress={handleDone} data-testid="payment-done-btn">
                  <Text style={s.doneText}>Perfetto!</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#444', alignSelf: 'center', marginTop: 10, marginBottom: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
  },
  title: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#333', alignItems: 'center', justifyContent: 'center',
  },
  lessonBox: {
    backgroundColor: '#222244', borderRadius: 14, padding: 16, marginBottom: 16,
  },
  lessonTitle: { color: '#FFF', fontSize: 17, fontWeight: '700', marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  detailText: { color: '#AAA', fontSize: 14 },
  priceBox: {
    backgroundColor: '#222244', borderRadius: 14, padding: 16, marginBottom: 16,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: '#AAA', fontSize: 14 },
  priceValue: { color: '#FFF', fontSize: 14 },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 12 },
  totalLabel: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  totalValue: { color: Colors.primary, fontSize: 20, fontWeight: '800' },
  cardBox: {
    backgroundColor: '#222244', borderRadius: 14, padding: 16, marginBottom: 20,
  },
  cardIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardText: { color: '#FFF', fontSize: 16, fontWeight: '600', letterSpacing: 1 },
  cardSub: { color: '#666', fontSize: 12, marginTop: 6, marginLeft: 34 },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
  },
  payText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  disclaimer: { color: '#555', fontSize: 11, textAlign: 'center', marginTop: 12 },
  // Success
  successBox: { alignItems: 'center', paddingVertical: 30 },
  checkCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#28A745', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  successTitle: { color: '#FFF', fontSize: 22, fontWeight: '700', marginBottom: 10 },
  successSub: { color: '#AAA', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 10 },
  doneBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 40, paddingVertical: 14,
  },
  doneText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
