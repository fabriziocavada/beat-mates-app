import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../src/constants/colors';
import api from '../../../src/services/api';

interface User {
  id: string;
  username: string;
  name: string;
  profile_image: string | null;
  hourly_rate: number;
}

interface AvailabilitySlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  price: number;
  is_booked: boolean;
}

export default function BookScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [user, setUser] = useState<User | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  
  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);
  
  const loadData = async () => {
    try {
      const [userResponse, slotsResponse] = await Promise.all([
        api.get(`/users/${id}`),
        api.get(`/users/${id}/availability-slots`),
      ]);
      setUser(userResponse.data);
      setSlots(slotsResponse.data);
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    
    return {
      month: months[date.getMonth()],
      day: date.getDate(),
      dayName: days[date.getDay()],
    };
  };
  
  const handleBook = async () => {
    if (!selectedSlot) return;
    
    setIsBooking(true);
    try {
      await api.post('/bookings', { slot_id: selectedSlot.id });
      Alert.alert(
        'Booking Confirmed!',
        `We will send you a notification on ${selectedSlot.date} at ${selectedSlot.start_time}`,
        [
          {
            text: 'Return to Main Menu',
            onPress: () => router.push('/(main)/home'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to book');
    } finally {
      setIsBooking(false);
    }
  };
  
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.logoContainer}>
          <Text style={styles.logoWhite}>BEAT </Text>
          <Text style={styles.logoRed}>MATES</Text>
        </View>
        <View style={styles.headerRight}>
          <Ionicons name="heart-outline" size={24} color={Colors.text} />
          <Ionicons name="paper-plane-outline" size={24} color={Colors.text} style={{ marginLeft: 16 }} />
        </View>
      </View>
      
      <ScrollView style={styles.content}>
        {/* User Info */}
        <View style={styles.userSection}>
          <View style={styles.avatarBorder}>
            {user?.profile_image ? (
              <Image source={{ uri: user.profile_image }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={30} color={Colors.textSecondary} />
              </View>
            )}
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
        </View>
        
        <Text style={styles.title}>Lessons available</Text>
        <Text style={styles.subtitle}>Available dates</Text>
        
        {/* Slots */}
        {slots.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No available slots</Text>
          </View>
        ) : (
          slots.map((slot) => {
            const dateInfo = formatDate(slot.date);
            const isSelected = selectedSlot?.id === slot.id;
            
            return (
              <TouchableOpacity
                key={slot.id}
                style={[
                  styles.slotCard,
                  isSelected && styles.slotCardSelected,
                ]}
                onPress={() => setSelectedSlot(slot)}
              >
                <View style={styles.slotDateSection}>
                  <Text style={[styles.slotMonth, isSelected && styles.slotTextSelected]}>
                    {dateInfo.month}
                  </Text>
                  <Text style={[styles.slotDay, isSelected && styles.slotTextSelected]}>
                    {dateInfo.day}
                  </Text>
                  <Text style={[styles.slotDayName, isSelected && styles.slotTextSelected]}>
                    {dateInfo.dayName}
                  </Text>
                </View>
                
                <View style={styles.slotTimeSection}>
                  <Text style={[styles.slotTimeLabel, isSelected && styles.slotTextSelected]}>Ora</Text>
                  <Text style={[styles.slotTime, isSelected && styles.slotTextSelected]}>
                    {slot.start_time}
                  </Text>
                  <Text style={[styles.slotDuration, isSelected && styles.slotTextSelected]}>30 min</Text>
                </View>
                
                <Text style={[styles.slotPrice, isSelected && styles.slotTextSelected]}>
                  {slot.price} €
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
      
      {selectedSlot && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.bookButton}
            onPress={handleBook}
            disabled={isBooking}
          >
            {isBooking ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.bookButtonText}>MAKE THE PAYMENT - {selectedSlot.price}€</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logoContainer: {
    flexDirection: 'row',
  },
  logoWhite: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
  },
  logoRed: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  headerRight: {
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  userSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarBorder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.primary,
    padding: 3,
    marginBottom: 12,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginBottom: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  slotCardSelected: {
    backgroundColor: Colors.primary,
  },
  slotDateSection: {
    flex: 1,
  },
  slotMonth: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  slotDay: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  slotDayName: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  slotTimeSection: {
    flex: 1,
    alignItems: 'center',
  },
  slotTimeLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  slotTime: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  slotDuration: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  slotPrice: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  slotTextSelected: {
    color: Colors.text,
  },
  footer: {
    padding: 16,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  bookButton: {
    backgroundColor: Colors.success,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  bookButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
