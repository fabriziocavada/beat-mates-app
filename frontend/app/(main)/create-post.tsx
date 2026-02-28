import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

export default function CreatePostScreen() {
  const router = useRouter();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  
  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [isLoading, setIsLoading] = useState(false);
  
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3, // Lower quality for smaller file size
      base64: true,
      videoMaxDuration: 60,
    });
    
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.type === 'video') {
        setMediaType('video');
        setMedia(asset.uri);
      } else if (asset.base64) {
        setMediaType('photo');
        // Compress image further if needed
        setMedia(`data:image/jpeg;base64,${asset.base64}`);
      }
    }
  };
  
  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please allow access to your camera');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
      base64: true,
    });
    
    if (!result.canceled && result.assets[0].base64) {
      setMediaType('photo');
      setMedia(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };
  
  const handlePost = async () => {
    if (!media && !caption) {
      Alert.alert('Empty post', 'Please add an image, video or caption');
      return;
    }
    
    setIsLoading(true);
    try {
      await api.post('/posts', {
        type: mediaType,
        media: media,
        caption,
      });
      
      await refreshUser();
      router.back();
    } catch (error: any) {
      console.error('Post error:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create post. Try with a smaller image.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Post</Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={isLoading || (!media && !caption)}
        >
          {isLoading ? (
            <ActivityIndicator color="#FF4058" />
          ) : (
            <Text style={[
              styles.shareButton,
              (!media && !caption) && styles.shareButtonDisabled
            ]}>
              Share
            </Text>
          )}
        </TouchableOpacity>
      </View>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView>
          {media ? (
            <View style={styles.mediaPreviewContainer}>
              {mediaType === 'video' ? (
                <Video
                  source={{ uri: media }}
                  style={styles.mediaPreview}
                  useNativeControls
                  resizeMode={ResizeMode.COVER}
                  isLooping
                />
              ) : (
                <Image source={{ uri: media }} style={styles.mediaPreview} resizeMode="cover" />
              )}
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => setMedia(null)}
              >
                <Ionicons name="close-circle" size={30} color="#FF4058" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.mediaButtons}>
              <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
                <Ionicons name="images" size={40} color="#FF4058" />
                <Text style={styles.mediaButtonText}>Gallery</Text>
                <Text style={styles.mediaButtonSubtext}>Photos & Videos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
                <Ionicons name="camera" size={40} color="#FF4058" />
                <Text style={styles.mediaButtonText}>Camera</Text>
                <Text style={styles.mediaButtonSubtext}>Take Photo</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <TextInput
            style={styles.captionInput}
            placeholder="Write a caption..."
            placeholderTextColor="#8E8E93"
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={2200}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#3A3A3C',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  shareButton: {
    color: '#FF4058',
    fontSize: 16,
    fontWeight: '600',
  },
  shareButtonDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
  },
  mediaPreviewContainer: {
    position: 'relative',
    margin: 16,
    aspectRatio: 1,
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  mediaButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 40,
    gap: 24,
  },
  mediaButton: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    width: 130,
  },
  mediaButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  mediaButtonSubtext: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  captionInput: {
    color: '#FFFFFF',
    fontSize: 16,
    padding: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
