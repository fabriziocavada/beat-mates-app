import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { getMediaUrl } from '../services/api';
import Colors from '../constants/colors';

interface TabBarProps {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
}

const TAB_ROUTES: Record<string, string> = {
  home: '/(main)/home',
  create: '/(main)/create-post',
  available: '/(main)/available-teachers',
  reels: '/(main)/reels',
  music: '/(main)/music',
  profile: '/(main)/profile',
};

export default function TabBar({ activeTab, onTabPress }: TabBarProps) {
  const { user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const currentTab = activeTab || (() => {
    if (pathname.includes('/home')) return 'home';
    if (pathname.includes('/create')) return 'create';
    if (pathname.includes('/available')) return 'available';
    if (pathname.includes('/reels')) return 'reels';
    if (pathname.includes('/music') || pathname.includes('/player')) return 'music';
    if (pathname.includes('/profile')) return 'profile';
    return 'home';
  })();

  const handlePress = (tabId: string) => {
    if (onTabPress) {
      onTabPress(tabId);
    } else {
      const route = TAB_ROUTES[tabId];
      if (route) router.push(route as any);
    }
  };

  const tabs = [
    { id: 'home', icon: 'home', iconOutline: 'home-outline' },
    { id: 'create', icon: 'add-circle', iconOutline: 'add-circle-outline' },
    { id: 'available', icon: 'tv', iconOutline: 'tv-outline', hasDot: true },
    { id: 'reels', icon: 'play', iconOutline: 'play-outline' },
    { id: 'music', icon: 'musical-notes', iconOutline: 'musical-notes-outline' },
    { id: 'profile', icon: 'person', iconOutline: 'person-outline', isProfile: true },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;

        if (tab.isProfile) {
          return (
            <TouchableOpacity key={tab.id} style={styles.tab} onPress={() => handlePress(tab.id)}>
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
          <TouchableOpacity key={tab.id} style={styles.tab} onPress={() => handlePress(tab.id)} data-testid={`tab-${tab.id}`}>
            <View style={styles.iconWrapper}>
              <Ionicons
                name={isActive ? tab.icon as any : tab.iconOutline as any}
                size={tab.id === 'create' ? 28 : 24}
                color={isActive ? Colors.primary : '#FFFFFF'}
              />
              {tab.hasDot && <View style={styles.liveDot} />}
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
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  iconWrapper: { position: 'relative' },
  liveDot: { position: 'absolute', top: -2, right: -4, width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.primary },
  profileContainer: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#2C2C2E' },
  profileContainerActive: { borderColor: Colors.primary },
  profileImage: { width: '100%', height: '100%' },
});
