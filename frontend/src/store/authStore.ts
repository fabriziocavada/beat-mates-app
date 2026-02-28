import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  bio: string;
  profile_image: string | null;
  dance_categories: string[];
  is_available: boolean;
  hourly_rate: number;
  rating: number;
  followers_count: number;
  following_count: number;
  posts_count: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasSelectedCategories: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  setCategories: (categories: string[]) => Promise<void>;
  toggleAvailability: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  hasSelectedCategories: false,
  
  login: async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { access_token, user } = response.data;
      
      await AsyncStorage.setItem('token', access_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      set({
        token: access_token,
        user,
        isAuthenticated: true,
        hasSelectedCategories: user.dance_categories && user.dance_categories.length > 0,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  },
  
  register: async (email: string, username: string, name: string, password: string) => {
    try {
      const response = await api.post('/auth/register', { email, username, name, password });
      const { access_token, user } = response.data;
      
      await AsyncStorage.setItem('token', access_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      set({
        token: access_token,
        user,
        isAuthenticated: true,
        hasSelectedCategories: false,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Registration failed');
    }
  },
  
  logout: async () => {
    await AsyncStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      hasSelectedCategories: false,
    });
  },
  
  loadUser: async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        set({ isLoading: false });
        return;
      }
      
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await api.get('/users/me');
      const user = response.data;
      
      set({
        token,
        user,
        isAuthenticated: true,
        hasSelectedCategories: user.dance_categories && user.dance_categories.length > 0,
        isLoading: false,
      });
    } catch (error) {
      await AsyncStorage.removeItem('token');
      set({ isLoading: false });
    }
  },
  
  updateUser: async (data: Partial<User>) => {
    try {
      const response = await api.put('/users/me', data);
      set({ user: response.data });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Update failed');
    }
  },
  
  setCategories: async (categories: string[]) => {
    try {
      const response = await api.put('/users/me', { dance_categories: categories });
      set({
        user: response.data,
        hasSelectedCategories: categories.length > 0,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Failed to save categories');
    }
  },
  
  toggleAvailability: async () => {
    try {
      const response = await api.post('/users/me/toggle-availability');
      const newStatus = response.data.is_available;
      
      const currentUser = get().user;
      if (currentUser) {
        set({ user: { ...currentUser, is_available: newStatus } });
      }
      
      return newStatus;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Failed to toggle availability');
    }
  },
  
  refreshUser: async () => {
    try {
      const response = await api.get('/users/me');
      set({ user: response.data });
    } catch (error) {
      console.error('Failed to refresh user', error);
    }
  },
}));
