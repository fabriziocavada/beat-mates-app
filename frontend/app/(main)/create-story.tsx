import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import api from '../../src/services/api';

const { width } = Dimensions.get('window');

export default function CreateStoryScreen() {
  const router = useRouter();
  
  const [media, setMedia] = useState<string | null>(null);
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
      quality: 0.4,
      base64: true,
      videoMaxDuration: 10,
    });
    
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.type === 'video') {
        setMediaType('video');
        setMedia(asset.uri);
      } else if (asset.base64) {
        setMediaType('photo');
        setMedia(`data:image/jpeg;base64,${asset.base64}`);
      }
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
      quality: 0.4,
      base64: true,
    });
    
    if (!result.canceled && result.assets[0].base64) {
      setMediaType('photo');
      setMedia(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takeVideo = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permesso richiesto', 'Consenti accesso alla fotocamera');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 10,
      allowsEditing: true,
    });
    
    if (!result.canceled && result.assets[0]) {
      setMediaType('video');
      setMedia(result.assets[0].uri);
    }
  };
  
  const handlePublish = async () => {
    if (!media) {
      Alert.alert('Nessun media', 'Scegli una foto o registra un video');
      return;
    }
    
    setIsLoading(true);
    try {
      await api.post('/stories', {
        media: media,
        type: mediaType,
      });
      router.back();
    } catch (error: any) {
      console.error('Story error:', error.response?.data || error.message);
      Alert.alert('Errore', 'Impossibile pubblicare. Prova con un file più piccolo.');
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
        <Text style={styles.headerTitle}>Nuova Storia</Text>
        <TouchableOpacity
          onPress={handlePublish}
          disabled={isLoading || !media}
        >
          {isLoading ? (
            <ActivityIndicator color="#FF6978" />
          ) : (
            <Text style={[
              styles.publishButton,
              !media && styles.publishButtonDisabled
            ]}>
              Pubblica
            </Text>
          )}
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        {media ? (
          <View style={styles.previewContainer}>
            {mediaType === 'video' ? (
              <Video
                source={{ uri: media }}
                style={styles.preview}
                useNativeControls
                resizeMode={ResizeMode.COVER}
                isLooping
                shouldPlay
              />
            ) : (
              <Image source={{ uri: media }} style={styles.preview} resizeMode="cover" />
            )}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => setMedia(null)}
            >
              <Ionicons name="close-circle" size={36} color="#FF6978" />
            </TouchableOpacity>
            {mediaType === 'video' && (
              <View style={styles.videoBadge}>
                <Ionicons name="videocam" size={14} color="#FFF" />
                <Text style={styles.videoBadgeText}>Video</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.optionButton} onPress={takePhoto}>
              <View style={styles.optionIcon}>
                <Ionicons name="camera" size={40} color="#FF6978" />
              </View>
              <Text style={styles.optionText}>Foto</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.optionButton} onPress={takeVideo}>
              <View style={styles.optionIcon}>
                <Ionicons name="videocam" size={40} color="#FF6978" />
              </View>
              <Text style={styles.optionText}>Video</Text>
              <Text style={styles.optionHint}>max 10s</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.optionButton} onPress={pickMedia}>
              <View style={styles.optionIcon}>
                <Ionicons name="images" size={40} color="#FF6978" />
              </View>
              <Text style={styles.optionText}>Galleria</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
  publishButton: {
    color: '#FF6978',
    fontSize: 16,
    fontWeight: '600',
  },
  publishButtonDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  preview: {
    flex: 1,
    width: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  videoBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  videoBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 24,
  },
  optionButton: {
    alignItems: 'center',
  },
  optionIcon: {
    width: 90,
    height: 90,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  optionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  optionHint: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
});
