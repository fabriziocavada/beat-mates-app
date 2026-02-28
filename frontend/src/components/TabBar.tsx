import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { getMediaUrl } from '../services/api';
import Colors from '../constants/colors';

interface TabBarProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
}

export default function TabBar({ activeTab, onTabPress }: TabBarProps) {
  const { user } = useAuthStore();

  const tabs = [
    { id: 'home', icon: 'home', iconOutline: 'home-outline', label: 'Home' },
    { id: 'create', icon: 'add-circle', iconOutline: 'add-circle-outline', label: 'Create' },
    { id: 'available', icon: 'tv', iconOutline: 'tv-outline', label: 'Live', hasDot: true },
    { id: 'reels', icon: 'play', iconOutline: 'play-outline', label: 'Reels' },
    { id: 'music', icon: 'musical-notes', iconOutline: 'musical-notes-outline', label: 'Music' },
    { id: 'profile', icon: 'person', iconOutline: 'person-outline', label: 'Profile', isProfile: true },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        if (tab.isProfile) {
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => onTabPress(tab.id)}
            >
              <View style={[styles.profileContainer, isActive && styles.profileContainerActive]}>
                {user?.profile_image ? (
                  <Image source={{ uri: getMediaUrl(user.profile_image) || '' }} style={styles.profileImage} />
                ) : (
                  <Ionicons name="person" size={18} color={isActive ? Colors.primary : '#FFFFFF'} />
                )}
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => onTabPress(tab.id)}
          >
            <View style={styles.iconWrapper}>
              <Ionicons
                name={isActive ? tab.icon as any : tab.iconOutline as any}
                size={tab.id === 'create' ? 28 : 24}
                color={isActive ? Colors.primary : '#FFFFFF'}
              />
              {tab.hasDot && (
                <View style={styles.liveDot} />
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    borderTopWidth: 0.5,
    borderTopColor: '#2C2C2E',
    paddingBottom: 20,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconWrapper: {
    position: 'relative',
  },
  liveDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.primary,
  },
  profileContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#2C2C2E',
  },
  profileContainerActive: {
    borderColor: Colors.primary,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
});
