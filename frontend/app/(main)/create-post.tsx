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
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import api, { uploadFile } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

const { width } = Dimensions.get('window');

interface MediaItem {
  uri: string;
  type: 'photo' | 'video';
}

export default function CreatePostScreen() {
  const router = useRouter();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  
  const [caption, setCaption] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  function VideoPreview({ uri }: { uri: string }) {
    const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;background:#000}video{width:100%;height:100%;object-fit:cover}</style></head><body><video src="${uri}" autoplay loop muted playsinline controls></video></body></html>`;
    return (
      <WebView source={{ html }} style={styles.previewMedia} scrollEnabled={false} allowsInlineMediaPlayback={true} mediaPlaybackRequiresUserAction={false} javaScriptEnabled={true} />
    );
  }
  
  const pickMedia = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permesso richiesto', 'Consenti accesso alla galleria');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.5,
      videoMaxDuration: 10,
    });
    
    if (!result.canceled && result.assets.length > 0) {
      const newItems: MediaItem[] = result.assets.map(a => ({
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'photo',
      }));
      setMediaItems(prev => [...prev, ...newItems].slice(0, 10));
    }
  };
  
  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permesso richiesto', 'Consenti accesso alla fotocamera');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
    });
    
    if (!result.canceled && result.assets[0]) {
      setMediaItems(prev => [...prev, { uri: result.assets[0].uri, type: 'photo' }].slice(0, 10));
    }
  };

  const takeVideo = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (!cameraPermission.granted) {
      Alert.alert('Permesso richiesto', 'Consenti accesso a fotocamera');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 10,
    });
    
    if (!result.canceled && result.assets[0]) {
      setMediaItems(prev => [...prev, { uri: result.assets[0].uri, type: 'video' }].slice(0, 10));
    }
  };

  const removeMedia = (index: number) => {
    setMediaItems(prev => prev.filter((_, i) => i !== index));
    if (previewIndex >= mediaItems.length - 1 && previewIndex > 0) {
      setPreviewIndex(previewIndex - 1);
    }
  };
  
  const handlePost = async () => {
    if (mediaItems.length === 0 && !caption) {
      Alert.alert('Post vuoto', 'Aggiungi una foto, un video o un testo');
      return;
    }
    
    setIsLoading(true);
    try {
      // Upload all media files
      const uploadedUrls: string[] = [];
      for (const item of mediaItems) {
        const serverUrl = await uploadFile(item.uri);
        if (serverUrl) uploadedUrls.push(serverUrl);
      }
      
      const hasVideo = mediaItems.some(m => m.type === 'video');
      const postType = mediaItems.length === 0 ? 'text' : hasVideo ? 'video' : 'photo';
      
      await api.post('/posts', {
        type: postType,
        media: uploadedUrls[0] || null,
        media_urls: uploadedUrls,
        caption,
      });
      
      refreshUser();
      router.replace('/(main)/home');
    } catch (error: any) {
      console.error('Post error:', error?.message || error);
      Alert.alert('Errore', 'Impossibile creare il post. Controlla la connessione e riprova.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF6978" />
          <Text style={styles.loadingText}>Pubblicazione in corso...</Text>
          {mediaItems.length > 1 && (
            <Text style={styles.loadingSubtext}>Caricamento {mediaItems.length} file...</Text>
          )}
        </View>
      )}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nuovo Post</Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={isLoading || (mediaItems.length === 0 && !caption)}
        >
          {isLoading ? (
            <ActivityIndicator color="#FF6978" />
          ) : (
            <Text style={[
              styles.shareButton,
              (mediaItems.length === 0 && !caption) && styles.shareButtonDisabled
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
          {mediaItems.length > 0 ? (
            <View>
              {/* Main preview - horizontal scroll */}
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => setPreviewIndex(Math.round(e.nativeEvent.contentOffset.x / (width - 32)))}
                scrollEventThrottle={16}
              >
                {mediaItems.map((item, idx) => (
                  <View key={idx} style={styles.previewContainer}>
                    {item.type === 'video' ? (
                      <VideoPreview uri={item.uri} />
                    ) : (
                      <Image source={{ uri: item.uri }} style={styles.previewMedia} resizeMode="cover" />
                    )}
                    <TouchableOpacity style={styles.removeButton} onPress={() => removeMedia(idx)}>
                      <Ionicons name="close-circle" size={32} color="#FF6978" />
                    </TouchableOpacity>
                    {item.type === 'video' && (
                      <View style={styles.videoBadge}>
                        <Ionicons name="videocam" size={14} color="#FFF" />
                        <Text style={styles.videoBadgeText}>Video</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
              
              {/* Dots indicator */}
              {mediaItems.length > 1 && (
                <View style={styles.dotsRow}>
                  {mediaItems.map((_, idx) => (
                    <View key={idx} style={[styles.dot, idx === previewIndex && styles.dotActive]} />
                  ))}
                </View>
              )}
              
              {/* Thumbnail strip + add more */}
              <View style={styles.thumbStrip}>
                {mediaItems.map((item, idx) => (
                  <View key={idx} style={[styles.thumbItem, idx === previewIndex && styles.thumbItemActive]}>
                    <Image source={{ uri: item.uri }} style={styles.thumbImage} />
                    {item.type === 'video' && (
                      <Ionicons name="videocam" size={10} color="#FFF" style={styles.thumbVideoIcon} />
                    )}
                  </View>
                ))}
                {mediaItems.length < 10 && (
                  <TouchableOpacity style={styles.addMoreThumb} onPress={pickMedia}>
                    <Ionicons name="add" size={22} color="#FF6978" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
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
                <Text style={styles.mediaButtonHint}>max 10</Text>
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
  container: { flex: 1, backgroundColor: '#000000' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#FFFFFF', fontSize: 16, marginTop: 12, fontWeight: '500' },
  loadingSubtext: { color: '#888', fontSize: 13, marginTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#3A3A3C' },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  shareButton: { color: '#FF6978', fontSize: 16, fontWeight: '600' },
  shareButtonDisabled: { opacity: 0.5 },
  content: { flex: 1 },
  previewContainer: { width: width - 32, aspectRatio: 9 / 16, maxHeight: 400, margin: 16, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  previewMedia: { width: '100%', height: '100%' },
  removeButton: { position: 'absolute', top: 8, right: 8 },
  videoBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  videoBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#444' },
  dotActive: { backgroundColor: '#FF6978', width: 8, height: 8, borderRadius: 4 },
  thumbStrip: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  thumbItem: { width: 52, height: 52, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbItemActive: { borderColor: '#FF6978' },
  thumbImage: { width: '100%', height: '100%' },
  thumbVideoIcon: { position: 'absolute', bottom: 2, right: 2 },
  addMoreThumb: { width: 52, height: 52, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#FF6978', alignItems: 'center', justifyContent: 'center' },
  mediaOptions: { flexDirection: 'row', justifyContent: 'center', padding: 40, gap: 20 },
  mediaButton: { alignItems: 'center', padding: 20, backgroundColor: '#1C1C1E', borderRadius: 16, width: 100 },
  mediaButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500', marginTop: 8 },
  mediaButtonHint: { color: '#8E8E93', fontSize: 11, marginTop: 2 },
  captionInput: { color: '#FFFFFF', fontSize: 16, padding: 16, minHeight: 80, textAlignVertical: 'top' },
});
