import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface UploadState {
  isUploading: boolean;
  progress: string; // "Pubblicazione in corso..." / "Pubblicato!"
  type: 'post' | 'story' | null;
}

interface UploadContextType {
  uploadState: UploadState;
  startUpload: (type: 'post' | 'story') => void;
  finishUpload: () => void;
  failUpload: () => void;
}

const UploadContext = createContext<UploadContextType>({
  uploadState: { isUploading: false, progress: '', type: null },
  startUpload: () => {},
  finishUpload: () => {},
  failUpload: () => {},
});

export const useUpload = () => useContext(UploadContext);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: '',
    type: null,
  });

  const startUpload = useCallback((type: 'post' | 'story') => {
    setUploadState({
      isUploading: true,
      progress: type === 'story' ? 'Pubblicazione storia...' : 'Pubblicazione post...',
      type,
    });
  }, []);

  const finishUpload = useCallback(() => {
    setUploadState(prev => ({
      ...prev,
      progress: 'Pubblicato!',
    }));
    // Hide after 2 seconds
    setTimeout(() => {
      setUploadState({ isUploading: false, progress: '', type: null });
    }, 2000);
  }, []);

  const failUpload = useCallback(() => {
    setUploadState(prev => ({
      ...prev,
      progress: 'Errore pubblicazione',
    }));
    setTimeout(() => {
      setUploadState({ isUploading: false, progress: '', type: null });
    }, 3000);
  }, []);

  return (
    <UploadContext.Provider value={{ uploadState, startUpload, finishUpload, failUpload }}>
      {children}
      {uploadState.isUploading && (
        <View style={styles.banner}>
          <View style={styles.bannerContent}>
            {uploadState.progress === 'Pubblicato!' ? (
              <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
            ) : uploadState.progress.includes('Errore') ? (
              <Ionicons name="alert-circle" size={18} color="#FF5252" />
            ) : (
              <View style={styles.spinner} />
            )}
            <Text style={styles.bannerText}>{uploadState.progress}</Text>
          </View>
        </View>
      )}
    </UploadContext.Provider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  bannerText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#FF6978',
    borderTopColor: 'transparent',
  },
});
