import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

interface Teacher {
  id: string;
  username: string;
  name: string;
  profile_image: string | null;
  rating: number;
  hourly_rate: number;
  dance_categories: string[];
  available_since: string;
}

interface AvailableTeacherCardProps {
  teacher: Teacher;
  onPress?: () => void;
  onBookPress?: () => void;
}

export default function AvailableTeacherCard({ teacher, onPress, onBookPress }: AvailableTeacherCardProps) {
  const [minutes, setMinutes] = useState(0);
  
  useEffect(() => {
    // Calculate initial minutes
    const calcMinutes = () => {
      if (!teacher.available_since) return 0;
      const since = new Date(teacher.available_since);
      const now = new Date();
      return Math.floor((now.getTime() - since.getTime()) / (1000 * 60));
    };
    
    setMinutes(calcMinutes());
    
    // Update every minute
    const interval = setInterval(() => {
      setMinutes(calcMinutes());
    }, 60000);
    
    return () => clearInterval(interval);
  }, [teacher.available_since]);
  
  const getTimerColor = () => {
    if (minutes < 5) return Colors.success;
    if (minutes < 15) return '#FFA500'; // Orange
    return Colors.primary;
  };
  
  const renderStars = () => {
    const stars = [];
    const rating = Math.round(teacher.rating);
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={12}
          color={i <= rating ? '#FFD700' : Colors.textMuted}
          style={{ marginRight: 1 }}
        />
      );
    }
    return stars;
  };
  
  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.avatarContainer}>
        <View style={[styles.avatarBorder, { borderColor: Colors.success }]}>
          {teacher.profile_image ? (
            <Image
              source={{ uri: teacher.profile_image }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color={Colors.textSecondary} />
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.info}>
        <Text style={styles.username}>{teacher.username}</Text>
        <View style={styles.starsContainer}>
          {renderStars()}
        </View>
      </View>
      
      {onBookPress && (
        <TouchableOpacity onPress={onBookPress} style={styles.bookButton}>
          <Text style={styles.bookText}>book</Text>
        </TouchableOpacity>
      )}
      
      <View style={[styles.timerContainer, { borderColor: getTimerColor() }]}>
        {minutes === 0 ? (
          <Ionicons name="play" size={20} color={Colors.success} />
        ) : (
          <>
            <Text style={[styles.timerNumber, { color: getTimerColor() }]}>{minutes}</Text>
            <Text style={[styles.timerLabel, { color: getTimerColor() }]}>min</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatarBorder: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  username: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  starsContainer: {
    flexDirection: 'row',
    marginTop: 2,
  },
  bookButton: {
    marginRight: 12,
  },
  bookText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  timerContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  timerLabel: {
    fontSize: 10,
  },
});
