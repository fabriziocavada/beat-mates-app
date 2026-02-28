import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import Colors from '../../src/constants/colors';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const CARD_HEIGHT = 130;

interface Category {
  id: string;
  name: string;
  image_url: string;
}

// High-quality dance images
const categoryImages: Record<string, string> = {
  latin: 'https://images.unsplash.com/photo-1568557412756-7d219873dd11?w=400&h=300&fit=crop&q=80',
  ballroom: 'https://images.unsplash.com/photo-1594567573269-49ee664c6c80?w=400&h=300&fit=crop&q=80',
  breakdance: 'https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=400&h=300&fit=crop&q=80',
  classic: 'https://images.unsplash.com/photo-1508807526345-15e9b5f4eaff?w=400&h=300&fit=crop&q=80',
  modern: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=300&fit=crop&q=80',
  caribbean: 'https://images.unsplash.com/photo-1587827646762-c2e320829539?w=400&h=300&fit=crop&q=80',
  hiphop: 'https://images.unsplash.com/photo-1609602886239-a55db9685b7c?w=400&h=300&fit=crop&q=80',
  contemporary: 'https://images.unsplash.com/photo-1529229504105-4ea795dcbf59?w=400&h=300&fit=crop&q=80',
  jazz: 'https://images.unsplash.com/photo-1550026593-f369f98df0af?w=400&h=300&fit=crop&q=80',
  pop: 'https://images.unsplash.com/photo-1524594152303-9fd13543fe6e?w=400&h=300&fit=crop&q=80',
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
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.beatText}>BEAT </Text>
        <Text style={styles.matesText}>MATES</Text>
      </View>
      
      <Text style={styles.subtitle}>Choose the dance categories</Text>
      
      {/* Categories Grid - ALL categories */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {categories.map((category) => {
            const isSelected = selectedCategories.includes(category.id);
            const imageUrl = categoryImages[category.id] || categoryImages.latin;
            
            return (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.card,
                  isSelected && styles.cardSelected,
                ]}
                onPress={() => toggleCategory(category.id)}
                activeOpacity={0.8}
              >
                <ImageBackground
                  source={{ uri: imageUrl }}
                  style={styles.cardImage}
                  imageStyle={styles.cardImageStyle}
                  resizeMode="cover"
                >
                  <View style={[
                    styles.cardOverlay,
                    isSelected && styles.cardOverlaySelected,
                  ]}>
                    {isSelected && (
                      <View style={styles.checkIcon}>
                        <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                      </View>
                    )}
                    <Text style={styles.cardText}>
                      {category.name.toUpperCase()}
                    </Text>
                  </View>
                </ImageBackground>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      
      {/* Selected count */}
      {selectedCategories.length > 0 && (
        <Text style={styles.selectedCount}>
          {selectedCategories.length} selected
        </Text>
      )}
      
      {/* Footer */}
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
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
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
    paddingTop: 16,
    paddingBottom: 8,
  },
  beatText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  matesText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  subtitle: {
    color: Colors.textSecondary,
    textAlign: 'center',
    fontSize: 15,
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  cardSelected: {
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  cardImage: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  cardImageStyle: {
    borderRadius: 13,
  },
  cardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 13,
  },
  cardOverlaySelected: {
    backgroundColor: 'rgba(255,105,120,0.3)',
  },
  checkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  cardText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  selectedCount: {
    color: Colors.primary,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 4,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    paddingBottom: 24,
  },
  skipButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
    borderRadius: 10,
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
    backgroundColor: Colors.primary,
    borderRadius: 10,
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
});
