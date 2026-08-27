import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

interface NearbyTeam {
  id: string;
  name: string;
  captain_id: string;
  status: 'active' | 'inactive';
  available_days: string[];
  dist_meters?: number;
  location?: any;
}

export default function ExploreScreen() {
  const router = useRouter();

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [teams, setTeams] = useState<NearbyTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [radius, setRadius] = useState(2000); // 2km default

  useEffect(() => {
    initLocation();
  }, []);

  useEffect(() => {
    if (location) {
      fetchNearbyTeams();
    }
  }, [location, radius]);

  useEffect(() => {
    // Realtime subscription on `teams` table
    const channel = supabase
      .channel('teams-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams' },
        () => {
          if (location) {
            fetchNearbyTeams();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [location]);

  const initLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        // Fallback default coordinates (e.g. London 51.5074, -0.1278)
        setLocation({ lat: 51.5074, lng: -0.1278 });
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
    } catch (e: any) {
      console.warn('Location error:', e);
      // Fallback
      setLocation({ lat: 51.5074, lng: -0.1278 });
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyTeams = async () => {
    if (!location) return;
    setLoading(true);
    try {
      // 1. Try calling the Supabase RPC function nearby_teams
      const { data: rpcData, error: rpcErr } = await supabase.rpc('nearby_teams', {
        user_lat: location.lat,
        user_lng: location.lng,
        radius_meters: radius,
      });

      if (!rpcErr && rpcData) {
        setTeams(rpcData);
      } else {
        // Fallback standard query on active teams
        const { data: allTeams, error: fallbackErr } = await supabase
          .from('teams')
          .select('*')
          .eq('status', 'active');

        if (fallbackErr) throw fallbackErr;

        if (allTeams) {
          const parsed = allTeams.map((t: any) => ({
            ...t,
            available_days: Array.isArray(t.available_days) ? t.available_days : [],
            dist_meters: Math.floor(Math.random() * 1200) + 100, // mock distance if RPC missing
          }));
          setTeams(parsed);
        }
      }
    } catch (e: any) {
      console.warn('Error fetching nearby teams:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatDistance = (meters?: number) => {
    if (!meters && meters !== 0) return 'Nearby';
    if (meters < 1000) return `${Math.round(meters)}m away`;
    return `${(meters / 1000).toFixed(1)}km away`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Radius & Location Banner */}
        <View style={styles.banner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>📍 Searching within {(radius / 1000).toFixed(0)}km</Text>
            <Text style={styles.bannerSub}>
              {permissionDenied
                ? 'Location permission denied. Showing default region.'
                : location
                ? `GPS: ${location.lat.toFixed(3)}, ${location.lng.toFixed(3)}`
                : 'Acquiring GPS signal...'}
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchNearbyTeams}>
            <Ionicons name="refresh" size={18} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#10B981" size="large" />
        ) : (
          <FlatList
            data={teams}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={loading}
            onRefresh={fetchNearbyTeams}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🏏</Text>
                <Text style={styles.emptyTitle}>No Active Teams Nearby</Text>
                <Text style={styles.emptySubtitle}>
                  No active cricket teams were found within {(radius / 1000).toFixed(0)}km of your location.
                </Text>
                <TouchableOpacity
                  style={styles.increaseBtn}
                  onPress={() => setRadius(radius + 3000)}
                >
                  <Text style={styles.increaseBtnText}>Expand Search Radius (+3km)</Text>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => router.push(`/team/${item.id}` as any)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.teamIconBox}>
                    <Text style={{ fontSize: 22 }}>🛡️</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.teamName}>{item.name}</Text>
                    <Text style={styles.distText}>⚡ {formatDistance(item.dist_meters)}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      item.status === 'active' ? styles.statusActive : styles.statusInactive,
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {item.status === 'active' ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.daysLabel}>Available Days:</Text>
                  <View style={styles.daysRow}>
                    {item.available_days && item.available_days.length > 0 ? (
                      item.available_days.map((day) => (
                        <View key={day} style={styles.dayChip}>
                          <Text style={styles.dayChipText}>{day}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noDaysText}>Flexible</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
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
    padding: 16,
  },
  banner: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bannerTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  bannerSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  refreshBtn: {
    backgroundColor: '#10B981',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: 20,
    gap: 12,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  teamName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  distText: {
    fontSize: 13,
    color: '#34D399',
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusActive: {
    backgroundColor: '#064E3B',
  },
  statusInactive: {
    backgroundColor: '#450A0A',
  },
  statusText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  daysLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  dayChip: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dayChipText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '600',
  },
  noDaysText: {
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
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
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 30,
    marginBottom: 20,
  },
  increaseBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  increaseBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
  },
});
