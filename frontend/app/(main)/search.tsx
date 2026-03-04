import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../src/constants/colors';
import api, { getMediaUrl } from '../../src/services/api';

interface UserResult {
  id: string;
  username: string;
  name: string;
  profile_image: string | null;
  bio?: string;
  followers_count?: number;
}

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="search-back-btn">
          <Ionicons name="chevron-back" size={26} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca utenti..."
            placeholderTextColor="#666"
            value={query}
            onChangeText={handleSearch}
            autoFocus
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

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : results.length === 0 && hasSearched ? (
        <View style={styles.centered}>
          <Ionicons name="search-outline" size={48} color="#444" />
          <Text style={styles.emptyText}>Nessun utente trovato</Text>
        </View>
      ) : !hasSearched ? (
        <View style={styles.centered}>
          <Ionicons name="people-outline" size={48} color="#333" />
          <Text style={styles.emptyText}>Cerca ballerini per nome o username</Text>
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 10, paddingHorizontal: 12, height: 40, gap: 8 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { color: '#666', fontSize: 15 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  userAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  userInfo: { flex: 1, marginLeft: 14 },
  userName: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  userFullName: { color: '#888', fontSize: 13, marginTop: 2 },
});
