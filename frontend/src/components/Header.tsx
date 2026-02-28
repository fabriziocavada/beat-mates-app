import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

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
  return (
    <View style={styles.container}>
      {showSearch ? (
        <TouchableOpacity onPress={onSearchPress} style={styles.iconButton}>
          <Ionicons name="search-outline" size={24} color={Colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconButton} />
      )}
      
      <View style={styles.logoContainer}>
        <Text style={styles.logoWhite}>BEAT </Text>
        <Text style={styles.logoRed}>MATES</Text>
      </View>
      
      <View style={styles.rightIcons}>
        {showNotifications && (
          <TouchableOpacity onPress={onNotificationsPress} style={styles.iconButton}>
            <Ionicons name="heart-outline" size={24} color={Colors.text} />
          </TouchableOpacity>
        )}
        {showMessages && (
          <TouchableOpacity onPress={onMessagesPress} style={styles.iconButton}>
            <Ionicons name="paper-plane-outline" size={24} color={Colors.text} />
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
    backgroundColor: Colors.background,
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
  rightIcons: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 4,
    marginHorizontal: 4,
  },
});
