import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import api, { uploadFile, getMediaUrl } from '../../src/services/api';
import InstagramStoryEditor from '../../src/components/InstagramStoryEditor';

const { width } = Dimensions.get('window');

export default function CreateStoryScreen() {
  const router = useRouter();
  const { sharedMedia, sharedType } = useLocalSearchParams<{ sharedMedia?: string; sharedType?: string }>();
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [isLoading, setIsLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editorData, setEditorData] = useState<any>(null);

  // Handle shared media from reels/posts
  useEffect(() => {
    if (sharedMedia) {
      // For shared media, it's already a path like 'xxx.jpg' or '/api/uploads/xxx.jpg'
      // We need to get the full URL for display
      let fullUrl: string | null = null;
      
      if (sharedMedia.startsWith('http')) {
        fullUrl = sharedMedia;
      } else {
        fullUrl = getMediaUrl(sharedMedia);
      }
      
      console.log('Shared media received:', sharedMedia, '-> Full URL:', fullUrl);
      
      if (fullUrl) {
        setMediaUri(fullUrl);
        setMediaType(sharedType === 'video' ? 'video' : 'photo');
        setShowEditor(true); // Auto-open editor for shared content
      }
    }
  }, [sharedMedia, sharedType]);

  const pickMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permesso richiesto', 'Consenti accesso alla galleria'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.7,
      videoMaxDuration: 15,
    });
    if (!result.canceled && result.assets[0]) {
      setMediaType(result.assets[0].type === 'video' ? 'video' : 'photo');
      setMediaUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permesso richiesto', 'Consenti accesso alla fotocamera'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setMediaType('photo');
      setMediaUri(result.assets[0].uri);
    }
  };

  const takeVideo = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permesso richiesto', 'Consenti accesso alla fotocamera'); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 15,
      videoQuality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setMediaType('video');
      setMediaUri(result.assets[0].uri);
    }
  };

  const handlePublish = async (data?: any) => {
    if (!mediaUri) { Alert.alert('Nessun media', 'Scegli una foto o registra un video'); return; }
    setIsLoading(true);
    try {
      const serverUrl = await uploadFile(mediaUri);
      // Include editor data (texts, stickers, drawings, backgroundColor) if present
      const storyData: any = { 
        media: serverUrl, 
        type: mediaType,
      };
      
      // Add editor overlays if present
      if (data) {
        console.log('Saving story with editor data:', JSON.stringify(data.music));
        
        // Upload overlay images to server (they have local file:// URIs)
        let uploadedOverlayImages: any[] = [];
        if (data.overlayImages && data.overlayImages.length > 0) {
          console.log('=== UPLOADING', data.overlayImages.length, 'overlay images... ===');
          for (const img of data.overlayImages) {
            console.log('Processing overlay image:', img.uri.substring(0, 50));
            try {
              // Upload the local file to server
              const uploadedUrl = await uploadFile(img.uri);
              console.log('Upload SUCCESS:', uploadedUrl);
              uploadedOverlayImages.push({
                ...img,
                uri: uploadedUrl, // Replace local URI with server URL
              });
            } catch (e: any) {
              console.error('=== UPLOAD FAILED ===', e.message || e);
              // Skip failed uploads
            }
          }
          console.log('=== FINISHED UPLOADING, got', uploadedOverlayImages.length, 'images ===');
        }
        
        storyData.editor_data = {
          texts: data.texts || [],
          stickers: data.stickers || [],
          drawings: data.drawings || [],
          overlayImages: uploadedOverlayImages, // Use uploaded URLs
          backgroundColor: data.backgroundColor || null,
          caption: data.caption || '',
          music: data.music || null, // Include selected music track
          effect: data.effect || null, // Include selected effect
          effectParticles: data.effectParticles || [], // Include effect particles
        };
      }
      
      await api.post('/stories', storyData);
      router.replace('/(main)/home');
    } catch (error: any) {
      console.error('Story error:', error.response?.data || error.message);
      Alert.alert('Errore', 'Impossibile pubblicare. Riprova.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle editor save - pass data directly to avoid state timing issues
  const handleEditorSave = (data: any) => {
    setEditorData(data);
    setShowEditor(false);
    // Pass data directly to handlePublish
    handlePublish(data);
  };

  // Show editor when media is selected - Using Instagram-identical editor
  if (showEditor && mediaUri) {
    return (
      <InstagramStoryEditor
        mediaUri={mediaUri}
        mediaType={mediaType}
        onSave={handleEditorSave}
        onClose={() => setShowEditor(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF6978" />
          <Text style={styles.loadingText}>Pubblicazione in corso...</Text>
        </View>
      )}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nuova Storia</Text>
        <TouchableOpacity onPress={handlePublish} disabled={isLoading || !mediaUri}>
          {isLoading ? (
            <ActivityIndicator color="#FF6978" />
          ) : (
            <Text style={[styles.publishButton, !mediaUri && styles.publishButtonDisabled]}>Pubblica</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {mediaUri ? (
          <View style={styles.previewContainer}>
            {mediaType === 'video' ? (
              <Video
                source={{ uri: mediaUri }}
                style={styles.preview}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping
                isMuted={false}
              />
            ) : (
              <Image source={{ uri: mediaUri }} style={styles.preview} resizeMode="cover" />
            )}
            <TouchableOpacity style={styles.removeButton} onPress={() => setMediaUri(null)}>
              <Ionicons name="close-circle" size={36} color="#FF6978" />
            </TouchableOpacity>
            {mediaType === 'video' && (
              <View style={styles.videoBadge}>
                <Ionicons name="videocam" size={14} color="#FFF" />
                <Text style={styles.videoBadgeText}>Video</Text>
              </View>
            )}
            {/* Edit button - Opens Instagram-style editor */}
            <TouchableOpacity style={styles.editButton} onPress={() => setShowEditor(true)}>
              <Ionicons name="create-outline" size={24} color="#FFF" />
              <Text style={styles.editButtonText}>Modifica</Text>
            </TouchableOpacity>
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
              <Text style={styles.optionHint}>max 15s</Text>
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
  container: { flex: 1, backgroundColor: '#000000' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#FFFFFF', fontSize: 16, marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#3A3A3C' },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  publishButton: { color: '#FF6978', fontSize: 16, fontWeight: '600' },
  publishButtonDisabled: { opacity: 0.5 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewContainer: { flex: 1, width: '100%', position: 'relative' },
  preview: { flex: 1, width: '100%' },
  removeButton: { position: 'absolute', top: 20, right: 20, zIndex: 10 },
  videoBadge: { position: 'absolute', top: 20, left: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 4 },
  videoBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  editButton: { position: 'absolute', bottom: 100, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, gap: 8 },
  editButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  optionsContainer: { flexDirection: 'row', gap: 24 },
  optionButton: { alignItems: 'center' },
  optionIcon: { width: 90, height: 90, borderRadius: 20, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  optionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
  optionHint: { color: '#8E8E93', fontSize: 11, marginTop: 2 },
});
