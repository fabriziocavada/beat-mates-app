import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface HeaderProps {
  showSearch?: boolean;
  showNotifications?: boolean;
  showMessages?: boolean;
  onSearchPress?: () => void;
  onNotificationsPress?: () => void;
  onMessagesPress?: () => void;
}

export default function Header({
  showSearch = true,
  showNotifications = true,
  showMessages = true,
  onSearchPress,
  onNotificationsPress,
  onMessagesPress,
}: HeaderProps) {
  const { user } = useAuthStore();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user?.is_available) {
      checkPending();
      const interval = setInterval(checkPending, 15000); // Check every 15 seconds
      return () => clearInterval(interval);
    }
  }, [user?.is_available]);

  const checkPending = async () => {
    try {
      const response = await api.get('/live-sessions/pending/count');
      setPendingCount(response.data.count);
    } catch (error) {
      // Silently fail
    }
  };

  return (
    <View style={styles.container}>
      {showSearch ? (
        <TouchableOpacity onPress={onSearchPress} style={styles.iconButton}>
          <Ionicons name="search-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconButton} />
      )}
      
      <View style={styles.logoContainer}>
        <Text style={styles.beatText}>BEAT </Text>
        <Text style={styles.matesText}>MATES</Text>
      </View>
      
      <View style={styles.rightIcons}>
        {showNotifications && (
          <TouchableOpacity onPress={onNotificationsPress} style={styles.iconButton}>
            <Ionicons name="heart-outline" size={24} color="#FFFFFF" />
            {pendingCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        {showMessages && (
          <TouchableOpacity onPress={onMessagesPress} style={styles.iconButton}>
            <Ionicons name="paper-plane-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
  },
  logoContainer: {
    flexDirection: 'row',
  },
  beatText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  matesText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF6978',
  },
  rightIcons: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 4,
    marginHorizontal: 4,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF6978',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
