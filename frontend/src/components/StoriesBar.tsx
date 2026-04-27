import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { getMediaUrl } from '../services/api';

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
  const myStoryGroup = stories.find((s) => s.user_id === user?.id);
  const hasMyStory = !!myStoryGroup;
  const otherStories = stories.filter((s) => s.user_id !== user?.id);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Add / Your Story */}
      <TouchableOpacity
        style={styles.storyItem}
        onPress={() => {
          if (hasMyStory && onStoryPress) onStoryPress(user!.id);
          else onAddStoryPress?.();
        }}
      >
        <View style={[
          styles.addStoryThumb,
          hasMyStory && styles.storyThumbOwn,
        ]}>
          {user?.profile_image ? (
            <Image
              source={{ uri: getMediaUrl(user.profile_image) || '' }}
              style={styles.storyImage}
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="person" size={24} color="#8E8E93" />
            </View>
          )}
          <View style={styles.addBadge}>
            <Ionicons name="add" size={14} color="#FFF" />
          </View>
        </View>
        <Text style={styles.storyUsername} numberOfLines={1}>{hasMyStory ? 'La tua storia' : 'Aggiungi'}</Text>
      </TouchableOpacity>
      
      {/* Other Stories - Rectangular vertical format */}
      {otherStories.map((story) => {
        const firstStory = story.stories?.[0];
        const thumbUri = firstStory?.thumbnail 
          ? getMediaUrl(firstStory.thumbnail)
          : firstStory?.media 
            ? getMediaUrl(firstStory.media)
            : story.profile_image 
              ? getMediaUrl(story.profile_image) 
              : null;
        
        const isVideo = firstStory?.type === 'video';
        
        return (
          <TouchableOpacity
            key={story.user_id}
            style={styles.storyItem}
            onPress={() => onStoryPress?.(story.user_id)}
          >
            <View style={[
              styles.storyThumb,
              story.has_unread ? styles.storyThumbActive : styles.storyThumbSeen,
            ]}>
              {thumbUri ? (
                <>
                  <Image 
                    source={{ uri: thumbUri, cache: 'force-cache' }} 
                    style={styles.storyImage}
                    defaultSource={{ uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }}
                  />
                  {isVideo && (
                    <View style={styles.videoIndicator}>
                      <Ionicons name="play" size={12} color="#fff" />
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.placeholderImage}>
                  <Ionicons name={isVideo ? "videocam" : "image"} size={24} color="#8E8E93" />
                </View>
              )}
            </View>
            <Text style={styles.storyUsername} numberOfLines={1}>{story.username}</Text>
          </TouchableOpacity>
        );
      })}
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
    marginHorizontal: 4,
    width: 72,
  },
  addStoryThumb: {
    width: 68,
    height: 88,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FF6978',
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
    position: 'relative',
  },
  addBadge: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF6978',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  storyThumb: {
    width: 68,
    height: 88,
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
  },
  storyThumbActive: {
    borderColor: '#FF6978',
  },
  storyThumbSeen: {
    borderColor: '#3A3A3C',
  },
  storyThumbOwn: {
    borderColor: '#FF6978',
    borderStyle: 'solid',
    borderWidth: 3,
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
  videoIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyUsername: {
    color: '#FFFFFF',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
});
