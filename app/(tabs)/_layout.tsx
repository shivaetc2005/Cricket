import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#0F172A',
          borderTopColor: '#1E293B',
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        headerStyle: {
          backgroundColor: '#0F172A',
        },
        headerTintColor: '#F8FAFC',
        headerTitleStyle: {
          fontWeight: '700',
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
