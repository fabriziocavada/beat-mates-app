import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Colors from '../../src/constants/colors';
import api, { uploadFile, getMediaUrl } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [allCategories, setAllCategories] = useState<{id: string; name: string}[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(user?.dance_categories || []);

  useEffect(() => {
    api.get('/dance-categories').then(r => setAllCategories(r.data)).catch(() => {});
  }, []);

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev => 
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/users/me', { name, username, bio, dance_categories: selectedCategories });
      await refreshUser();
      Alert.alert('Salvato', 'Profilo aggiornato!');
      router.back();
    } catch (e: any) {
      Alert.alert('Errore', e?.response?.data?.detail || 'Aggiornamento fallito');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      const uploadResult = await uploadFile(result.assets[0].uri);
      if (uploadResult.url) {
        await api.put('/users/me', { profile_image: uploadResult.url });
        await refreshUser();
      }
    } catch { Alert.alert('Errore', 'Upload foto fallito'); }
    finally { setUploading(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={28} color="#FFF" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Modifica Profilo</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveText, saving && { opacity: 0.5 }]}>Salva</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        <TouchableOpacity style={styles.avatarSection} onPress={handleChangePhoto}>
          {uploading ? <ActivityIndicator size="large" color={Colors.primary} /> : user?.profile_image ? (
            <Image source={{ uri: getMediaUrl(user.profile_image) || '' }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}><Ionicons name="person" size={40} color="#666" /></View>
          )}
          <Text style={styles.changePhotoText}>Cambia foto profilo</Text>
        </TouchableOpacity>
        <Text style={styles.label}>Nome</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor="#666" />
        <Text style={styles.label}>Username</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholderTextColor="#666" />
        <Text style={styles.label}>Bio</Text>
        <TextInput style={[styles.input, { height: 80 }]} value={bio} onChangeText={setBio} multiline placeholderTextColor="#666" placeholder="Racconta di te..." />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  saveText: { color: Colors.primary, fontSize: 16, fontWeight: '700' },
  avatarSection: { alignItems: 'center', marginBottom: 30 },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: { backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' },
  changePhotoText: { color: Colors.primary, fontSize: 14, fontWeight: '600', marginTop: 10 },
  label: { color: '#888', fontSize: 13, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: '#1C1C1E', borderRadius: 10, padding: 14, color: '#FFF', fontSize: 16 },
});
