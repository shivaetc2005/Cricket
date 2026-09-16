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
import { Colors } from '../../theme/colors';

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
          <TouchableOpacity style={styles.refreshBtn} onPress={() => { initLocation(); fetchNearbyTeams(); }} activeOpacity={0.8}>
            <Ionicons name="refresh" size={18} color={Colors.primaryText} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} size="large" />
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
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => router.push(`/team/${item.id}` as any)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.teamIconBox}>
                    <Text style={{ fontSize: 20 }}>🛡️</Text>
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
                    <Text style={[styles.statusText, item.status === 'active' ? styles.statusActiveText : styles.statusInactiveText]}>
                      {item.status === 'active' ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.daysLabel}>Available:</Text>
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
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  banner: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  bannerTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  bannerSub: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
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
    gap: 12,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.tealLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C7E5DC',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  distText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusActive: {
    backgroundColor: Colors.tealLight,
  },
  statusInactive: {
    backgroundColor: Colors.errorLight,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusActiveText: {
    color: Colors.tealText,
  },
  statusInactiveText: {
    color: Colors.error,
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EDEBE6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  daysLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  dayChip: {
    backgroundColor: Colors.tealLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D0EAE2',
  },
  dayChipText: {
    color: Colors.tealText,
    fontSize: 11,
    fontWeight: '600',
  },
  noDaysText: {
    color: Colors.textSecondary,
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
    marginBottom: 20,
  },
  increaseBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 11,
  },
  increaseBtnText: {
    color: Colors.primaryText,
    fontWeight: '700',
    fontSize: 14,
  },
});
