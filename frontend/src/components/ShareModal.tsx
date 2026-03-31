import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  Modal,
  Dimensions,
  Share,
  Linking,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api, { getMediaUrl } from '../services/api';
import Colors from '../constants/colors';
import * as Clipboard from 'expo-clipboard';

const { width, height } = Dimensions.get('window');

interface User {
  id: string;
  username: string;
  name: string;
  profile_image: string | null;
}

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  mediaUrl?: string;
  mediaType?: 'photo' | 'video';
  postId?: string;
}

export default function ShareModal({ visible, onClose, mediaUrl, mediaType, postId }: ShareModalProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadUsers();
    }
  }, [visible]);

  const loadUsers = async () => {
    try {
      // Load followers/following for share suggestions
      const res = await api.get('/users/suggestions');
      setUsers(res.data || []);
    } catch (e) {
      // Fallback: try to get some users
      try {
        const res = await api.get('/users');
        setUsers(res.data?.slice(0, 12) || []);
      } catch {
        setUsers([]);
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUserSelection = (userId: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUsers(newSet);
  };

  const handleAddToStory = () => {
    onClose();
    if (mediaUrl) {
      router.push({
        pathname: '/(main)/create-story',
        params: { sharedMedia: mediaUrl, sharedType: mediaType || 'photo' }
      });
    }
  };

  const handleCopyLink = async () => {
    try {
      const link = `beatmates://post/${postId}`;
      await Clipboard.setStringAsync(link);
      Alert.alert('Link copiato!', 'Il link è stato copiato negli appunti.');
      onClose();
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  const handleShareExternal = async () => {
    try {
      await Share.share({
        message: `Guarda questo su BEAT MATES! beatmates://post/${postId}`,
      });
    } catch (e) {
      console.error('Share failed', e);
    }
  };

  const handleSendToUsers = async () => {
    if (selectedUsers.size === 0) return;
    
    setIsLoading(true);
    try {
      // Send message with post to selected users
      for (const userId of selectedUsers) {
        const convRes = await api.post('/conversations', { user_id: userId });
        await api.post(`/conversations/${convRes.data.id}/messages`, {
          text: `Ti ho condiviso un post! 📹`,
          shared_post_id: postId,
        });
      }
      Alert.alert('Inviato!', 'Post condiviso con successo.');
      onClose();
    } catch (e) {
      console.error('Send failed', e);
      Alert.alert('Errore', 'Impossibile inviare.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderUser = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.has(item.id);
    const imageUrl = item.profile_image ? getMediaUrl(item.profile_image) : null;
    
    return (
      <TouchableOpacity style={styles.userItem} onPress={() => toggleUserSelection(item.id)}>
        <View style={styles.userAvatarContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.userAvatar} />
          ) : (
            <View style={[styles.userAvatar, styles.placeholderAvatar]}>
              <Text style={styles.avatarLetter}>{item.username.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {isSelected && (
            <View style={styles.selectedBadge}>
              <Ionicons name="checkmark" size={12} color="#fff" />
            </View>
          )}
        </View>
        <Text style={styles.userName} numberOfLines={1}>{item.name || item.username}</Text>
      </TouchableOpacity>
    );
  };

  const ShareOption = ({ icon, label, onPress, color }: { icon: string; label: string; onPress: () => void; color?: string }) => (
    <TouchableOpacity style={styles.shareOption} onPress={onPress}>
      <View style={[styles.shareOptionIcon, color ? { backgroundColor: color } : null]}>
        <Ionicons name={icon as any} size={24} color={color ? '#fff' : Colors.text} />
      </View>
      <Text style={styles.shareOptionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#8E8E93" />
            <TextInput
              style={styles.searchInput}
              placeholder="Cerca"
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity style={styles.addGroupBtn}>
              <Ionicons name="people-outline" size={20} color={Colors.text} />
              <Text style={styles.plusBadge}>+</Text>
            </TouchableOpacity>
          </View>

          {/* User grid */}
          <FlatList
            data={filteredUsers}
            renderItem={renderUser}
            keyExtractor={(item) => item.id}
            numColumns={3}
            style={styles.userList}
            contentContainerStyle={styles.userListContent}
            showsVerticalScrollIndicator={false}
          />

          {/* Share options row - Instagram-style horizontal scroll */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shareOptionsScroll} contentContainerStyle={styles.shareOptionsContent}>
            <ShareOption icon="add-circle-outline" label="Aggiungi alla storia" onPress={handleAddToStory} />
            <ShareOption icon="at-circle-outline" label="Threads" onPress={() => {}} color="#000" />
            <ShareOption icon="arrow-redo-outline" label="Condividi su..." onPress={handleShareExternal} />
            <ShareOption icon="link-outline" label="Copia link" onPress={handleCopyLink} />
            <ShareOption icon="logo-whatsapp" label="WhatsApp" onPress={() => Linking.openURL('whatsapp://')} color="#25D366" />
          </ScrollView>

          {/* Send button if users selected */}
          {selectedUsers.size > 0 && (
            <TouchableOpacity 
              style={styles.sendButton} 
              onPress={handleSendToUsers}
              disabled={isLoading}
            >
              <Text style={styles.sendButtonText}>
                {isLoading ? 'Invio...' : `Invia (${selectedUsers.size})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: height * 0.7,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#C4C4C4',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    marginHorizontal: 16,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 36,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    color: '#000',
  },
  addGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plusBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.text,
    marginLeft: -4,
    marginTop: -8,
  },
  userList: {
    maxHeight: 240,
  },
  userListContent: {
    paddingHorizontal: 16,
  },
  userItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    maxWidth: width / 3 - 16,
  },
  userAvatarContainer: {
    position: 'relative',
  },
  userAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  placeholderAvatar: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
  selectedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 12,
    color: '#000',
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 80,
  },
  shareOptionsScroll: {
    borderTopWidth: 0.5,
    borderTopColor: '#E5E5EA',
    marginTop: 8,
  },
  shareOptionsContent: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  shareOption: {
    alignItems: 'center',
    width: 72,
    marginHorizontal: 4,
  },
  shareOptionIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  shareOptionLabel: {
    fontSize: 11,
    color: '#000',
    textAlign: 'center',
    lineHeight: 13,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
