import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';
import { useAuthStore } from '../store/authStore';

interface TabBarProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
}

export default function TabBar({ activeTab, onTabPress }: TabBarProps) {
  const user = useAuthStore((state) => state.user);
  
  const tabs = [
    { id: 'home', icon: 'home', iconOutline: 'home-outline' },
    { id: 'create', icon: 'add-circle', iconOutline: 'add-circle-outline' },
    { id: 'available', icon: 'people', iconOutline: 'people-outline' },
    { id: 'reels', icon: 'play-circle', iconOutline: 'play-circle-outline' },
    { id: 'music', icon: 'musical-notes', iconOutline: 'musical-notes-outline' },
  ];
  
  return (
    <View style={styles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={styles.tab}
          onPress={() => onTabPress(tab.id)}
        >
          <Ionicons
            name={activeTab === tab.id ? tab.icon as any : tab.iconOutline as any}
            size={26}
            color={activeTab === tab.id ? Colors.primary : Colors.text}
          />
        </TouchableOpacity>
      ))}
      
      <TouchableOpacity
        style={styles.tab}
        onPress={() => onTabPress('profile')}
      >
        <View style={[
          styles.profileImage,
          activeTab === 'profile' && styles.profileImageActive
        ]}>
          {user?.profile_image ? (
            <Image
              source={{ uri: user.profile_image }}
              style={styles.avatar}
            />
          ) : (
            <Ionicons name="person" size={18} color={Colors.text} />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.background,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  profileImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileImageActive: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
});
