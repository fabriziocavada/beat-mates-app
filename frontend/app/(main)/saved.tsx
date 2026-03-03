import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../src/constants/colors';
import api, { getMediaUrl, getThumbnailUrl } from '../../src/services/api';

export default function SavedScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSaved(); }, []);
  const loadSaved = async () => {
    try { const res = await api.get('/posts/saved'); setPosts(res.data); } catch {} finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color="#FFF" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Salvati</Text>
        <View style={{ width: 28 }} />
      </View>
      {loading ? <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} /> : posts.length === 0 ? (
        <View style={styles.empty}><Ionicons name="bookmark-outline" size={48} color="#444" /><Text style={styles.emptyText}>Nessun post salvato</Text><Text style={styles.emptySubtext}>Salva i post che ti piacciono toccando l'icona segnalibro</Text></View>
      ) : (
        <FlatList data={posts} numColumns={3} keyExtractor={i => i.id} renderItem={({ item }) => {
          const isVid = item.type === 'video';
          const url = isVid ? getThumbnailUrl(item.media) : getMediaUrl(item.media);
          return (<TouchableOpacity style={styles.postItem}><Image source={{ uri: url || '' }} style={styles.postImage} />{isVid && <View style={styles.videoIcon}><Ionicons name="play" size={14} color="#FFF" /></View>}</TouchableOpacity>);
        }} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 100, paddingHorizontal: 40 },
  emptyText: { color: '#FFF', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { color: '#888', fontSize: 14, textAlign: 'center', marginTop: 8 },
  postItem: { flex: 1/3, aspectRatio: 1, margin: 1, position: 'relative' },
  postImage: { width: '100%', height: '100%' },
  videoIcon: { position: 'absolute', top: 6, right: 6 },
});
