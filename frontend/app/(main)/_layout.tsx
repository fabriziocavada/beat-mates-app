import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import Colors from '../../src/constants/colors';
import LessonNotificationBanner from '../../src/components/LessonNotificationBanner';

export default function MainLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'fade',
        }}
      />
      <LessonNotificationBanner />
    </View>
  );
}
