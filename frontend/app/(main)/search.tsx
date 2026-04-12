import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../src/constants/colors';
import api, { getMediaUrl } from '../../src/services/api';
import { OptimizedImage } from '../../src/components/OptimizedMedia';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const SMALL_SIZE = (SCREEN_WIDTH - GRID_GAP * 3) / 3;
const LARGE_SIZE = SMALL_SIZE * 2 + GRID_GAP;

interface UserResult {
  id: string;
  username: string;
  name: string;
  profile_image: string | null;
  bio?: string;
  followers_count?: number;
}

interface ExplorePost {
  id: string;
  media: string;
  user_id: string;
  likes_count?: number;
  comments_count?: number;
  is_video?: boolean;
}

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [explorePosts, setExplorePosts] = useState<ExplorePost[]>([]);
  const [isLoadingExplore, setIsLoadingExplore] = useState(true);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load explore posts on mount
  useEffect(() => {
    loadExplorePosts();
  }, []);

  const loadExplorePosts = async () => {
    try {
      const res = await api.get('/posts?limit=30');
      // Mark videos
      const posts = res.data.map((p: any) => ({
        ...p,
        is_video: p.media?.includes('.mp4') || p.media?.includes('.mov') || p.media?.includes('video'),
      }));
      setExplorePosts(posts);
    } catch (e) {
      console.log('Failed to load explore posts', e);
    } finally {
      setIsLoadingExplore(false);
    }
  };

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 1) { setResults([]); setHasSearched(false); return; }
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      setHasSearched(true);
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(text)}`);
        setResults(res.data);
      } catch { setResults([]); }
      finally { setIsLoading(false); }
    }, 300);
  }, []);

  // Render Instagram-style grid pattern (1 large + 2 small, then 3 small, repeat)
  const renderExploreGrid = () => {
    const rows: React.ReactElement[] = [];
    let i = 0;
    let rowIndex = 0;

    while (i < explorePosts.length) {
      const patternIndex = rowIndex % 3;
      
      if (patternIndex === 0 && i + 3 <= explorePosts.length) {
        // Row type 1: Large left + 2 small stacked right
        const large = explorePosts[i];
        const small1 = explorePosts[i + 1];
        const small2 = explorePosts[i + 2];
        
        rows.push(
          <View key={`row-${rowIndex}`} style={styles.gridRow}>
            <TouchableOpacity 
              style={[styles.gridItemLarge, { width: LARGE_SIZE, height: LARGE_SIZE }]}
              onPress={() => router.push(`/(main)/post/${large.id}`)}
            >
              <OptimizedImage uri={getMediaUrl(large.media)} width={LARGE_SIZE} height={LARGE_SIZE} />
              {large.is_video && (
                <View style={styles.videoIcon}>
                  <Ionicons name="play" size={16} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.smallColumn}>
              <TouchableOpacity 
                style={[styles.gridItemSmall, { width: SMALL_SIZE, height: SMALL_SIZE }]}
                onPress={() => router.push(`/(main)/post/${small1.id}`)}
              >
                <OptimizedImage uri={getMediaUrl(small1.media)} width={SMALL_SIZE} height={SMALL_SIZE} />
                {small1.is_video && (
                  <View style={styles.videoIcon}>
                    <Ionicons name="play" size={12} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.gridItemSmall, { width: SMALL_SIZE, height: SMALL_SIZE, marginTop: GRID_GAP }]}
                onPress={() => router.push(`/(main)/post/${small2.id}`)}
              >
                <OptimizedImage uri={getMediaUrl(small2.media)} width={SMALL_SIZE} height={SMALL_SIZE} />
                {small2.is_video && (
                  <View style={styles.videoIcon}>
                    <Ionicons name="play" size={12} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
        i += 3;
      } else if (patternIndex === 1 && i + 3 <= explorePosts.length) {
        // Row type 2: 3 small in a row
        const items = explorePosts.slice(i, i + 3);
        rows.push(
          <View key={`row-${rowIndex}`} style={styles.gridRowSmall}>
            {items.map((item, idx) => (
              <TouchableOpacity 
                key={item.id}
                style={[styles.gridItemSmall, { width: SMALL_SIZE, height: SMALL_SIZE, marginLeft: idx > 0 ? GRID_GAP : 0 }]}
                onPress={() => router.push(`/(main)/post/${item.id}`)}
              >
                <OptimizedImage uri={getMediaUrl(item.media)} width={SMALL_SIZE} height={SMALL_SIZE} />
                {item.is_video && (
                  <View style={styles.videoIcon}>
                    <Ionicons name="play" size={12} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        );
        i += 3;
      } else if (patternIndex === 2 && i + 3 <= explorePosts.length) {
        // Row type 3: 2 small stacked left + Large right
        const small1 = explorePosts[i];
        const small2 = explorePosts[i + 1];
        const large = explorePosts[i + 2];
        
        rows.push(
          <View key={`row-${rowIndex}`} style={styles.gridRow}>
            <View style={styles.smallColumn}>
              <TouchableOpacity 
                style={[styles.gridItemSmall, { width: SMALL_SIZE, height: SMALL_SIZE }]}
                onPress={() => router.push(`/(main)/post/${small1.id}`)}
              >
                <OptimizedImage uri={getMediaUrl(small1.media)} width={SMALL_SIZE} height={SMALL_SIZE} />
                {small1.is_video && (
                  <View style={styles.videoIcon}>
                    <Ionicons name="play" size={12} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.gridItemSmall, { width: SMALL_SIZE, height: SMALL_SIZE, marginTop: GRID_GAP }]}
                onPress={() => router.push(`/(main)/post/${small2.id}`)}
              >
                <OptimizedImage uri={getMediaUrl(small2.media)} width={SMALL_SIZE} height={SMALL_SIZE} />
                {small2.is_video && (
                  <View style={styles.videoIcon}>
                    <Ionicons name="play" size={12} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={[styles.gridItemLarge, { width: LARGE_SIZE, height: LARGE_SIZE, marginLeft: GRID_GAP }]}
              onPress={() => router.push(`/(main)/post/${large.id}`)}
            >
              <OptimizedImage uri={getMediaUrl(large.media)} width={LARGE_SIZE} height={LARGE_SIZE} />
              {large.is_video && (
                <View style={styles.videoIcon}>
                  <Ionicons name="play" size={16} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        );
        i += 3;
      } else {
        // Remaining items: just show as small grid
        const remaining = explorePosts.slice(i);
        rows.push(
          <View key={`row-${rowIndex}`} style={styles.gridRowSmall}>
            {remaining.map((item, idx) => (
              <TouchableOpacity 
                key={item.id}
                style={[styles.gridItemSmall, { width: SMALL_SIZE, height: SMALL_SIZE, marginLeft: idx > 0 ? GRID_GAP : 0 }]}
                onPress={() => router.push(`/(main)/post/${item.id}`)}
              >
                <OptimizedImage uri={getMediaUrl(item.media)} width={SMALL_SIZE} height={SMALL_SIZE} />
                {item.is_video && (
                  <View style={styles.videoIcon}>
                    <Ionicons name="play" size={12} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        );
        break;
      }
      rowIndex++;
    }
    return rows;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="search-back-btn">
          <Ionicons name="chevron-back" size={26} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca..."
            placeholderTextColor="#666"
            value={query}
            onChangeText={handleSearch}
            returnKeyType="search"
            data-testid="search-input"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setHasSearched(false); }}>
              <Ionicons name="close-circle" size={18} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : hasSearched ? (
        results.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="search-outline" size={48} color="#444" />
            <Text style={styles.emptyText}>Nessun utente trovato</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.userRow}
                onPress={() => router.push(`/(main)/user/${item.id}`)}
                data-testid={`search-result-${item.id}`}
              >
                <View style={styles.userAvatar}>
                  {item.profile_image ? (
                    <Image source={{ uri: getMediaUrl(item.profile_image) || '' }} style={styles.avatarImg} />
                  ) : (
                    <Ionicons name="person" size={22} color="#666" />
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.username}</Text>
                  <Text style={styles.userFullName}>{item.name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#444" />
              </TouchableOpacity>
            )}
          />
        )
      ) : (
        /* Explore Grid - Instagram Style */
        <ScrollView 
          style={styles.exploreContainer}
          showsVerticalScrollIndicator={false}
        >
          {isLoadingExplore ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : explorePosts.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="images-outline" size={48} color="#444" />
              <Text style={styles.emptyText}>Nessun contenuto da esplorare</Text>
            </View>
          ) : (
            renderExploreGrid()
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 10, paddingHorizontal: 12, height: 40, gap: 8 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, minHeight: 200 },
  emptyText: { color: '#666', fontSize: 15 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  userAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  userInfo: { flex: 1, marginLeft: 14 },
  userName: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  userFullName: { color: '#888', fontSize: 13, marginTop: 2 },
  
  // Explore Grid Styles
  exploreContainer: { flex: 1 },
  gridRow: { flexDirection: 'row', marginTop: GRID_GAP },
  gridRowSmall: { flexDirection: 'row', marginTop: GRID_GAP },
  gridItemLarge: { overflow: 'hidden', backgroundColor: '#1a1a1a' },
  gridItemSmall: { overflow: 'hidden', backgroundColor: '#1a1a1a' },
  smallColumn: { marginLeft: GRID_GAP },
  videoIcon: { 
    position: 'absolute', 
    top: 8, 
    right: 8, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    borderRadius: 4, 
    padding: 4,
  },
});
