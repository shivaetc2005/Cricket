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
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

interface MatchRequestItem {
  id: string;
  conversation_id: string;
  requesting_team_id: string;
  target_team_id: string;
  proposed_date: string;
  proposed_ground: string;
  status: 'pending' | 'confirmed' | 'declined';
  created_at?: string;
  requesting_team_name?: string;
  target_team_name?: string;
  is_target_captain?: boolean;
}

export default function MatchRequestsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<MatchRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchMatchRequests();
    }
  }, [user]);

  useEffect(() => {
    // Realtime subscription on match_requests table
    const channel = supabase
      .channel('match-requests-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_requests' },
        () => {
          if (user?.id) {
            fetchMatchRequests();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchMatchRequests = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // 1. Fetch user's teams to check captain status
      const { data: myTeamRows } = await supabase
        .from('team_members')
        .select('team_id, teams (id, captain_id, name)')
        .eq('user_id', user.id);

      const captainTeamIds = new Set<string>();
      const myTeamNamesMap = new Map<string, string>();

      if (myTeamRows) {
        myTeamRows.forEach((r: any) => {
          if (r.teams) {
            myTeamNamesMap.set(r.teams.id, r.teams.name);
            if (r.teams.captain_id === user.id) {
              captainTeamIds.add(r.teams.id);
            }
          }
        });
      }

      // 2. Query all match requests
      const { data: matchRows, error } = await supabase
        .from('match_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (matchRows) {
        // Collect team IDs to fetch missing team names
        const allTeamIds = new Set<string>();
        matchRows.forEach((m: any) => {
          if (m.requesting_team_id) allTeamIds.add(m.requesting_team_id);
          if (m.target_team_id) allTeamIds.add(m.target_team_id);
        });

        const { data: teamsData } = await supabase
          .from('teams')
          .select('id, name')
          .in('id', Array.from(allTeamIds));

        const teamNameLookup = new Map<string, string>();
        if (teamsData) {
          teamsData.forEach((t: any) => teamNameLookup.set(t.id, t.name));
        }

        const formatted: MatchRequestItem[] = matchRows.map((m: any) => {
          const reqName = teamNameLookup.get(m.requesting_team_id) || 'Challenger Team';
          const targetName = teamNameLookup.get(m.target_team_id) || 'Target Team';
          const isTargetCaptain = captainTeamIds.has(m.target_team_id);

          return {
            id: m.id,
            conversation_id: m.conversation_id,
            requesting_team_id: m.requesting_team_id,
            target_team_id: m.target_team_id,
            proposed_date: m.proposed_date,
            proposed_ground: m.proposed_ground,
            status: m.status || 'pending',
            created_at: m.created_at,
            requesting_team_name: reqName,
            target_team_name: targetName,
            is_target_captain: isTargetCaptain,
          };
        });

        setRequests(formatted);
      }
    } catch (e: any) {
      console.warn('Error fetching match requests:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (requestId: string, newStatus: 'confirmed' | 'declined') => {
    setUpdatingId(requestId);
    try {
      const { error } = await supabase
        .from('match_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;

      Alert.alert(
        newStatus === 'confirmed' ? 'Match Confirmed! 🏆' : 'Match Declined',
        `Match request status updated to ${newStatus.toUpperCase()}.`
      );

      fetchMatchRequests();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update status');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topHeader}>
          <Text style={styles.headerTitle}>Match Challenges</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchMatchRequests}>
            <Ionicons name="refresh" size={18} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#10B981" size="large" />
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={loading}
            onRefresh={fetchMatchRequests}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>⚡</Text>
                <Text style={styles.emptyTitle}>No Match Requests</Text>
                <Text style={styles.emptySubtitle}>
                  Match challenges sent or received will appear here. Start a conversation with a team to request a match!
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.teamsVersus}>
                    <Text style={styles.teamText}>{item.requesting_team_name}</Text>
                    <Text style={styles.vsBadge}> VS </Text>
                    <Text style={styles.teamText}>{item.target_team_name}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      item.status === 'confirmed'
                        ? styles.statusConfirmed
                        : item.status === 'declined'
                        ? styles.statusDeclined
                        : styles.statusPending,
                    ]}
                  >
                    <Text style={styles.statusPillText}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsBox}>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color="#34D399" />
                    <Text style={styles.detailText}>{item.proposed_date}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color="#34D399" />
                    <Text style={styles.detailText}>{item.proposed_ground}</Text>
                  </View>
                </View>

                {/* Actions if user is target team captain and status is pending */}
                {item.is_target_captain && item.status === 'pending' ? (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.confirmBtn, updatingId === item.id && styles.disabledBtn]}
                      onPress={() => handleUpdateStatus(item.id, 'confirmed')}
                      disabled={updatingId === item.id}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color="#0F172A" />
                      <Text style={styles.confirmBtnText}>Confirm Match</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.declineBtn, updatingId === item.id && styles.disabledBtn]}
                      onPress={() => handleUpdateStatus(item.id, 'declined')}
                      disabled={updatingId === item.id}
                    >
                      <Ionicons name="close-circle-outline" size={18} color="#F8FAFC" />
                      <Text style={styles.declineBtnText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                ) : item.conversation_id ? (
                  <TouchableOpacity
                    style={styles.chatLinkBtn}
                    onPress={() => router.push(`/conversation/${item.conversation_id}` as any)}
                  >
                    <Ionicons name="chatbubbles-outline" size={16} color="#34D399" />
                    <Text style={styles.chatLinkText}>Open Match Chat</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
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
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamsVersus: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  teamText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  vsBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FBBF24',
    marginHorizontal: 6,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusPending: {
    backgroundColor: '#78350F',
  },
  statusConfirmed: {
    backgroundColor: '#064E3B',
  },
  statusDeclined: {
    backgroundColor: '#450A0A',
  },
  statusPillText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  detailsBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  confirmBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
  },
  declineBtn: {
    flex: 1,
    backgroundColor: '#450A0A',
    borderWidth: 1,
    borderColor: '#991B1B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  declineBtnText: {
    color: '#FCA5A5',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  chatLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 10,
    gap: 6,
  },
  chatLinkText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '600',
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
  },
});
