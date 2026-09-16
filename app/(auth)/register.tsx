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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!email.trim() || !password) {
      setErrorMsg('Please provide an email and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    const { error, user, session } = await signUp(name.trim(), email.trim(), password, phone.trim());
    setLoading(false);

    if (error) {
      setErrorMsg(error.message || 'Registration failed. Please try again.');
    } else if (user && !session) {
      setSuccessMsg('Account created successfully! 📧 Please check your email inbox to confirm your email before signing in.');
    } else if (user && session) {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.headerSection}>
            <Text style={styles.title}>Join Cricket Hub</Text>
            <Text style={styles.subtitle}>Register your player profile to join or create teams</Text>
          </View>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color={Colors.error} style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.teal} style={{ marginRight: 8 }} />
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Virat Kohli"
              placeholderTextColor={Colors.textSecondary}
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (errorMsg) setErrorMsg(null);
              }}
            />

            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="captain@cricket.com"
              placeholderTextColor={Colors.textSecondary}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (errorMsg) setErrorMsg(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Password *</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="At least 6 characters"
                placeholderTextColor={Colors.textSecondary}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (errorMsg) setErrorMsg(null);
                }}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Phone Number (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="+91 98765 43210"
              placeholderTextColor={Colors.textSecondary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={Colors.primaryText} />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>Sign In</Text>
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
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
  },
  passwordContainer: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: '#E8A5A5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  successBox: {
    backgroundColor: Colors.tealLight,
    borderWidth: 1,
    borderColor: '#C7E5DC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  successText: {
    color: Colors.tealText,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    flex: 1,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 11,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: Colors.primaryText,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  linkText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
