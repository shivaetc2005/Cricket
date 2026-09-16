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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';

export default function LoginScreen() {
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Forgot password modal state
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

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
      setErrorMsg(error.message || 'Incorrect email or password. Please check your credentials.');
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your registered email address.');
      return;
    }
    setForgotError(null);
    setForgotSuccess(null);
    setForgotLoading(true);

    const { error } = await resetPassword(forgotEmail.trim());
    setForgotLoading(false);

    if (error) {
      setForgotError(error.message || 'Unable to send reset email. Please try again.');
    } else {
      setForgotSuccess(
        `A password reset link has been sent to ${forgotEmail.trim()}. Please check your email inbox.`
      );
    }
  };

  const closeForgotModal = () => {
    setForgotModalVisible(false);
    setForgotEmail('');
    setForgotError(null);
    setForgotSuccess(null);
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
              <Ionicons name="alert-circle" size={20} color={Colors.error} style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, errorMsg ? styles.inputError : null]}
              placeholder="captain@cricket.com"
              placeholderTextColor={Colors.textSecondary}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorMsg) setErrorMsg(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.passwordHeaderRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity
                onPress={() => {
                  setForgotEmail(email);
                  setForgotModalVisible(true);
                }}
              >
                <Text style={styles.forgotLink}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.passwordContainer, errorMsg ? styles.inputError : null]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor={Colors.textSecondary}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
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

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={Colors.primaryText} />
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

      {/* Forgot Password Modal */}
      <Modal
        visible={forgotModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeForgotModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconBg}>
                <Ionicons name="key-outline" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <Text style={styles.modalSubtitle}>
                Enter your registered email address and we'll send you a password reset link.
              </Text>
            </View>

            {forgotError ? (
              <View style={styles.modalErrorBox}>
                <Ionicons name="alert-circle" size={18} color={Colors.error} style={{ marginRight: 6 }} />
                <Text style={styles.modalErrorText}>{forgotError}</Text>
              </View>
            ) : null}

            {forgotSuccess ? (
              <View style={styles.modalSuccessBox}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.teal} style={{ marginRight: 8 }} />
                <Text style={styles.modalSuccessText}>{forgotSuccess}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.label}>Registered Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="your.email@domain.com"
                  placeholderTextColor={Colors.textSecondary}
                  value={forgotEmail}
                  onChangeText={(text) => {
                    setForgotEmail(text);
                    if (forgotError) setForgotError(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={[styles.primaryButton, forgotLoading && styles.buttonDisabled, { marginTop: 20 }]}
                  onPress={handleForgotPassword}
                  disabled={forgotLoading}
                  activeOpacity={0.85}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color={Colors.primaryText} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.modalCloseButton} onPress={closeForgotModal}>
              <Text style={styles.modalCloseText}>
                {forgotSuccess ? 'Done' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  logoSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  badge: {
    backgroundColor: Colors.tealLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C7E5DC',
    marginBottom: 14,
  },
  badgeText: {
    color: Colors.tealText,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
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
    marginBottom: 8,
  },
  passwordHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  forgotLink: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
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
    paddingVertical: 13,
    color: Colors.text,
    fontSize: 15,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorBox: {
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: '#E8A5A5',
    borderRadius: 12,
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
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 11,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 34, 53, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.tealLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C7E5DC',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalErrorBox: {
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: '#E8A5A5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalErrorText: {
    color: Colors.error,
    fontSize: 13,
    flex: 1,
  },
  modalSuccessBox: {
    backgroundColor: Colors.tealLight,
    borderWidth: 1,
    borderColor: '#C7E5DC',
    borderRadius: 10,
    padding: 14,
    marginVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalSuccessText: {
    color: Colors.tealText,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  modalCloseButton: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});

