import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList,
  Alert, RefreshControl, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Colors from '../../src/constants/colors';
import TabBar from '../../src/components/TabBar';
import api from '../../src/services/api';

interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string;
  file_url: string;
  duration: number;
  is_liked: boolean;
  playlist_id: string | null;
  playlist_name: string | null;
  created_at: string;
}

interface Playlist {
  id: string;
  name: string;
  genre: string;
  song_count: number;
}

const GENRES = ['ALL', 'SAMBA', 'TANGO', 'LATIN', 'HIP HOP', 'JAZZ', 'CONTEMPORARY', 'AFRO', 'REGGAETON'];

export default function MusicScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedGenre, setSelectedGenre] = useState('ALL');
  const [showLiked, setShowLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState<string | null>(null);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);

  useEffect(() => {
    if (pathname === '/music' || pathname === '/(main)/music') {
      loadData();
    }
  }, [pathname]);

  const loadData = async () => {
    try {
      const isPlaylistFilter = selectedGenre !== 'ALL' && playlists.some(p => p.id === selectedGenre);
      const params: any = {};
      if (isPlaylistFilter) {
        params.playlist_id = selectedGenre;
      }
      if (showLiked) params.liked_only = true;
      
      const [songsRes, playlistsRes] = await Promise.all([
        api.get('/music/songs', { params }),
        api.get('/music/playlists'),
      ]);
      setSongs(songsRes.data);
      setPlaylists(playlistsRes.data);
    } catch (e) {
      console.error('Failed to load music', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [selectedGenre, showLiked]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [selectedGenre, showLiked]);

  const handleUploadSong = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const fileName = file.name || 'Unknown';
      const title = fileName.replace(/\.[^.]+$/, '');

      Alert.prompt
        ? Alert.prompt('Titolo canzone', 'Inserisci il titolo:', (inputTitle) => {
            uploadSongFile(file, inputTitle || title);
          }, 'plain-text', title)
        : uploadSongFile(file, title);
    } catch (e) {
      Alert.alert('Errore', 'Non riesco ad aprire il file picker');
    }
  };

  const uploadSongFile = async (file: any, title: string) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name || 'song.mp3',
        type: file.mimeType || 'audio/mpeg',
      } as any);
      formData.append('title', title);
      formData.append('artist', '');
      formData.append('genre', selectedGenre !== 'ALL' ? selectedGenre : 'ALL');

      await api.post('/music/songs/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadData();
      Alert.alert('Caricata!', `"${title}" aggiunta alla libreria`);
    } catch (e) {
      Alert.alert('Errore', 'Upload fallito');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      await api.post('/music/playlists', { name: newPlaylistName.trim(), genre: selectedGenre !== 'ALL' ? selectedGenre : 'ALL' });
      setNewPlaylistName('');
      setShowNewPlaylist(false);
      await loadData();
    } catch {
      Alert.alert('Errore', 'Creazione playlist fallita');
    }
  };

  const handleToggleLike = async (songId: string) => {
    try {
      const res = await api.post(`/music/songs/${songId}/like`);
      setSongs(prev => prev.map(s => s.id === songId ? { ...s, is_liked: res.data.liked } : s));
    } catch {}
  };

  const handleMoveSong = async (songId: string, playlistId: string | null) => {
    try {
      await api.put(`/music/songs/${songId}/playlist`, null, { params: { playlist_id: playlistId } });
      setShowPlaylistPicker(false);
      setSelectedSongForPlaylist(null);
      await loadData();
    } catch {}
  };

  const handleDeleteSong = (songId: string) => {
    Alert.alert('Elimina canzone', 'Sei sicuro?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        await api.delete(`/music/songs/${songId}`);
        await loadData();
      }},
    ]);
  };

  const openPlaylistPicker = (songId: string) => {
    setSelectedSongForPlaylist(songId);
    setShowPlaylistPicker(true);
  };

  const handleTabPress = (tab: string) => {
    switch (tab) {
      case 'home': router.push('/(main)/home'); break;
      case 'create': router.push('/(main)/create-post'); break;
      case 'available': router.push('/(main)/available'); break;
      case 'reels': router.push('/(main)/reels'); break;
      case 'profile': router.push('/(main)/profile'); break;
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const renderSong = ({ item, index }: { item: Song; index: number }) => {
    const isPlaying = playingSongId === item.id;
    return (
      <TouchableOpacity
        style={styles.songRow}
        onPress={() => {
          setPlayingSongId(item.id);
          router.push(`/(main)/player/${item.id}`);
        }}
        data-testid={`song-row-${item.id}`}
      >
        <View style={[styles.songDot, isPlaying && styles.songDotActive]} />
        <View style={styles.songInfo}>
          <Text style={[styles.songTitle, isPlaying && { color: Colors.success }]}>{item.title}</Text>
          <Text style={styles.songArtist}>{item.artist}</Text>
        </View>
        <TouchableOpacity onPress={() => handleToggleLike(item.id)} style={styles.likeBtn}>
          <Ionicons name={item.is_liked ? 'heart' : 'heart-outline'} size={20} color={item.is_liked ? Colors.primary : '#666'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openPlaylistPicker(item.id)} style={styles.dragHandle}>
          <Ionicons name="menu" size={20} color="#666" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="search" size={22} color="#FFF" />
          <Text style={styles.headerTitle}>BEAT <Text style={{ color: Colors.primary }}>MATES</Text></Text>
          <View style={styles.headerRight}>
            <Ionicons name="heart-outline" size={22} color="#FFF" />
            <Ionicons name="paper-plane-outline" size={22} color="#FFF" style={{ marginLeft: 16 }} />
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#FFF" />}
        >
          {/* Title */}
          <Text style={styles.playlistTitle}>Your playlist</Text>

          {/* Genre filter - shows user playlists as pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            <TouchableOpacity
              style={[styles.genrePill, selectedGenre === 'ALL' && styles.genrePillActive]}
              onPress={() => { setSelectedGenre('ALL'); setShowLiked(false); }}
            >
              <Text style={[styles.genrePillText, selectedGenre === 'ALL' && styles.genrePillTextActive]}>ALL</Text>
            </TouchableOpacity>
            {playlists.map(pl => (
              <TouchableOpacity
                key={pl.id}
                style={[styles.genrePill, selectedGenre === pl.id && styles.genrePillActive]}
                onPress={() => { setSelectedGenre(pl.id); setShowLiked(false); }}
              >
                <Text style={[styles.genrePillText, selectedGenre === pl.id && styles.genrePillTextActive]}>{pl.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleUploadSong} data-testid="add-song-btn">
              <View style={styles.actionBtnIcon}><Ionicons name="add" size={24} color="#FFF" /></View>
              <Text style={styles.actionBtnText}>Add New Song</Text>
              {isUploading && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowNewPlaylist(true)} data-testid="add-playlist-btn">
              <View style={styles.actionBtnIcon}><Ionicons name="add" size={24} color="#FFF" /></View>
              <Text style={styles.actionBtnText}>Add New Playlist</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => { setShowLiked(!showLiked); }}>
              <View style={[styles.actionBtnIcon, styles.actionBtnIconHeart]}>
                <Ionicons name="heart" size={20} color="#FFF" />
              </View>
              <Text style={styles.actionBtnText}>Your Liked Songs</Text>
            </TouchableOpacity>
          </View>

          {/* Playlists */}
          {playlists.length > 0 && (
            <View style={styles.playlistSection}>
              {playlists.map(pl => (
                <TouchableOpacity key={pl.id} style={styles.playlistRow} onPress={() => {
                  setSelectedGenre(pl.id);
                }}>
                  <Ionicons name="musical-notes" size={18} color={Colors.primary} />
                  <Text style={styles.playlistRowName}>{pl.name}</Text>
                  <Text style={styles.playlistRowCount}>{pl.song_count} brani</Text>
                  <TouchableOpacity onPress={() => {
                    Alert.alert('Elimina playlist', `Eliminare "${pl.name}"?`, [
                      { text: 'Annulla', style: 'cancel' },
                      { text: 'Elimina', style: 'destructive', onPress: async () => {
                        await api.delete(`/music/playlists/${pl.id}`);
                        await loadData();
                      }},
                    ]);
                  }}>
                    <Ionicons name="trash-outline" size={18} color="#666" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Sort label */}
          <View style={styles.sortRow}>
            <Ionicons name="swap-vertical" size={18} color="#FFF" />
            <Text style={styles.sortText}>SORT TRACKS BY DATE</Text>
          </View>

          {/* Songs list */}
          {isLoading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
          ) : songs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes-outline" size={48} color="#444" />
              <Text style={styles.emptyText}>{showLiked ? 'Nessuna canzone preferita' : 'Nessuna canzone. Carica la tua prima traccia!'}</Text>
            </View>
          ) : (
            songs.map((song, index) => (
              <View key={song.id}>{renderSong({ item: song, index })}</View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      <TabBar activeTab="music" onTabPress={handleTabPress} />

      {/* New Playlist Modal */}
      <Modal visible={showNewPlaylist} transparent animationType="fade" onRequestClose={() => setShowNewPlaylist(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowNewPlaylist(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Nuova Playlist</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nome playlist..."
              placeholderTextColor="#666"
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowNewPlaylist(false)}>
                <Text style={styles.modalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleCreatePlaylist}>
                <Text style={styles.modalConfirmText}>Crea</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Playlist picker for moving songs */}
      <Modal visible={showPlaylistPicker} transparent animationType="slide" onRequestClose={() => setShowPlaylistPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPlaylistPicker(false)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Sposta in playlist</Text>

            <TouchableOpacity style={styles.pickerItem} onPress={() => handleMoveSong(selectedSongForPlaylist!, null)}>
              <Ionicons name="remove-circle-outline" size={22} color="#FF3B30" />
              <Text style={styles.pickerItemText}>Rimuovi dalla playlist</Text>
            </TouchableOpacity>

            {playlists.map(pl => (
              <TouchableOpacity key={pl.id} style={styles.pickerItem} onPress={() => handleMoveSong(selectedSongForPlaylist!, pl.id)}>
                <Ionicons name="musical-notes" size={22} color={Colors.primary} />
                <Text style={styles.pickerItemText}>{pl.name}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.pickerItem} onPress={() => { if (selectedSongForPlaylist) handleDeleteSong(selectedSongForPlaylist); }}>
              <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              <Text style={[styles.pickerItemText, { color: '#FF3B30' }]}>Elimina canzone</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  playlistTitle: { color: Colors.primary, fontSize: 22, fontWeight: '700', textAlign: 'center', marginTop: 8, marginBottom: 12 },
  genreBar: { marginBottom: 16 },
  genrePill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#FFF' },
  genrePillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  genrePillText: { color: '#FFF', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  genrePillTextActive: { color: '#FFF' },
  actionButtons: { paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  actionBtnIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  actionBtnIconHeart: { backgroundColor: Colors.primary },
  actionBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  playlistSection: { paddingHorizontal: 16, marginBottom: 12 },
  playlistRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  playlistRowName: { color: '#FFF', fontSize: 14, fontWeight: '500', flex: 1 },
  playlistRowCount: { color: '#888', fontSize: 12 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  sortText: { color: '#FFF', fontSize: 12, fontWeight: '600', letterSpacing: 1.5 },
  songRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  songDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: '#444', marginRight: 12 },
  songDotActive: { borderColor: Colors.success, backgroundColor: Colors.success },
  songInfo: { flex: 1 },
  songTitle: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  songArtist: { color: '#888', fontSize: 12, marginTop: 2 },
  likeBtn: { padding: 8 },
  dragHandle: { padding: 8 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#666', fontSize: 14, marginTop: 12, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, width: '85%' },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalInput: { backgroundColor: '#2C2C2E', borderRadius: 10, padding: 14, color: '#FFF', fontSize: 16, marginBottom: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2C2C2E', alignItems: 'center' },
  modalCancelText: { color: '#FFF', fontSize: 15 },
  modalConfirm: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center' },
  modalConfirmText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  pickerSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, paddingTop: 8 },
  pickerHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#666', alignSelf: 'center', marginBottom: 16 },
  pickerTitle: { color: '#FFF', fontSize: 17, fontWeight: '700', paddingHorizontal: 24, marginBottom: 12 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 14 },
  pickerItemText: { color: '#FFF', fontSize: 16 },
});
