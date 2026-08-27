import React, { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { DarkTheme, ThemeProvider, Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

function InitialLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Redirect to login if user is not signed in
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // Redirect to main tabs if signed in
      router.replace('/(tabs)');
    }
    SplashScreen.hideAsync();
  }, [session, loading, segments]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#090D16' } }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={DarkTheme}>
        <InitialLayout />
      </ThemeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#090D16',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
