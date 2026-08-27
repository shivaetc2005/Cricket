import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0F172A',
        },
        headerTintColor: '#F8FAFC',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        contentStyle: {
          backgroundColor: '#090D16',
        },
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Sign In', headerShown: false }} />
      <Stack.Screen name="register" options={{ title: 'Create Account', headerShown: false }} />
    </Stack>
  );
}
