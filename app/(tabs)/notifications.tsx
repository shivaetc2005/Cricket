import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';

interface NotificationItem {
  id: string;
  user_id: string;
  type: 'message' | 'match_request' | 'match_confirmed' | 'match_declined' | string;
  payload: any;
  read: boolean;
  created_at?: string;
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      registerPushToken();
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;

    // Realtime subscription for new notifications
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const registerPushToken = async () => {
    try {
      // Android remote push notifications were removed from Expo Go in SDK 53
      const isExpoGo =
        Constants.appOwnership === 'expo' ||
        Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

      if (isExpoGo) {
        console.log('Push notifications are not supported in Expo Go (SDK 53+). Skipping registration.');
        return;
      }

      const Notifications = require('expo-notifications');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus === 'granted') {
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        console.log('Expo Push Token registered:', token);
      }
    } catch (e) {
      console.warn('Push notification setup notice:', e);
    }
  };

  const fetchNotifications = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setNotifications(data);
      }
    } catch (e: any) {
      console.warn('Error fetching notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNotification = async (item: NotificationItem) => {
    // 1. Mark as read in Supabase
    if (!item.read) {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', item.id);

        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        );
      } catch (e) {
        console.warn('Could not mark notification read:', e);
      }
    }

    // 2. Navigate based on type
    const payload = item.payload || {};
    if (payload.conversation_id) {
      router.push(`/conversation/${payload.conversation_id}` as any);
    } else if (item.type.includes('match')) {
      router.push('/(tabs)/match-requests');
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'message':
        return { name: 'chatbubble-ellipses-outline', color: Colors.primary, bg: Colors.tealLight };
      case 'match_request':
        return { name: 'trophy-outline', color: Colors.amber, bg: Colors.amberLight };
      case 'match_confirmed':
        return { name: 'checkmark-circle-outline', color: Colors.primary, bg: Colors.tealLight };
      case 'match_declined':
        return { name: 'close-circle-outline', color: Colors.error, bg: Colors.errorLight };
      default:
        return { name: 'notifications-outline', color: Colors.primary, bg: Colors.tealLight };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topHeader}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchNotifications} activeOpacity={0.8}>
            <Ionicons name="refresh" size={18} color={Colors.primaryText} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#10B981" size="large" />
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={loading}
            onRefresh={fetchNotifications}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🔔</Text>
                <Text style={styles.emptyTitle}>No Notifications</Text>
                <Text style={styles.emptySubtitle}>
                  You're all caught up! Match challenges, messages, and match updates will alert you here.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const iconInfo = getIconForType(item.type);
              const payload = item.payload || {};
              const title =
                payload.title ||
                (item.type === 'message'
                  ? 'New Message'
                  : item.type === 'match_request'
                  ? 'New Match Challenge'
                  : item.type === 'match_confirmed'
                  ? 'Match Confirmed! 🏆'
                  : item.type === 'match_declined'
                  ? 'Match Declined'
                  : 'Notification');

              const body = payload.body || payload.message || 'Tap to view details.';

              return (
                <TouchableOpacity
                  style={[styles.card, !item.read && styles.unreadCard]}
                  onPress={() => handleOpenNotification(item)}
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: iconInfo.bg, borderColor: iconInfo.color },
                    ]}
                  >
                    <Ionicons name={iconInfo.name as any} size={20} color={iconInfo.color} />
                  </View>

                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.notifTitle}>{title}</Text>
                      {!item.read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notifBody}>{body}</Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
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
    padding: 16,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  refreshBtn: {
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  unreadCard: {
    borderColor: Colors.primary,
    backgroundColor: '#FAFDFB',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: 6,
  },
  notifBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});
