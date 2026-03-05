import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  FlatList, Modal, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../src/constants/colors';
import api from '../../src/services/api';

interface PremiumPlaylist {
  id: string;
  name: string;
  genre: string;
  song_count: number;
  price_monthly: number;
  owner?: { username: string; name: string };
  is_subscribed: boolean;
}

// Demo songs for preview
const DEMO_SONGS = [
  { id: '1', title: 'Samba de Janeiro', artist: 'Bellini', duration: '3:45', isDemo: true },
  { id: '2', title: 'Tango Argentino', artist: 'Carlos Gardel', duration: '4:12', isDemo: true },
  { id: '3', title: 'Latin Groove', artist: 'DJ Dance', duration: '3:28', isDemo: true },
  { id: '4', title: 'Hip Hop Flow', artist: 'MC Beat', duration: '2:55', isDemo: true },
];

export default function PremiumPlaylistsScreen() {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<PremiumPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PremiumPlaylist | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [processingSubscription, setProcessingSubscription] = useState(false);

  useEffect(() => { loadPlaylists(); }, []);

  const loadPlaylists = async () => {
    try {
      const res = await api.get('/music/playlists/premium');
      // If no premium playlists exist, show demo ones
      if (res.data.length === 0) {
        setPlaylists([
          {
            id: 'demo-1',
            name: 'Latin Dance Essentials',
            genre: 'LATIN',
            song_count: 24,
            price_monthly: 9.99,
            owner: { username: 'dj_latino', name: 'DJ Latino' },
            is_subscribed: false,
          },
          {
            id: 'demo-2',
            name: 'Hip Hop Choreo Pack',
            genre: 'HIP HOP',
            song_count: 18,
            price_monthly: 9.99,
            owner: { username: 'hiphop_master', name: 'Hip Hop Master' },
            is_subscribed: false,
          },
          {
            id: 'demo-3',
            name: 'Tango Collection Premium',
            genre: 'TANGO',
            song_count: 32,
            price_monthly: 9.99,
            owner: { username: 'tango_pro', name: 'Tango Professional' },
            is_subscribed: false,
          },
        ]);
      } else {
        setPlaylists(res.data);
      }
    } catch (e) {
      console.error('Failed to load premium playlists', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = (playlist: PremiumPlaylist) => {
    setSelectedPlaylist(playlist);
    setShowSubscriptionModal(true);
  };

  const handleConfirmSubscription = async () => {
    if (!selectedPlaylist) return;
    setProcessingSubscription(true);
    
    // Simulate payment processing
    setTimeout(async () => {
      try {
        if (!selectedPlaylist.id.startsWith('demo-')) {
          await api.post(`/music/playlists/${selectedPlaylist.id}/subscribe`);
        }
        // Update local state
        setPlaylists(prev => prev.map(p => 
          p.id === selectedPlaylist.id ? { ...p, is_subscribed: true } : p
        ));
        setShowSubscriptionModal(false);
        setSelectedPlaylist(null);
      } catch (e) {
        console.error('Subscription failed', e);
      } finally {
        setProcessingSubscription(false);
      }
    }, 2000);
  };

  const renderPlaylistCard = ({ item }: { item: PremiumPlaylist }) => (
    <TouchableOpacity 
      style={styles.playlistCard}
      onPress={() => handleSubscribe(item)}
      data-testid={`premium-playlist-${item.id}`}
    >
      <View style={styles.playlistCover}>
        <View style={styles.playlistCoverGradient}>
          <Ionicons name="musical-notes" size={40} color="rgba(255,255,255,0.8)" />
        </View>
        {item.is_subscribed && (
          <View style={styles.subscribedBadge}>
            <Ionicons name="checkmark-circle" size={20} color="#4CD964" />
          </View>
        )}
      </View>
      <View style={styles.playlistInfo}>
        <Text style={styles.playlistName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.playlistOwner}>di {item.owner?.name || item.owner?.username}</Text>
        <View style={styles.playlistMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="musical-note" size={12} color="#888" />
            <Text style={styles.metaText}>{item.song_count} tracce</Text>
          </View>
          <Text style={styles.genreBadge}>{item.genre}</Text>
        </View>
        {!item.is_subscribed ? (
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>${item.price_monthly.toFixed(2)}</Text>
            <Text style={styles.pricePeriod}>/mese</Text>
          </View>
        ) : (
          <View style={styles.subscribedRow}>
            <Ionicons name="checkmark" size={14} color="#4CD964" />
            <Text style={styles.subscribedText}>Abbonato</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Playlist Premium</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="star" size={20} color="#FFD700" />
          <Text style={styles.infoBannerText}>
            Abbonati per accesso illimitato alle migliori tracce per la danza
          </Text>
        </View>

        {/* Playlists Grid */}
        <FlatList
          data={playlists}
          renderItem={renderPlaylistCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        />

        {/* Subscription Modal */}
        <Modal
          visible={showSubscriptionModal}
          transparent
          animationType="slide"
          statusBarTranslucent
        >
          <View style={styles.modalOverlay}>
            <View style={styles.subscriptionModal}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Abbonamento Mensile</Text>
                <TouchableOpacity onPress={() => setShowSubscriptionModal(false)}>
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <ScrollView style={styles.modalContent}>
                {/* Playlist Preview */}
                <View style={styles.playlistPreview}>
                  <View style={styles.previewCover}>
                    <Ionicons name="musical-notes" size={32} color={Colors.primary} />
                  </View>
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewName}>{selectedPlaylist?.name}</Text>
                    <Text style={styles.previewOwner}>di {selectedPlaylist?.owner?.name}</Text>
                    <Text style={styles.previewTracks}>{selectedPlaylist?.song_count} tracce</Text>
                  </View>
                </View>

                {/* Demo Songs */}
                <View style={styles.demoSection}>
                  <Text style={styles.demoTitle}>Anteprima (3-4 tracce demo)</Text>
                  {DEMO_SONGS.map((song, idx) => (
                    <View key={song.id} style={styles.demoSong}>
                      <View style={styles.demoSongLeft}>
                        <Text style={styles.demoSongNumber}>{idx + 1}</Text>
                        <View>
                          <Text style={styles.demoSongTitle}>{song.title}</Text>
                          <Text style={styles.demoSongArtist}>{song.artist}</Text>
                        </View>
                      </View>
                      <Text style={styles.demoSongDuration}>{song.duration}</Text>
                    </View>
                  ))}
                </View>

                {/* Price Box */}
                <View style={styles.priceBox}>
                  <View style={styles.priceBoxHeader}>
                    <Ionicons name="infinite" size={24} color={Colors.primary} />
                    <Text style={styles.priceBoxTitle}>Accesso Illimitato</Text>
                  </View>
                  <View style={styles.priceBoxAmount}>
                    <Text style={styles.priceBoxPrice}>$10.00</Text>
                    <Text style={styles.priceBoxPeriod}>/mese</Text>
                  </View>
                  <Text style={styles.priceBoxNote}>
                    Cancella quando vuoi. Nessun vincolo.
                  </Text>
                </View>

                {/* Mock Card */}
                <View style={styles.cardMockup}>
                  <View style={styles.cardRow}>
                    <Ionicons name="card" size={24} color={Colors.primary} />
                    <Text style={styles.cardText}>**** **** **** 4242</Text>
                  </View>
                  <Text style={styles.cardExpiry}>12/28</Text>
                </View>

                <Text style={styles.mockupNote}>
                  Questo è un mockup. In produzione verrà integrato Stripe.
                </Text>
              </ScrollView>

              {/* Subscribe Button */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.subscribeButton, processingSubscription && styles.subscribeButtonDisabled]}
                  onPress={handleConfirmSubscription}
                  disabled={processingSubscription}
                  data-testid="confirm-subscription-btn"
                >
                  {processingSubscription ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                      <Text style={styles.subscribeButtonText}>Abbonati - $10.00/mese</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  infoBannerText: { flex: 1, color: '#FFD700', fontSize: 14, lineHeight: 20 },
  
  gridContent: { padding: 16 },
  gridRow: { justifyContent: 'space-between', marginBottom: 16 },
  
  playlistCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  playlistCover: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  playlistCoverGradient: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    padding: 4,
  },
  playlistInfo: { padding: 12 },
  playlistName: { color: '#FFF', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  playlistOwner: { color: '#888', fontSize: 12, marginBottom: 8 },
  playlistMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#888', fontSize: 11 },
  genreBadge: { 
    backgroundColor: Colors.primary, 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 10,
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
    overflow: 'hidden',
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  priceText: { color: '#4CD964', fontSize: 18, fontWeight: '700' },
  pricePeriod: { color: '#888', fontSize: 12, marginLeft: 2 },
  subscribedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subscribedText: { color: '#4CD964', fontSize: 13, fontWeight: '600' },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  subscriptionModal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  modalContent: { padding: 20, maxHeight: 400 },
  
  playlistPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  previewCover: {
    width: 70,
    height: 70,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInfo: { flex: 1 },
  previewName: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  previewOwner: { color: '#888', fontSize: 13, marginTop: 2 },
  previewTracks: { color: Colors.primary, fontSize: 12, marginTop: 4 },
  
  demoSection: { marginBottom: 24 },
  demoTitle: { color: '#888', fontSize: 13, marginBottom: 12, fontWeight: '600' },
  demoSong: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  demoSongLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  demoSongNumber: { color: '#666', fontSize: 14, width: 20 },
  demoSongTitle: { color: '#FFF', fontSize: 14 },
  demoSongArtist: { color: '#888', fontSize: 12 },
  demoSongDuration: { color: '#888', fontSize: 12 },
  
  priceBox: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  priceBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  priceBoxTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  priceBoxAmount: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  priceBoxPrice: { color: '#4CD964', fontSize: 36, fontWeight: '700' },
  priceBoxPeriod: { color: '#888', fontSize: 16, marginLeft: 4 },
  priceBoxNote: { color: '#888', fontSize: 12 },
  
  cardMockup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardText: { color: '#FFF', fontSize: 16, fontWeight: '500', letterSpacing: 2 },
  cardExpiry: { color: '#888', fontSize: 14 },
  
  mockupNote: { color: '#666', fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
  
  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#2C2C2E' },
  subscribeButton: {
    backgroundColor: '#4CD964',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 14,
  },
  subscribeButtonDisabled: { opacity: 0.7 },
  subscribeButtonText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
});
