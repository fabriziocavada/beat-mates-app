import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../constants/colors';
import { useAuthStore } from '../store/authStore';

interface Story {
  id: string;
  user_id: string;
  username: string;
  profile_image: string | null;
  has_unread: boolean;
}

interface StoriesBarProps {
  stories: Story[];
  onStoryPress?: (userId: string) => void;
  onAddStoryPress?: () => void;
}

export default function StoriesBar({ stories, onStoryPress, onAddStoryPress }: StoriesBarProps) {
  const user = useAuthStore((state) => state.user);
  
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Add Story */}
      <TouchableOpacity style={styles.storyItem} onPress={onAddStoryPress}>
        <View style={styles.addStoryContainer}>
          <View style={styles.storyImageContainer}>
            {user?.profile_image ? (
              <Image
                source={{ uri: user.profile_image }}
                style={styles.storyImage}
              />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="person" size={30} color={Colors.textSecondary} />
              </View>
            )}
          </View>
          <View style={styles.addButton}>
            <Ionicons name="add" size={16} color={Colors.text} />
          </View>
        </View>
        <Text style={styles.storyUsername} numberOfLines={1}>Your Story</Text>
      </TouchableOpacity>
      
      {/* Other Stories */}
      {stories.map((story) => (
        <TouchableOpacity
          key={story.id}
          style={styles.storyItem}
          onPress={() => onStoryPress?.(story.user_id)}
        >
          <View style={[
            styles.storyBorder,
            story.has_unread && styles.storyBorderActive
          ]}>
            <View style={styles.storyImageContainer}>
              {story.profile_image ? (
                <Image
                  source={{ uri: story.profile_image }}
                  style={styles.storyImage}
                />
              ) : (
                <View style={styles.placeholderImage}>
                  <Ionicons name="person" size={30} color={Colors.textSecondary} />
                </View>
              )}
            </View>
          </View>
          <Text style={styles.storyUsername} numberOfLines={1}>{story.username}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  content: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: 6,
    width: 72,
  },
  addStoryContainer: {
    position: 'relative',
  },
  storyBorder: {
    padding: 3,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  storyBorderActive: {
    borderColor: Colors.storyGradientStart,
  },
  storyImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  addButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  storyUsername: {
    color: Colors.text,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});
