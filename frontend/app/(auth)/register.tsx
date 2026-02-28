import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../src/constants/colors';
import { useAuthStore } from '../../src/store/authStore';

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleRegister = async () => {
    if (!email || !username || !name || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    
    setIsLoading(true);
    try {
      await register(email, username, name, password);
      // Navigate directly to categories after successful registration
      setTimeout(() => {
        router.replace('/(auth)/categories');
      }, 100);
    } catch (error: any) {
      Alert.alert('Error', error.message);
      setIsLoading(false);
    }
  };
  
  const isValid = email && username && name && password.length >= 6;
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={28} color={Colors.text} />
          </TouchableOpacity>
          
          <View style={styles.headerContainer}>
            <Text style={styles.logoWhite}>BEAT </Text>
            <Text style={styles.logoRed}>MATES</Text>
          </View>
          
          <Text style={styles.subtitle}>Create your account</Text>
          
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={Colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={Colors.textSecondary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={Colors.textSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={Colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.registerButton, !isValid && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={isLoading || !isValid}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <Text style={styles.registerButtonText}>Sign up</Text>
              )}
            </TouchableOpacity>
            
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.loginLink}>Log in.</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  logoWhite: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
  },
  logoRed: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    padding: 16,
  },
  eyeButton: {
    padding: 16,
  },
  registerButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  registerButtonDisabled: {
    backgroundColor: Colors.primaryDark,
    opacity: 0.5,
  },
  registerButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  loginLink: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
