import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../src/constants/colors';
import TabBar from '../../src/components/TabBar';
import api from '../../src/services/api';

const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

const DANCE_CATEGORIES = [
  { id: 'classic', name: 'Classico', color: '#FFA500' },
  { id: 'pop', name: 'Pop', color: '#8B5CF6' },
  { id: 'contemporary', name: 'Contemp.', color: '#EF4444' },
  { id: 'latin', name: 'Latino', color: '#374151' },
  { id: 'jazz', name: 'Jazz', color: '#10B981' },
];

export default function CalendarScreen() {
  const router = useRouter();
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('14:00');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [price, setPrice] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  
  const getDaysInMonth = () => {
    const days = [];
    const date = new Date(selectedYear, selectedMonth, 1);
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    
    for (let i = 1; i <= Math.min(daysInMonth, 31); i++) {
      const d = new Date(selectedYear, selectedMonth, i);
      days.push({
        date: i,
        dayName: DAYS[d.getDay()],
      });
    }
    
    return days;
  };
  
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId);
      }
      return [...prev, categoryId];
    });
  };
  
  const handleSave = async () => {
    if (selectedCategories.length === 0) {
      Alert.alert('Error', 'Please select at least one dance category');
      return;
    }
    
    setIsLoading(true);
    try {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
      
      await api.post('/availability-slots', {
        date: dateStr,
        start_time: startTime,
        end_time: endTime,
        dance_categories: selectedCategories,
        price: price,
      });
      
      Alert.alert('Success', 'Availability slot saved!');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTabPress = (tab: string) => {
    switch (tab) {
      case 'home':
        router.push('/(main)/home');
        break;
      case 'profile':
        router.push('/(main)/profile');
        break;
    }
  };
  
  const days = getDaysInMonth();
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} data-testid="calendar-close-btn">
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.calendarHeaderTitle}>Calendario lezioni</Text>
        <View style={{ width: 28 }} />
      </View>
      
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Lesson calendar</Text>
        
        {/* Year */}
        <Text style={styles.label}>Year</Text>
        <View style={styles.yearSelector}>
          <TouchableOpacity onPress={() => setSelectedYear(selectedYear - 1)}>
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.yearText}>{selectedYear}</Text>
          <TouchableOpacity onPress={() => setSelectedYear(selectedYear + 1)}>
            <Ionicons name="chevron-forward" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        
        {/* Month */}
        <Text style={styles.label}>Month</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.monthScroll}
        >
          {MONTHS.map((month, index) => (
            <TouchableOpacity
              key={month}
              style={[
                styles.monthItem,
                selectedMonth === index && styles.monthItemSelected,
              ]}
              onPress={() => setSelectedMonth(index)}
            >
              <Text style={[
                styles.monthText,
                selectedMonth === index && styles.monthTextSelected,
              ]}>
                {month}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        {/* Day */}
        <Text style={styles.label}>Day</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dayScroll}
        >
          {days.map((day) => (
            <TouchableOpacity
              key={day.date}
              style={[
                styles.dayItem,
                selectedDay === day.date && styles.dayItemSelected,
              ]}
              onPress={() => setSelectedDay(day.date)}
            >
              <Text style={[
                styles.dayNumber,
                selectedDay === day.date && styles.dayTextSelected,
              ]}>
                {day.date}
              </Text>
              <Text style={[
                styles.dayName,
                selectedDay === day.date && styles.dayTextSelected,
              ]}>
                {day.dayName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        {/* Hours */}
        <Text style={styles.label}>hours</Text>
        <View style={styles.hoursContainer}>
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>From</Text>
            <View style={styles.timePickerRow}>
              <TouchableOpacity
                style={styles.timeArrow}
                onPress={() => {
                  const [h, m] = startTime.split(':').map(Number);
                  const newH = h > 0 ? h - 1 : 23;
                  setStartTime(`${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                }}
              >
                <Ionicons name="chevron-up" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.timeValue}>{startTime}</Text>
              <TouchableOpacity
                style={styles.timeArrow}
                onPress={() => {
                  const [h, m] = startTime.split(':').map(Number);
                  const newH = h < 23 ? h + 1 : 0;
                  setStartTime(`${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                }}
              >
                <Ionicons name="chevron-down" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.minuteRow}>
              <TouchableOpacity
                onPress={() => {
                  const [h, m] = startTime.split(':').map(Number);
                  const newM = m >= 30 ? 0 : 30;
                  setStartTime(`${String(h).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
                }}
              >
                <Text style={styles.minuteToggle}>:{startTime.split(':')[1]} tap</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Ionicons name="arrow-forward" size={24} color={Colors.textSecondary} />
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>To</Text>
            <View style={styles.timePickerRow}>
              <TouchableOpacity
                style={styles.timeArrow}
                onPress={() => {
                  const [h, m] = endTime.split(':').map(Number);
                  const newH = h > 0 ? h - 1 : 23;
                  setEndTime(`${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                }}
              >
                <Ionicons name="chevron-up" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.timeValue}>{endTime}</Text>
              <TouchableOpacity
                style={styles.timeArrow}
                onPress={() => {
                  const [h, m] = endTime.split(':').map(Number);
                  const newH = h < 23 ? h + 1 : 0;
                  setEndTime(`${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                }}
              >
                <Ionicons name="chevron-down" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.minuteRow}>
              <TouchableOpacity
                onPress={() => {
                  const [h, m] = endTime.split(':').map(Number);
                  const newM = m >= 30 ? 0 : 30;
                  setEndTime(`${String(h).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
                }}
              >
                <Text style={styles.minuteToggle}>:{endTime.split(':')[1]} tap</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        {/* Dance Category */}
        <Text style={styles.label}>Dance category</Text>
        <View style={styles.categoriesContainer}>
          {DANCE_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryItem,
                selectedCategories.includes(category.id) && styles.categoryItemSelected,
              ]}
              onPress={() => toggleCategory(category.id)}
            >
              <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
              <Text style={styles.categoryText}>{category.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addCategoryButton}>
            <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        
        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <Text style={styles.saveButtonText}>SAVE</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      
      <TabBar activeTab="profile" onTabPress={handleTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1C1C1E',
  },
  closeBtn: {
    padding: 4,
  },
  calendarHeaderTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    color: Colors.text,
    fontSize: 14,
    marginBottom: 8,
    marginTop: 16,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  yearText: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '600',
  },
  monthScroll: {
    marginBottom: 8,
  },
  monthItem: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    marginRight: 8,
  },
  monthItemSelected: {
    backgroundColor: Colors.primary,
  },
  monthText: {
    color: Colors.text,
    fontSize: 14,
  },
  monthTextSelected: {
    color: Colors.text,
    fontWeight: '600',
  },
  dayScroll: {
    marginBottom: 8,
  },
  dayItem: {
    width: 60,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    marginRight: 8,
    alignItems: 'center',
  },
  dayItemSelected: {
    backgroundColor: Colors.primary,
  },
  dayNumber: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  dayName: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  dayTextSelected: {
    color: Colors.text,
  },
  hoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  timeBox: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    color: Colors.primary,
    fontSize: 12,
    marginBottom: 4,
  },
  timeValue: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  timePickerRow: {
    alignItems: 'center',
  },
  timeArrow: {
    padding: 6,
  },
  minuteRow: {
    marginTop: 2,
  },
  minuteToggle: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  categoryItemSelected: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  categoryText: {
    color: Colors.text,
    fontSize: 14,
  },
  addCategoryButton: {
    padding: 8,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  saveButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
