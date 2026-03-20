import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../src/constants/colors';
import api from '../../src/services/api';

const DANCE_CATS = ['Salsa', 'Bachata', 'Hip Hop', 'Breakdance', 'Popping', 'Locking', 'House', 'Contemporary', 'Dancehall', 'Afro', 'Kizomba', 'Tango', 'Altro'];
const DURATIONS = [30, 45, 60, 90];

// Generate arrays for date/time pickers
const YEARS = [2026, 2027];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function pad(n: number): string { return String(n).padStart(2, '0'); }

function PickerWheel({ items, selected, onSelect, labelFn }: {
  items: number[];
  selected: number;
  onSelect: (v: number) => void;
  labelFn?: (v: number) => string;
}) {
  return (
    <ScrollView style={pw.scroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
      {items.map(v => (
        <TouchableOpacity
          key={v}
          style={[pw.item, selected === v && pw.itemActive]}
          onPress={() => onSelect(v)}
        >
          <Text style={[pw.text, selected === v && pw.textActive]}>
            {labelFn ? labelFn(v) : pad(v)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const pw = StyleSheet.create({
  scroll: { maxHeight: 180, flex: 1 },
  item: { paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  itemActive: { backgroundColor: Colors.primary },
  text: { color: '#888', fontSize: 16 },
  textActive: { color: '#FFF', fontWeight: '700' },
});

const MONTH_NAMES = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export default function CreateGroupLesson() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [day, setDay] = useState(new Date().getDate());
  const [hour, setHour] = useState(20);
  const [minute, setMinute] = useState(0);
  const [duration, setDuration] = useState(60);
  const [maxParticipants, setMaxParticipants] = useState('15');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const dateStr = `${day} ${MONTH_NAMES[month]} ${year}`;
  const timeStr = `${pad(hour)}:${pad(minute)}`;

  const handleCreate = async () => {
    if (!title.trim()) return Alert.alert('Errore', 'Inserisci un titolo');
    if (!category) return Alert.alert('Errore', 'Seleziona una disciplina');
    if (!price) return Alert.alert('Errore', 'Inserisci un prezzo');

    const scheduled_at = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;

    setLoading(true);
    try {
      await api.post('/group-lessons', {
        title: title.trim(),
        description: description.trim(),
        dance_category: category,
        scheduled_at,
        duration_minutes: duration,
        max_participants: parseInt(maxParticipants) || 15,
        price: parseFloat(price) || 0,
      });
      Alert.alert('Lezione creata!', 'La lezione e ora visibile nella sezione Lezioni.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Errore', error?.response?.data?.detail || 'Creazione fallita');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="back-btn">
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Crea Lezione di Gruppo</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
          {/* Title */}
          <Text style={s.label}>Titolo *</Text>
          <TextInput
            style={s.input}
            placeholder="Es: Salsa Intermedio"
            placeholderTextColor="#555"
            value={title}
            onChangeText={setTitle}
            data-testid="lesson-title-input"
          />

          {/* Description */}
          <Text style={s.label}>Descrizione</Text>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="Descrivi la lezione..."
            placeholderTextColor="#555"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            data-testid="lesson-description-input"
          />

          {/* Dance category */}
          <Text style={s.label}>Disciplina *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll}>
            {DANCE_CATS.map(c => (
              <TouchableOpacity
                key={c}
                style={[s.chip, category === c && s.chipActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={[s.chipText, category === c && s.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Date + Time - tappable fields */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Data *</Text>
              <TouchableOpacity style={s.pickerBtn} onPress={() => setShowDatePicker(true)} data-testid="date-picker-btn">
                <Ionicons name="calendar" size={18} color={Colors.primary} />
                <Text style={s.pickerText}>{dateStr}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Ora *</Text>
              <TouchableOpacity style={s.pickerBtn} onPress={() => setShowTimePicker(true)} data-testid="time-picker-btn">
                <Ionicons name="time" size={18} color={Colors.primary} />
                <Text style={s.pickerText}>{timeStr}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Duration */}
          <Text style={s.label}>Durata</Text>
          <View style={s.durRow}>
            {DURATIONS.map(d => (
              <TouchableOpacity
                key={d}
                style={[s.durBtn, duration === d && s.durBtnActive]}
                onPress={() => setDuration(d)}
              >
                <Text style={[s.durText, duration === d && s.durTextActive]}>{d} min</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Max participants + Price */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Max partecipanti</Text>
              <TextInput
                style={s.input}
                placeholder="15"
                placeholderTextColor="#555"
                value={maxParticipants}
                onChangeText={setMaxParticipants}
                keyboardType="numeric"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Prezzo (EUR) *</Text>
              <TextInput
                style={s.input}
                placeholder="8.00"
                placeholderTextColor="#555"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Create button */}
          <TouchableOpacity
            style={[s.createBtn, loading && { opacity: 0.5 }]}
            onPress={handleCreate}
            disabled={loading}
            data-testid="create-lesson-btn"
          >
            <Ionicons name="add-circle-outline" size={20} color="#FFF" />
            <Text style={s.createText}>{loading ? 'Creazione...' : 'Crea Lezione'}</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Seleziona Data</Text>
            <View style={s.pickersRow}>
              <PickerWheel items={DAYS} selected={day} onSelect={setDay} />
              <PickerWheel items={MONTHS} selected={month} onSelect={setMonth} labelFn={(v) => MONTH_NAMES[v]} />
              <PickerWheel items={YEARS} selected={year} onSelect={setYear} labelFn={(v) => String(v)} />
            </View>
            <TouchableOpacity style={s.confirmBtn} onPress={() => setShowDatePicker(false)} data-testid="confirm-date-btn">
              <Text style={s.confirmText}>Conferma</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Seleziona Ora</Text>
            <View style={s.pickersRow}>
              <PickerWheel items={HOURS} selected={hour} onSelect={setHour} />
              <Text style={s.colonText}>:</Text>
              <PickerWheel items={MINUTES} selected={minute} onSelect={setMinute} />
            </View>
            <TouchableOpacity style={s.confirmBtn} onPress={() => setShowTimePicker(false)} data-testid="confirm-time-btn">
              <Text style={s.confirmText}>Conferma</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1C1C1E',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  label: { color: '#AAA', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: '#2C2C2E',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  chipsScroll: { marginBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.surface, marginRight: 8, borderWidth: 1, borderColor: '#2C2C2E',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: '#888', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#FFF' },
  row: { flexDirection: 'row' },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#2C2C2E',
  },
  pickerText: { color: '#FFF', fontSize: 15, fontWeight: '500' },
  durRow: { flexDirection: 'row', gap: 8 },
  durBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.surface, alignItems: 'center',
    borderWidth: 1, borderColor: '#2C2C2E',
  },
  durBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  durText: { color: '#888', fontSize: 13, fontWeight: '600' },
  durTextActive: { color: '#FFF' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, marginTop: 24,
  },
  createText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  // Modal styles
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#1a1a2e', borderRadius: 20, padding: 20,
    width: '85%',
  },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  pickersRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  colonText: { color: '#FFF', fontSize: 24, fontWeight: '700', alignSelf: 'center', paddingHorizontal: 4 },
  confirmBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  confirmText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
