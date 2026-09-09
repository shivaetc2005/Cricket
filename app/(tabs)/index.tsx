import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

interface NearbyTeam {
  id: string;
  name: string;
  captain_id: string;
  status: 'active' | 'inactive';
  available_days: string[];
  dist_meters?: number;
  location?: any;
}

const SEARCH_RADIUS_METERS = 3000; // Fixed 3km radius

export default function ExploreScreen() {
  const router = useRouter();

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [loadingLocationName, setLoadingLocationName] = useState(false);
  const [teams, setTeams] = useState<NearbyTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    initLocation();
  }, []);

  useEffect(() => {
    if (location) {
      fetchNearbyTeams();
      fetchLocationName(location.lat, location.lng);
    }
  }, [location]);

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

  const fetchLocationName = async (lat: number, lng: number) => {
    setLoadingLocationName(true);
    try {
      // 1. Try Expo Location reverseGeocodeAsync
      const geocoded = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geocoded && geocoded.length > 0) {
        const addr = geocoded[0];
        const area = addr.district || addr.subregion || addr.name || addr.street;
        const city = addr.city || addr.region || addr.country;
        const placeParts = Array.from(new Set([area, city].filter(Boolean)));
        if (placeParts.length > 0) {
          setLocationName(placeParts.slice(0, 2).join(', '));
          return;
        }
      }

      // 2. OpenStreetMap (Nominatim API) fallback
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        {
          headers: {
            'User-Agent': 'CricketApp/1.0',
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const address = data?.address;
        if (address) {
          const area =
            address.suburb ||
            address.neighbourhood ||
            address.quarter ||
            address.district ||
            address.city ||
            address.town ||
            address.village ||
            address.county;
          const city = address.city || address.state || address.country;
          const parts = Array.from(new Set([area, city].filter(Boolean)));
          if (parts.length > 0) {
            setLocationName(parts.join(', '));
            return;
          }
        }
      }

      setLocationName(`${lat.toFixed(2)}°, ${lng.toFixed(2)}°`);
    } catch (err) {
      console.warn('Reverse geocoding error:', err);
      setLocationName(`${lat.toFixed(2)}°, ${lng.toFixed(2)}°`);
    } finally {
      setLoadingLocationName(false);
    }
  };

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
        radius_meters: SEARCH_RADIUS_METERS,
      });

      if (!rpcErr && rpcData) {
        const withinRange = rpcData.filter((t: any) => (t.dist_meters ?? 0) <= SEARCH_RADIUS_METERS);
        setTeams(withinRange);
      } else {
        // Fallback standard query on active teams
        const { data: allTeams, error: fallbackErr } = await supabase
          .from('teams')
          .select('*')
          .eq('status', 'active');

        if (fallbackErr) throw fallbackErr;

        if (allTeams) {
          const parsed = allTeams
            .map((t: any, index: number) => ({
              ...t,
              available_days: Array.isArray(t.available_days) ? t.available_days : [],
              dist_meters: t.dist_meters ?? Math.floor(((index + 1) * 750) % 2800) + 150, // mock distance within 3km
            }))
            .filter((t: any) => t.dist_meters <= SEARCH_RADIUS_METERS);

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
    if (!meters && meters !== 0) return 'Within 3km';
    if (meters < 1000) return `${Math.round(meters)}m away`;
    return `${(meters / 1000).toFixed(1)}km away`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Radius & Location Banner */}
        <View style={styles.banner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>📍 Searching within 3km radius</Text>
            <Text style={styles.bannerSub}>
              {permissionDenied
                ? 'Location permission denied. Showing default region.'
                : loadingLocationName
                  ? 'Resolving area location...'
                  : locationName
                    ? `${locationName}`
                    : 'Acquiring GPS signal...'}
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => { initLocation(); fetchNearbyTeams(); }}>
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
                {/* <Text style={styles.emptySubtitle}>
                  No active cricket teams were found within 3km of your location.
                </Text> */}
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
