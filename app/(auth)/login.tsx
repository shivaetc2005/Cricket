import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      setErrorMsg(error.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.logoSection}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>🏏 CRICKET MATCHMAKER</Text>
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to find teams & organize local matches</Text>
          </View>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="captain@cricket.com"
              placeholderTextColor="#64748B"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#64748B"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>Create Account</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  badge: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#10B981',
    marginBottom: 16,
  },
  badgeText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F8FAFC',
    fontSize: 15,
  },
  errorBox: {
    backgroundColor: '#450A0A',
    borderWidth: 1,
    borderColor: '#991B1B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  linkText: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '700',
  },
});
