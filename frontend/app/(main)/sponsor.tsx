import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api, { uploadFile, getMediaUrl } from '../../src/services/api';

const { width } = Dimensions.get('window');

interface AdPackage {
  id: string;
  name: string;
  emoji: string;
  impressions: number;
  price: number;
  currency: string;
  duration_days: number;
  description: string;
}

interface Ad {
  id: string;
  title: string;
  media_url: string;
  media_type: string;
  status: string;
  impressions_bought: number;
  impressions_used: number;
  clicks: number;
  created_at: string;
  expires_at: string;
  package_id: string;
}

export default function SponsorScreen() {
  const router = useRouter();
  const [packages, setPackages] = useState<AdPackage[]>([]);
  const [myAds, setMyAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'create' | 'my-ads'>('create');
  
  // Create ad form
  const [title, setTitle] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [linkType, setLinkType] = useState<'external' | 'lesson'>('external');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('Scopri di più');
  const [selectedPackage, setSelectedPackage] = useState<string>('starter');
  const [placements, setPlacements] = useState<string[]>(['feed']);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [packagesRes, adsRes] = await Promise.all([
        api.get('/ads/packages'),
        api.get('/ads/my'),
      ]);
      setPackages(packagesRes.data);
      setMyAds(adsRes.data);
    } catch (error) {
      console.error('Failed to load ads data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setMediaType(result.assets[0].type === 'video' ? 'video' : 'image');
    }
  };

  const togglePlacement = (placement: string) => {
    setPlacements(prev => 
      prev.includes(placement) 
        ? prev.filter(p => p !== placement)
        : [...prev, placement]
    );
  };

  const handleCreateAd = async () => {
    if (!title.trim()) {
      Alert.alert('Errore', 'Inserisci un titolo per la sponsorizzata');
      return;
    }
    if (!mediaUri) {
      Alert.alert('Errore', 'Seleziona un\'immagine o video');
      return;
    }
    if (!linkUrl.trim()) {
      Alert.alert('Errore', 'Inserisci un link di destinazione');
      return;
    }
    if (placements.length === 0) {
      Alert.alert('Errore', 'Seleziona almeno un posizionamento');
      return;
    }

    setIsCreating(true);
    try {
      // Upload media first
      const uploadedUrl = await uploadFile(mediaUri);
      
      // Create ad
      await api.post('/ads', {
        title,
        media_url: uploadedUrl,
        media_type: mediaType,
        link_type: linkType,
        link_url: linkUrl,
        link_text: linkText,
        placement: placements,
        package_id: selectedPackage,
      });

      Alert.alert('Successo! 🎉', 'La tua sponsorizzata è stata creata e sarà attiva a breve.', [
        { text: 'OK', onPress: () => {
          // Reset form
          setTitle('');
          setMediaUri(null);
          setLinkUrl('');
          setLinkText('Scopri di più');
          setSelectedPackage('starter');
          setPlacements(['feed']);
          // Refresh ads
          loadData();
          setActiveTab('my-ads');
        }}
      ]);
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile creare la sponsorizzata');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleAdStatus = async (adId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await api.patch(`/ads/${adId}`, { status: newStatus });
      setMyAds(prev => prev.map(ad => 
        ad.id === adId ? { ...ad, status: newStatus } : ad
      ));
    } catch (error) {
      Alert.alert('Errore', 'Impossibile aggiornare lo stato');
    }
  };

  const deleteAd = async (adId: string) => {
    Alert.alert('Elimina', 'Vuoi eliminare questa sponsorizzata?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/ads/${adId}`);
          setMyAds(prev => prev.filter(ad => ad.id !== adId));
        } catch (error) {
          Alert.alert('Errore', 'Impossibile eliminare');
        }
      }}
    ]);
  };

  const selectedPkg = packages.find(p => p.id === selectedPackage);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E91E63" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sponsorizzate</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'create' && styles.tabActive]}
          onPress={() => setActiveTab('create')}
        >
          <Ionicons name="add-circle" size={20} color={activeTab === 'create' ? '#E91E63' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'create' && styles.tabTextActive]}>Crea</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'my-ads' && styles.tabActive]}
          onPress={() => setActiveTab('my-ads')}
        >
          <Ionicons name="megaphone" size={20} color={activeTab === 'my-ads' ? '#E91E63' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'my-ads' && styles.tabTextActive]}>Le mie ({myAds.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'create' ? (
          <>
            {/* Media Picker */}
            <Text style={styles.sectionTitle}>Media</Text>
            <TouchableOpacity style={styles.mediaPicker} onPress={pickMedia}>
              {mediaUri ? (
                <Image source={{ uri: mediaUri }} style={styles.mediaPreview} />
              ) : (
                <View style={styles.mediaPlaceholder}>
                  <Ionicons name="image" size={40} color="#666" />
                  <Text style={styles.mediaPlaceholderText}>Tocca per scegliere</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Title */}
            <Text style={styles.sectionTitle}>Titolo</Text>
            <TextInput
              style={styles.input}
              placeholder="Es: Scarpe da Ballo Premium"
              placeholderTextColor="#666"
              value={title}
              onChangeText={setTitle}
            />

            {/* Link */}
            <Text style={styles.sectionTitle}>Destinazione</Text>
            <View style={styles.linkTypeRow}>
              <TouchableOpacity 
                style={[styles.linkTypeBtn, linkType === 'external' && styles.linkTypeBtnActive]}
                onPress={() => setLinkType('external')}
              >
                <Ionicons name="globe" size={18} color={linkType === 'external' ? '#fff' : '#666'} />
                <Text style={[styles.linkTypeBtnText, linkType === 'external' && styles.linkTypeBtnTextActive]}>URL Esterno</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.linkTypeBtn, linkType === 'lesson' && styles.linkTypeBtnActive]}
                onPress={() => setLinkType('lesson')}
              >
                <Ionicons name="school" size={18} color={linkType === 'lesson' ? '#fff' : '#666'} />
                <Text style={[styles.linkTypeBtnText, linkType === 'lesson' && styles.linkTypeBtnTextActive]}>Lezione</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder={linkType === 'external' ? 'https://...' : 'ID Lezione'}
              placeholderTextColor="#666"
              value={linkUrl}
              onChangeText={setLinkUrl}
              autoCapitalize="none"
              keyboardType={linkType === 'external' ? 'url' : 'default'}
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Testo pulsante (es: Acquista Ora)"
              placeholderTextColor="#666"
              value={linkText}
              onChangeText={setLinkText}
            />

            {/* Placements */}
            <Text style={styles.sectionTitle}>Dove mostrare</Text>
            <View style={styles.placementsRow}>
              {[
                { id: 'feed', icon: 'grid', label: 'Feed' },
                { id: 'story', icon: 'albums', label: 'Stories' },
                { id: 'preroll', icon: 'play-circle', label: 'Pre-roll' },
              ].map(p => (
                <TouchableOpacity 
                  key={p.id}
                  style={[styles.placementBtn, placements.includes(p.id) && styles.placementBtnActive]}
                  onPress={() => togglePlacement(p.id)}
                >
                  <Ionicons name={p.icon as any} size={20} color={placements.includes(p.id) ? '#fff' : '#666'} />
                  <Text style={[styles.placementBtnText, placements.includes(p.id) && styles.placementBtnTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Packages */}
            <Text style={styles.sectionTitle}>Pacchetto</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.packagesScroll}>
              {packages.map(pkg => (
                <TouchableOpacity 
                  key={pkg.id}
                  style={[styles.packageCard, selectedPackage === pkg.id && styles.packageCardActive]}
                  onPress={() => setSelectedPackage(pkg.id)}
                >
                  <Text style={styles.packageEmoji}>{pkg.emoji}</Text>
                  <Text style={[styles.packageName, selectedPackage === pkg.id && styles.packageNameActive]}>{pkg.name}</Text>
                  <Text style={styles.packageImpressions}>{pkg.impressions.toLocaleString()} imp.</Text>
                  <Text style={[styles.packagePrice, selectedPackage === pkg.id && styles.packagePriceActive]}>€{pkg.price}</Text>
                  <Text style={styles.packageDuration}>{pkg.duration_days} giorni</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Summary */}
            {selectedPkg && (
              <View style={styles.summary}>
                <Text style={styles.summaryTitle}>Riepilogo</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Pacchetto</Text>
                  <Text style={styles.summaryValue}>{selectedPkg.emoji} {selectedPkg.name}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Impressions</Text>
                  <Text style={styles.summaryValue}>{selectedPkg.impressions.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Durata</Text>
                  <Text style={styles.summaryValue}>{selectedPkg.duration_days} giorni</Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryTotal]}>
                  <Text style={styles.summaryTotalLabel}>Totale</Text>
                  <Text style={styles.summaryTotalValue}>€{selectedPkg.price}</Text>
                </View>
              </View>
            )}

            {/* Create Button */}
            <TouchableOpacity 
              style={[styles.createBtn, isCreating && styles.createBtnDisabled]}
              onPress={handleCreateAd}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="rocket" size={20} color="#fff" />
                  <Text style={styles.createBtnText}>Lancia Sponsorizzata</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              * Pagamento mockato per demo. In produzione verrà integrato Stripe.
            </Text>
          </>
        ) : (
          <>
            {myAds.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="megaphone-outline" size={60} color="#444" />
                <Text style={styles.emptyStateTitle}>Nessuna sponsorizzata</Text>
                <Text style={styles.emptyStateText}>Crea la tua prima sponsorizzata per raggiungere più utenti!</Text>
              </View>
            ) : (
              myAds.map(ad => (
                <View key={ad.id} style={styles.adCard}>
                  <Image source={{ uri: getMediaUrl(ad.media_url) }} style={styles.adCardImage} />
                  <View style={styles.adCardInfo}>
                    <Text style={styles.adCardTitle}>{ad.title}</Text>
                    <View style={styles.adCardStats}>
                      <View style={styles.adCardStat}>
                        <Ionicons name="eye" size={14} color="#888" />
                        <Text style={styles.adCardStatText}>{ad.impressions_used}/{ad.impressions_bought}</Text>
                      </View>
                      <View style={styles.adCardStat}>
                        <Ionicons name="hand-left" size={14} color="#888" />
                        <Text style={styles.adCardStatText}>{ad.clicks} click</Text>
                      </View>
                    </View>
                    <View style={[styles.adCardStatus, ad.status === 'active' && styles.adCardStatusActive]}>
                      <Text style={[styles.adCardStatusText, ad.status === 'active' && styles.adCardStatusTextActive]}>
                        {ad.status === 'active' ? 'Attiva' : ad.status === 'paused' ? 'In pausa' : 'Completata'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.adCardActions}>
                    <TouchableOpacity 
                      style={styles.adCardActionBtn}
                      onPress={() => toggleAdStatus(ad.id, ad.status)}
                    >
                      <Ionicons name={ad.status === 'active' ? 'pause' : 'play'} size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.adCardActionBtn, styles.adCardActionBtnDanger]}
                      onPress={() => deleteAd(ad.id)}
                    >
                      <Ionicons name="trash" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#E91E63',
  },
  tabText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#E91E63',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },
  mediaPicker: {
    width: '100%',
    height: 200,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
  },
  mediaPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPlaceholderText: {
    color: '#666',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 16,
  },
  linkTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  linkTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  linkTypeBtnActive: {
    backgroundColor: '#E91E63',
  },
  linkTypeBtnText: {
    color: '#666',
    fontWeight: '500',
  },
  linkTypeBtnTextActive: {
    color: '#fff',
  },
  placementsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  placementBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 4,
  },
  placementBtnActive: {
    backgroundColor: '#E91E63',
  },
  placementBtnText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  placementBtnTextActive: {
    color: '#fff',
  },
  packagesScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  packageCard: {
    width: 120,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginRight: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  packageCardActive: {
    borderColor: '#E91E63',
    backgroundColor: '#2a1a1f',
  },
  packageEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  packageName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  packageNameActive: {
    color: '#E91E63',
  },
  packageImpressions: {
    color: '#888',
    fontSize: 11,
  },
  packagePrice: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
  },
  packagePriceActive: {
    color: '#E91E63',
  },
  packageDuration: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  summary: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  summaryLabel: {
    color: '#888',
  },
  summaryValue: {
    color: '#fff',
    fontWeight: '500',
  },
  summaryTotal: {
    borderBottomWidth: 0,
    marginTop: 8,
  },
  summaryTotalLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryTotalValue: {
    color: '#E91E63',
    fontSize: 20,
    fontWeight: '700',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E91E63',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyStateText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  adCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  adCardImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
  },
  adCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  adCardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  adCardStats: {
    flexDirection: 'row',
    gap: 12,
  },
  adCardStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adCardStatText: {
    color: '#888',
    fontSize: 12,
  },
  adCardStatus: {
    alignSelf: 'flex-start',
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 6,
  },
  adCardStatusActive: {
    backgroundColor: '#1a4a1a',
  },
  adCardStatusText: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
  },
  adCardStatusTextActive: {
    color: '#4CAF50',
  },
  adCardActions: {
    justifyContent: 'center',
    gap: 8,
  },
  adCardActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adCardActionBtnDanger: {
    backgroundColor: '#4a1a1a',
  },
});
