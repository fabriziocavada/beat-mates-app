import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';

interface StoryUser {
  user_id: string;
  username: string;
  profile_image: string | null;
  has_unread: boolean;
  stories: any[];
}

interface StoriesBarProps {
  stories: StoryUser[];
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
                <Ionicons name="person" size={28} color="#8E8E93" />
              </View>
            )}
          </View>
          <View style={styles.addButton}>
            <Ionicons name="add" size={14} color="#FFFFFF" />
          </View>
        </View>
        <Text style={styles.storyUsername} numberOfLines={1}>Your Story</Text>
      </TouchableOpacity>
      
      {/* Other Stories */}
      {stories.map((story) => (
        <TouchableOpacity
          key={story.user_id}
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
                  <Ionicons name="person" size={28} color="#8E8E93" />
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
    backgroundColor: '#000000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#3A3A3C',
  },
  content: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: 6,
    width: 68,
  },
  addStoryContainer: {
    position: 'relative',
  },
  storyBorder: {
    padding: 2,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#3A3A3C',
  },
  storyBorderActive: {
    borderColor: '#FF6978',
  },
  storyImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
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
    backgroundColor: '#1C1C1E',
  },
  addButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF6978',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  storyUsername: {
    color: '#FFFFFF',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
});
