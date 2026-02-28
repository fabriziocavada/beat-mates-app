import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '../../src/constants/colors';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface Category {
  id: string;
  name: string;
  image_url: string;
}

const categoryColors: Record<string, string> = {
  latin: '#8B5CF6',
  ballroom: '#EC4899',
  breakdance: '#06B6D4',
  classic: '#374151',
  modern: '#6B7280',
  caribbean: '#F59E0B',
  hiphop: '#EF4444',
  contemporary: '#10B981',
  jazz: '#3B82F6',
  pop: '#A855F7',
};

export default function CategoriesScreen() {
  const router = useRouter();
  const { setCategories } = useAuthStore();
  
  const [categories, setCategoriesState] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    loadCategories();
  }, []);
  
  const loadCategories = async () => {
    try {
      const response = await api.get('/dance-categories');
      setCategoriesState(response.data);
    } catch (error) {
      console.error('Failed to load categories', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId);
      }
      return [...prev, categoryId];
    });
  };
  
  const handleContinue = async () => {
    if (selectedCategories.length === 0) {
      Alert.alert('Select Categories', 'Please select at least one dance category');
      return;
    }
    
    setIsSaving(true);
    try {
      await setCategories(selectedCategories);
      router.replace('/(main)/home');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSkip = async () => {
    setIsSaving(true);
    try {
      await setCategories(['latin']);
      router.replace('/(main)/home');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsSaving(false);
    }
  };
  
  const renderCategory = ({ item }: { item: Category }) => {
    const isSelected = selectedCategories.includes(item.id);
    const bgColor = categoryColors[item.id] || Colors.surface;
    
    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: bgColor },
          isSelected && styles.cardSelected,
        ]}
        onPress={() => toggleCategory(item.id)}
        activeOpacity={0.8}
      >
        <Text style={styles.cardText}>{item.name.toUpperCase()}</Text>
      </TouchableOpacity>
    );
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.logoWhite}>BEAT </Text>
        <Text style={styles.logoRed}>MATES</Text>
      </View>
      
      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
      />
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={isSaving}
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.continueButton,
            selectedCategories.length === 0 && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={isSaving || selectedCategories.length === 0}
        >
          {isSaving ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
      
      <Text style={styles.footerText}>Choose the dance categories</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  logoWhite: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  logoRed: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  listContent: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    width: CARD_WIDTH,
    height: 90,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  cardSelected: {
    borderWidth: 3,
    borderColor: Colors.text,
  },
  cardText: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  skipButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingBottom: 16,
  },
});
