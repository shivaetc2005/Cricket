import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

interface MemberProfile {
  id: string;
  name: string;
  phone: string | null;
  skill_level: string | null;
  joined_at?: string;
}

interface TeamDetail {
  id: string;
  name: string;
  captain_id: string;
  status: 'active' | 'inactive';
  available_days: string[];
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [captainProfile, setCaptainProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Captain management state
  const [isEditingDays, setIsEditingDays] = useState(false);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Add Member modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemberProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  const isCaptain = user?.id === team?.captain_id;

  useEffect(() => {
    if (id) {
      fetchTeamDetails();
    }
  }, [id]);

  const fetchTeamDetails = async () => {
    setLoading(true);
    try {
      // 1. Fetch team row
      const { data: teamData, error: teamErr } = await supabase
        .from('teams')
        .select('*')
        .eq('id', id)
        .single();

      if (teamErr) throw teamErr;
      setTeam(teamData);
      setAvailableDays(teamData.available_days || []);

      // 2. Fetch captain profile
      if (teamData?.captain_id) {
        const { data: capData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', teamData.captain_id)
          .single();
        if (capData) setCaptainProfile(capData);
      }

      // 3. Fetch team members joined with profiles
      const { data: memberRows, error: memberErr } = await supabase
        .from('team_members')
        .select('user_id, joined_at, profiles (id, name, phone, skill_level)')
        .eq('team_id', id);

      if (memberErr) throw memberErr;

      if (memberRows) {
        const parsedMembers: MemberProfile[] = memberRows.map((m: any) => ({
          id: m.profiles?.id || m.user_id,
          name: m.profiles?.name || 'Player',
          phone: m.profiles?.phone || null,
          skill_level: m.profiles?.skill_level || 'Intermediate',
          joined_at: m.joined_at,
        }));
        setMembers(parsedMembers);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load team details.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!team || !isCaptain) return;
    const newStatus = team.status === 'active' ? 'inactive' : 'active';
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('teams')
        .update({ status: newStatus })
        .eq('id', team.id);

      if (error) throw error;
      setTeam({ ...team, status: newStatus });
      Alert.alert('Status Updated', `Team status set to ${newStatus.toUpperCase()}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveDays = async () => {
    if (!team || !isCaptain) return;
    try {
      const { error } = await supabase
        .from('teams')
        .update({ available_days: availableDays })
        .eq('id', team.id);

      if (error) throw error;
      setTeam({ ...team, available_days: availableDays });
      setIsEditingDays(false);
      Alert.alert('Success', 'Available match days updated!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`name.ilike.%${searchQuery.trim()}%,phone.ilike.%${searchQuery.trim()}%`)
        .limit(10);

      if (error) throw error;
      if (data) {
        // Filter out users already in team
        const existingIds = new Set(members.map((m) => m.id));
        setSearchResults(data.filter((u) => !existingIds.has(u.id)));
      }
    } catch (e: any) {
      Alert.alert('Search Error', e.message);
    } finally {
      setSearching(false);
    }
  };

  const handleAddMember = async (targetUser: MemberProfile) => {
    if (!team || !isCaptain) return;
    setAddingUserId(targetUser.id);
    try {
      const { error } = await supabase.from('team_members').insert({
        team_id: team.id,
        user_id: targetUser.id,
      });

      if (error) throw error;

      Alert.alert('Member Added', `${targetUser.name} joined ${team.name}`);
      setSearchResults(searchResults.filter((u) => u.id !== targetUser.id));
      fetchTeamDetails();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add member');
    } finally {
      setAddingUserId(null);
    }
  };

  const handleStartConversation = async () => {
    if (!team || !user?.id) return;
    try {
      // Check existing conversation
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('team_id', team.id)
        .eq('initiator_id', user.id)
        .maybeSingle();

      if (existing?.id) {
        router.push(`/conversation/${existing.id}` as any);
        return;
      }

      // Create conversation
      const { data: created, error } = await supabase
        .from('conversations')
        .insert({
          team_id: team.id,
          initiator_id: user.id,
        })
        .select('*')
        .single();

      if (error) throw error;
      if (created?.id) {
        router.push(`/conversation/${created.id}` as any);
      }
    } catch (e: any) {
      Alert.alert('Message Error', e.message || 'Could not open chat.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator style={{ marginTop: 40 }} color="#10B981" size="large" />
      </SafeAreaView>
    );
  }

  if (!team) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Team not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: team.name, headerStyle: { backgroundColor: '#0F172A' }, headerTintColor: '#F8FAFC' }} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Team Banner Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.shieldIcon}>
              <Text style={{ fontSize: 32 }}>🛡️</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.teamTitle}>{team.name}</Text>
              <Text style={styles.captainSub}>👑 Captain: {captainProfile?.name || 'Unknown'}</Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusBadge,
                team.status === 'active' ? styles.statusActive : styles.statusInactive,
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {team.status === 'active' ? '🟢 Active & Ready to Play' : '🔴 Inactive'}
              </Text>
            </View>

            {isCaptain && (
              <TouchableOpacity
                style={styles.toggleBtn}
                onPress={handleToggleStatus}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <ActivityIndicator size="small" color="#F8FAFC" />
                ) : (
                  <Text style={styles.toggleBtnText}>
                    Toggle {team.status === 'active' ? 'Inactive' : 'Active'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {!isCaptain && (
            <TouchableOpacity style={styles.messageBtn} onPress={handleStartConversation}>
              <Ionicons name="chatbubbles-outline" size={20} color="#0F172A" />
              <Text style={styles.messageBtnText}>Message Team Captain</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Available Days Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Available Match Days</Text>
            {isCaptain && (
              <TouchableOpacity onPress={() => setIsEditingDays(!isEditingDays)}>
                <Text style={styles.editLink}>{isEditingDays ? 'Cancel' : 'Edit Days'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditingDays ? (
            <View>
              <View style={styles.daysGrid}>
                {DAYS_OF_WEEK.map((day) => {
                  const active = availableDays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayChip, active && styles.dayChipActive]}
                      onPress={() => {
                        if (active) setAvailableDays(availableDays.filter((d) => d !== day));
                        else setAvailableDays([...availableDays, day]);
                      }}
                    >
                      <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={styles.saveDaysBtn} onPress={handleSaveDays}>
                <Text style={styles.saveDaysBtnText}>Save Available Days</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.daysRow}>
              {team.available_days && team.available_days.length > 0 ? (
                team.available_days.map((day) => (
                  <View key={day} style={styles.dayTag}>
                    <Text style={styles.dayTagText}>{day}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No available days specified</Text>
              )}
            </View>
          )}
        </View>

        {/* Team Members Roster */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Team Roster ({members.length})</Text>
            {isCaptain && (
              <TouchableOpacity
                style={styles.addMemberBtn}
                onPress={() => {
                  setAddModalVisible(true);
                  setSearchResults([]);
                  setSearchQuery('');
                }}
              >
                <Ionicons name="person-add-outline" size={16} color="#34D399" />
                <Text style={styles.addMemberBtnText}>Add Member</Text>
              </TouchableOpacity>
            )}
          </View>

          {members.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.avatarLetter}>{m.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberSkill}>⚡ {m.skill_level ? (m.skill_level.toLowerCase() === 'semi-pro' ? 'Semi-Pro' : m.skill_level.charAt(0).toUpperCase() + m.skill_level.slice(1).toLowerCase()) : 'Player'}</Text>
              </View>
              {m.id === team.captain_id && (
                <View style={styles.captainTag}>
                  <Text style={styles.captainTagText}>👑 Captain</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Add Member Modal */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Player to {team.name}</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Search by Name or Phone</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="e.g. Rahul or 555-0199"
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchUsers}
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleSearchUsers}>
                {searching ? (
                  <ActivityIndicator size="small" color="#0F172A" />
                ) : (
                  <Ionicons name="search" size={20} color="#0F172A" />
                )}
              </TouchableOpacity>
            </View>

            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 240, marginTop: 12 }}
              ListEmptyComponent={
                searchQuery ? (
                  <Text style={styles.emptyText}>No registered players found matching query.</Text>
                ) : null
              }
              renderItem={({ item }) => (
                <View style={styles.searchResultRow}>
                  <View>
                    <Text style={styles.resultName}>{item.name}</Text>
                    <Text style={styles.resultPhone}>{item.phone || 'No phone'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => handleAddMember(item)}
                    disabled={addingUserId === item.id}
                  >
                    {addingUserId === item.id ? (
                      <ActivityIndicator size="small" color="#0F172A" />
                    ) : (
                      <Text style={styles.addBtnText}>+ Add</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  container: {
    padding: 16,
  },
  notFound: {
    padding: 40,
    alignItems: 'center',
  },
  notFoundText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  headerCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shieldIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  captainSub: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#064E3B',
  },
  statusInactive: {
    backgroundColor: '#450A0A',
  },
  statusBadgeText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  toggleBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  toggleBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  messageBtn: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
    gap: 8,
  },
  messageBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 15,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  editLink: {
    color: '#34D399',
    fontWeight: '600',
    fontSize: 13,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 10,
  },
  dayChip: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dayChipActive: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  dayChipText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  dayChipTextActive: {
    color: '#34D399',
  },
  saveDaysBtn: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveDaysBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayTag: {
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dayTagText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    fontStyle: 'italic',
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addMemberBtnText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '600',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  avatarLetter: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  memberName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  memberSkill: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  captainTag: {
    backgroundColor: '#78350F',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  captainTagText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  inputLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  resultName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  resultPhone: {
    color: '#94A3B8',
    fontSize: 12,
  },
  addBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
});
