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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import api, { uploadFile } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

const { width } = Dimensions.get('window');

export default function CreatePostScreen() {
  const router = useRouter();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  
  const [caption, setCaption] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [isLoading, setIsLoading] = useState(false);
  
  const pickMedia = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permesso richiesto', 'Consenti accesso alla galleria');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.5,
      videoMaxDuration: 10,
    });
    
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMediaType(asset.type === 'video' ? 'video' : 'photo');
      setMediaUri(asset.uri);
    }
  };
  
  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permesso richiesto', 'Consenti accesso alla fotocamera');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.5,
    });
    
    if (!result.canceled && result.assets[0]) {
      setMediaType('photo');
      setMediaUri(result.assets[0].uri);
    }
  };

  const takeVideo = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (!cameraPermission.granted) {
      Alert.alert('Permesso richiesto', 'Consenti accesso a fotocamera');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 10,
      allowsEditing: true,
    });
    
    if (!result.canceled && result.assets[0]) {
      setMediaType('video');
      setMediaUri(result.assets[0].uri);
    }
  };
  
  const handlePost = async () => {
    if (!mediaUri && !caption) {
      Alert.alert('Post vuoto', 'Aggiungi una foto, un video o un testo');
      return;
    }
    
    setIsLoading(true);
    try {
      let serverUrl: string | null = null;
      if (mediaUri) {
        serverUrl = await uploadFile(mediaUri);
      }
      
      await api.post('/posts', {
        type: mediaType,
        media: serverUrl,
        caption,
      });
      
      await refreshUser();
      router.replace('/(main)/home');
    } catch (error: any) {
      console.error('Post error:', error.response?.data || error.message);
      Alert.alert('Errore', 'Impossibile creare il post. Riprova.');
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
        <Text style={styles.headerTitle}>Nuovo Post</Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={isLoading || (!mediaUri && !caption)}
        >
          {isLoading ? (
            <ActivityIndicator color="#FF6978" />
          ) : (
            <Text style={[
              styles.shareButton,
              (!mediaUri && !caption) && styles.shareButtonDisabled
            ]}>
              Pubblica
            </Text>
          )}
        </TouchableOpacity>
      </View>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView>
          {mediaUri ? (
            <View style={styles.previewContainer}>
              {mediaType === 'video' ? (
                <Video
                  source={{ uri: mediaUri }}
                  style={styles.preview}
                  useNativeControls
                  resizeMode={ResizeMode.COVER}
                  isLooping
                  shouldPlay
                />
              ) : (
                <Image source={{ uri: mediaUri }} style={styles.preview} resizeMode="cover" />
              )}
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => setMediaUri(null)}
              >
                <Ionicons name="close-circle" size={32} color="#FF6978" />
              </TouchableOpacity>
              {mediaType === 'video' && (
                <View style={styles.videoBadge}>
                  <Ionicons name="videocam" size={14} color="#FFF" />
                  <Text style={styles.videoBadgeText}>Video</Text>
                </View>
              )}
            </View>
          ) : mediaUri === null ? (
            <View style={styles.mediaOptions}>
              <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
                <Ionicons name="camera" size={36} color="#FF6978" />
                <Text style={styles.mediaButtonText}>Foto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaButton} onPress={takeVideo}>
                <Ionicons name="videocam" size={36} color="#FF6978" />
                <Text style={styles.mediaButtonText}>Video</Text>
                <Text style={styles.mediaButtonHint}>max 10s</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaButton} onPress={pickMedia}>
                <Ionicons name="images" size={36} color="#FF6978" />
                <Text style={styles.mediaButtonText}>Galleria</Text>
              </TouchableOpacity>
            </View>
          )}          
          <TextInput
            style={styles.captionInput}
            placeholder="Scrivi una didascalia..."
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
    color: '#FF6978',
    fontSize: 16,
    fontWeight: '600',
  },
  shareButtonDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
  },
  previewContainer: {
    width: width - 32,
    aspectRatio: 9 / 16,
    maxHeight: 400,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  videoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  videoBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  mediaOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 40,
    gap: 20,
  },
  mediaButton: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    width: 100,
  },
  mediaButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  mediaButtonHint: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  captionInput: {
    color: '#FFFFFF',
    fontSize: 16,
    padding: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
