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
import Colors from '../../src/constants/colors';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

export default function CreatePostScreen() {
  const router = useRouter();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  
  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    
    if (!result.canceled && result.assets[0].base64) {
      setMedia(`data:image/jpeg;base64,${result.assets[0].base64}`);
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
      quality: 0.7,
      base64: true,
    });
    
    if (!result.canceled && result.assets[0].base64) {
      setMedia(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };
  
  const handlePost = async () => {
    if (!media && !caption) {
      Alert.alert('Empty post', 'Please add an image or caption');
      return;
    }
    
    setIsLoading(true);
    try {
      await api.post('/posts', {
        type: media ? 'photo' : 'text',
        media,
        caption,
      });
      
      await refreshUser();
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create post');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Post</Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={isLoading || (!media && !caption)}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.primary} />
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
            <View style={styles.imageContainer}>
              <Image source={{ uri: media }} style={styles.image} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => setMedia(null)}
              >
                <Ionicons name="close-circle" size={30} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.mediaButtons}>
              <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
                <Ionicons name="images" size={40} color={Colors.primary} />
                <Text style={styles.mediaButtonText}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
                <Ionicons name="camera" size={40} color={Colors.primary} />
                <Text style={styles.mediaButtonText}>Camera</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <TextInput
            style={styles.captionInput}
            placeholder="Write a caption..."
            placeholderTextColor={Colors.textSecondary}
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  shareButton: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  shareButtonDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    margin: 16,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
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
    gap: 40,
  },
  mediaButton: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    width: 120,
  },
  mediaButtonText: {
    color: Colors.text,
    fontSize: 14,
    marginTop: 8,
  },
  captionInput: {
    color: Colors.text,
    fontSize: 16,
    padding: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
