import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../src/constants/colors';
import api, { getMediaUrl, getThumbnailUrl } from '../../src/services/api';
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
  media_urls?: string[];
  user_id: string;
  type?: string;
  likes_count?: number;
  comments_count?: number;
  is_video?: boolean;
}

interface DanceCategory {
  id: string;
  name: string;
  image_url: string;
}

// Suggested accounts to show before searching
interface SuggestedUser {
  id: string;
  username: string;
  name: string;
  profile_image: string | null;
  dance_categories?: string[];
}

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [explorePosts, setExplorePosts] = useState<ExplorePost[]>([]);
  const [isLoadingExplore, setIsLoadingExplore] = useState(true);
  const [categories, setCategories] = useState<DanceCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadExplorePosts();
    loadCategories();
    loadSuggestedUsers();
  }, []);

  const loadCategories = async () => {
    try {
      const res = await api.get('/dance-categories');
      setCategories(res.data);
    } catch (e) {
      console.log('Failed to load categories', e);
    }
  };

  const loadSuggestedUsers = async () => {
    try {
      const res = await api.get('/available-teachers');
      // Take top 8 users as suggestions
      setSuggestedUsers(res.data.slice(0, 8));
    } catch (e) {
      console.log('Failed to load suggested users', e);
    }
  };

  const loadExplorePosts = async () => {
    try {
      const res = await api.get('/posts?limit=30');
      const posts = res.data.map((p: any) => {
        const mediaUrl = p.media || (p.media_urls && p.media_urls[0]);
        return {
          ...p,
          media: mediaUrl,
          is_video: p.type === 'video' || (mediaUrl && (
            mediaUrl.includes('.mp4') || mediaUrl.includes('.mov') ||
            mediaUrl.includes('video') || mediaUrl.includes('mediadelivery.net')
          )),
        };
      });
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
      setIsSearching(true);
      setHasSearched(true);
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(text)}`);
        setResults(res.data);
      } catch { setResults([]); }
      finally { setIsSearching(false); }
    }, 300);
  }, []);

  const handleCategoryPress = (catId: string) => {
    setSelectedCategory(prev => prev === catId ? null : catId);
  };

  // Filter explore posts by category (using user's dance_categories)
  const filteredPosts = selectedCategory
    ? explorePosts // For now show all - backend doesn't filter posts by category yet
    : explorePosts;

  // Get the best image URL for a grid item (thumbnail for videos, direct URL for photos)
  const getGridImageUrl = (item: ExplorePost): string | null => {
    if (item.is_video) {
      return getThumbnailUrl(item.media) || getMediaUrl(item.media);
    }
    return getMediaUrl(item.media);
  };

  // Render Instagram-style grid
  const renderExploreGrid = () => {
    const rows: React.ReactElement[] = [];
    let i = 0;
    let rowIndex = 0;
    const data = filteredPosts;

    while (i < data.length) {
      const patternIndex = rowIndex % 3;

      if (patternIndex === 0 && i + 3 <= data.length) {
        const large = data[i];
        const small1 = data[i + 1];
        const small2 = data[i + 2];
        rows.push(
          <View key={`row-${rowIndex}`} style={styles.gridRow}>
            <TouchableOpacity
              style={[styles.gridItemLarge, { width: LARGE_SIZE, height: LARGE_SIZE }]}
              onPress={() => large.is_video
                ? router.push({ pathname: '/(main)/reels', params: { postId: large.id } })
                : router.push(`/(main)/post/${large.id}`)
              }
              data-testid={`explore-item-${large.id}`}
            >
              <OptimizedImage uri={getGridImageUrl(large)} width={LARGE_SIZE} height={LARGE_SIZE} />
              {large.is_video && <View style={styles.videoIcon}><Ionicons name="play" size={16} color="#FFF" /></View>}
            </TouchableOpacity>
            <View style={styles.smallColumn}>
              <TouchableOpacity
                style={[styles.gridItemSmall, { width: SMALL_SIZE, height: SMALL_SIZE }]}
                onPress={() => small1.is_video
                  ? router.push({ pathname: '/(main)/reels', params: { postId: small1.id } })
                  : router.push(`/(main)/post/${small1.id}`)
                }
              >
                <OptimizedImage uri={getGridImageUrl(small1)} width={SMALL_SIZE} height={SMALL_SIZE} />
                {small1.is_video && <View style={styles.videoIcon}><Ionicons name="play" size={12} color="#FFF" /></View>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.gridItemSmall, { width: SMALL_SIZE, height: SMALL_SIZE, marginTop: GRID_GAP }]}
                onPress={() => small2.is_video
                  ? router.push({ pathname: '/(main)/reels', params: { postId: small2.id } })
                  : router.push(`/(main)/post/${small2.id}`)
                }
              >
                <OptimizedImage uri={getGridImageUrl(small2)} width={SMALL_SIZE} height={SMALL_SIZE} />
                {small2.is_video && <View style={styles.videoIcon}><Ionicons name="play" size={12} color="#FFF" /></View>}
              </TouchableOpacity>
            </View>
          </View>
        );
        i += 3;
      } else if (patternIndex === 1 && i + 3 <= data.length) {
        const items = data.slice(i, i + 3);
        rows.push(
          <View key={`row-${rowIndex}`} style={styles.gridRowSmall}>
            {items.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.gridItemSmall, { width: SMALL_SIZE, height: SMALL_SIZE, marginLeft: idx > 0 ? GRID_GAP : 0 }]}
                onPress={() => item.is_video
                  ? router.push({ pathname: '/(main)/reels', params: { postId: item.id } })
                  : router.push(`/(main)/post/${item.id}`)
                }
              >
                <OptimizedImage uri={getGridImageUrl(item)} width={SMALL_SIZE} height={SMALL_SIZE} />
                {item.is_video && <View style={styles.videoIcon}><Ionicons name="play" size={12} color="#FFF" /></View>}
              </TouchableOpacity>
            ))}
          </View>
        );
        i += 3;
      } else if (patternIndex === 2 && i + 3 <= data.length) {
        const small1 = data[i];
        const small2 = data[i + 1];
        const large = data[i + 2];
        rows.push(
          <View key={`row-${rowIndex}`} style={styles.gridRow}>
            <View style={styles.smallColumn}>
              <TouchableOpacity
                style={[styles.gridItemSmall, { width: SMALL_SIZE, height: SMALL_SIZE }]}
                onPress={() => small1.is_video
                  ? router.push({ pathname: '/(main)/reels', params: { postId: small1.id } })
                  : router.push(`/(main)/post/${small1.id}`)
                }
              >
                <OptimizedImage uri={getGridImageUrl(small1)} width={SMALL_SIZE} height={SMALL_SIZE} />
                {small1.is_video && <View style={styles.videoIcon}><Ionicons name="play" size={12} color="#FFF" /></View>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.gridItemSmall, { width: SMALL_SIZE, height: SMALL_SIZE, marginTop: GRID_GAP }]}
                onPress={() => small2.is_video
                  ? router.push({ pathname: '/(main)/reels', params: { postId: small2.id } })
                  : router.push(`/(main)/post/${small2.id}`)
                }
              >
                <OptimizedImage uri={getGridImageUrl(small2)} width={SMALL_SIZE} height={SMALL_SIZE} />
                {small2.is_video && <View style={styles.videoIcon}><Ionicons name="play" size={12} color="#FFF" /></View>}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.gridItemLarge, { width: LARGE_SIZE, height: LARGE_SIZE, marginLeft: GRID_GAP }]}
              onPress={() => large.is_video
                ? router.push({ pathname: '/(main)/reels', params: { postId: large.id } })
                : router.push(`/(main)/post/${large.id}`)
              }
            >
              <OptimizedImage uri={getGridImageUrl(large)} width={LARGE_SIZE} height={LARGE_SIZE} />
              {large.is_video && <View style={styles.videoIcon}><Ionicons name="play" size={16} color="#FFF" /></View>}
            </TouchableOpacity>
          </View>
        );
        i += 3;
      } else {
        const remaining = data.slice(i);
        rows.push(
          <View key={`row-${rowIndex}`} style={styles.gridRowSmall}>
            {remaining.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.gridItemSmall, { width: SMALL_SIZE, height: SMALL_SIZE, marginLeft: idx > 0 ? GRID_GAP : 0 }]}
                onPress={() => item.is_video
                  ? router.push({ pathname: '/(main)/reels', params: { postId: item.id } })
                  : router.push(`/(main)/post/${item.id}`)
                }
              >
                <OptimizedImage uri={getGridImageUrl(item)} width={SMALL_SIZE} height={SMALL_SIZE} />
                {item.is_video && <View style={styles.videoIcon}><Ionicons name="play" size={12} color="#FFF" /></View>}
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

  // Show suggestions overlay when search bar is focused but empty
  const showSuggestions = isFocused && query.length === 0 && !hasSearched;

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
            placeholder="Cerca utenti, danza..."
            placeholderTextColor="#666"
            value={query}
            onChangeText={handleSearch}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            returnKeyType="search"
            data-testid="search-input"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setHasSearched(false); }} data-testid="search-clear-btn">
              <Ionicons name="close-circle" size={18} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Chips - Instagram style */}
      {!hasSearched && !showSuggestions && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryBar}
          contentContainerStyle={styles.categoryContent}
        >
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
              onPress={() => handleCategoryPress(cat.id)}
              data-testid={`category-chip-${cat.id}`}
            >
              <Text style={[styles.categoryChipText, selectedCategory === cat.id && styles.categoryChipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Suggestions overlay - shows when search is focused but empty */}
      {showSuggestions && suggestedUsers.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Suggeriti per te</Text>
          {suggestedUsers.map(user => (
            <TouchableOpacity
              key={user.id}
              style={styles.suggestionRow}
              onPress={() => {
                setIsFocused(false);
                router.push(`/(main)/user/${user.id}`);
              }}
              data-testid={`suggestion-${user.id}`}
            >
              <View style={styles.userAvatar}>
                {user.profile_image ? (
                  <Image source={{ uri: getMediaUrl(user.profile_image) || '' }} style={styles.avatarImg} />
                ) : (
                  <Ionicons name="person" size={22} color="#666" />
                )}
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.username}</Text>
                <Text style={styles.userFullName}>{user.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#444" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search Results */}
      {isSearching ? (
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
      ) : !showSuggestions ? (
        /* Explore Grid - Instagram Style */
        <ScrollView
          style={styles.exploreContainer}
          showsVerticalScrollIndicator={false}
        >
          {isLoadingExplore ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : filteredPosts.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="images-outline" size={48} color="#444" />
              <Text style={styles.emptyText}>Nessun contenuto da esplorare</Text>
            </View>
          ) : (
            renderExploreGrid()
          )}
        </ScrollView>
      ) : null}
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

  // Category chips
  categoryBar: { maxHeight: 44, paddingBottom: 4 },
  categoryContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
  },
  categoryChipText: {
    color: '#CCC',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#FFF',
  },

  // Suggestions
  suggestionsContainer: {
    flex: 1,
    paddingTop: 8,
  },
  suggestionsTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  // User rows (search results + suggestions)
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  userAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  userInfo: { flex: 1, marginLeft: 14 },
  userName: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  userFullName: { color: '#888', fontSize: 13, marginTop: 2 },

  // Explore Grid
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
