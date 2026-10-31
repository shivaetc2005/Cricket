import { Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ClassicTheme } from '../theme/classicTheme';
import { Colors } from '../theme/colors';

SplashScreen.preventAutoHideAsync();

function InitialLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
    SplashScreen.hideAsync();
  }, [session, loading, segments]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      <Stack.Screen
        name="team/[id]"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.navy },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700', color: '#FFFFFF' },
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="conversation/[id]"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.navy },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700', color: '#FFFFFF' },
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={ClassicTheme}>
        <StatusBar style="dark" />
        <InitialLayout />
      </ThemeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});