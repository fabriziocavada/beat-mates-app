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
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const CARD_HEIGHT = 120;

interface Category {
  id: string;
  name: string;
  image_url: string;
}

// Real dance images from Unsplash - high quality
const categoryImages: Record<string, string> = {
  latin: 'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=400&h=300&fit=crop&q=80',
  ballroom: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=400&h=300&fit=crop&q=80',
  breakdance: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=300&fit=crop&q=80',
  classic: 'https://images.unsplash.com/photo-1518834107812-67b0b7c58434?w=400&h=300&fit=crop&q=80',
  modern: 'https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=400&h=300&fit=crop&q=80',
  caribbean: 'https://images.unsplash.com/photo-1545959570-a94084071b5d?w=400&h=300&fit=crop&q=80',
  hiphop: 'https://images.unsplash.com/photo-1535525153412-5a42439a210d?w=400&h=300&fit=crop&q=80',
  contemporary: 'https://images.unsplash.com/photo-1509670572403-1f85de089a5d?w=400&h=300&fit=crop&q=80',
  jazz: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop&q=80',
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
        <ActivityIndicator size="large" color="#FF6978" />
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
      
      {/* Categories Grid */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {categories.slice(0, 6).map((category) => {
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
                  <View style={styles.cardOverlay}>
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
      
      <Text style={styles.footerText}>Choose the dance categories</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  beatText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  matesText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF6978',
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
    backgroundColor: '#1C1C1E',
  },
  cardSelected: {
    borderWidth: 3,
    borderColor: '#FF6978',
  },
  cardImage: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  cardImageStyle: {
    borderRadius: 13,
  },
  cardOverlay: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cardText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
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
    borderColor: '#FF6978',
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    color: '#8E8E93',
    textAlign: 'center',
    paddingBottom: 20,
    fontSize: 14,
  },
});
