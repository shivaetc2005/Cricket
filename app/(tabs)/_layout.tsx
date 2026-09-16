import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: '#8A98A8',
        tabBarStyle: {
          backgroundColor: Colors.navy,
          borderTopColor: '#24344D',
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        headerStyle: {
          backgroundColor: Colors.navy,
          shadowOpacity: 0,
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#24344D',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 17,
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explore',
          headerTitle: '🏏 Nearby Teams (3km)',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="location-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-teams"
        options={{
          title: 'My Teams',
          headerTitle: '🛡️ My Teams',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="match-requests"
        options={{
          title: 'Matches',
          headerTitle: '⚡ Match Requests',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          headerTitle: '🔔 Notifications',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: '👤 Player Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size || 22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
