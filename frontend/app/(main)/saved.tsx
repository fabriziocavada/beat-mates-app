import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../src/constants/colors';
import api, { getMediaUrl, getThumbnailUrl } from '../../src/services/api';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 6) / 3;

export default function SavedScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadSaved(); }, []);

  const loadSaved = async () => {
    try {
      const res = await api.get('/posts/saved');
      setPosts(res.data);
    } catch (e) { console.error('Failed to load saved', e); }
    finally { setIsLoading(false); }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Salvati</Text>
          <View style={{ width: 26 }} />
        </View>

        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bookmark-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nessun post salvato</Text>
            <Text style={styles.emptySubtext}>I post che salvi appariranno qui</Text>
          </View>
        ) : (
          <FlatList
            data={posts}
            numColumns={3}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: 2 }}
            renderItem={({ item }) => {
              const isVideo = item.type === 'video';
              const thumbUrl = isVideo ? getThumbnailUrl(item.media) : getMediaUrl(item.media);
              return (
                <TouchableOpacity
                  style={styles.gridItem}
                  onPress={() => router.push(`/(main)/post/${item.id}`)}
                  data-testid={`saved-post-${item.id}`}
                >
                  <Image source={{ uri: thumbUrl || '' }} style={styles.gridImage} />
                  {isVideo && (
                    <View style={styles.videoIcon}>
                      <Ionicons name="play" size={14} color="#FFF" />
                    </View>
                  )}
                  <View style={styles.savedIcon}>
                    <Ionicons name="bookmark" size={14} color={Colors.primary} />
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: '#888', fontSize: 13 },
  gridItem: { width: ITEM_SIZE, height: ITEM_SIZE, margin: 1, position: 'relative' },
  gridImage: { width: '100%', height: '100%' },
  videoIcon: { position: 'absolute', top: 6, right: 6 },
  savedIcon: { position: 'absolute', bottom: 6, right: 6 },
});
