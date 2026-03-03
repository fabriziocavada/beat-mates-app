import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../src/constants/colors';

export default function ArchiveScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color="#FFF" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Archivio</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity style={styles.archiveItem}>
          <View style={styles.archiveIcon}><Ionicons name="grid-outline" size={24} color="#FFF" /></View>
          <View style={styles.archiveInfo}><Text style={styles.archiveTitle}>Post dell'archivio</Text><Text style={styles.archiveSub}>I post che hai archiviato</Text></View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.archiveItem}>
          <View style={styles.archiveIcon}><Ionicons name="play-circle-outline" size={24} color="#FFF" /></View>
          <View style={styles.archiveInfo}><Text style={styles.archiveTitle}>Storie dell'archivio</Text><Text style={styles.archiveSub}>Le storie che hai pubblicato</Text></View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.archiveItem}>
          <View style={styles.archiveIcon}><Ionicons name="videocam-outline" size={24} color="#FFF" /></View>
          <View style={styles.archiveInfo}><Text style={styles.archiveTitle}>Reels dell'archivio</Text><Text style={styles.archiveSub}>I reels che hai archiviato</Text></View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  archiveItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  archiveIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  archiveInfo: { flex: 1 },
  archiveTitle: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  archiveSub: { color: '#888', fontSize: 13, marginTop: 2 },
});
