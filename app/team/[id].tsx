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
import { Colors } from '../../theme/colors';

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
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} size="large" />
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
      <Stack.Screen
        options={{
          title: team.name,
          headerStyle: { backgroundColor: Colors.navy },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Team Banner Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.shieldIcon}>
              <Text style={{ fontSize: 28 }}>🛡️</Text>
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
              <Text style={[styles.statusBadgeText, team.status === 'active' ? styles.statusActiveText : styles.statusInactiveText]}>
                {team.status === 'active' ? '● Active & Ready to Play' : '● Inactive'}
              </Text>
            </View>

            {isCaptain && (
              <TouchableOpacity
                style={styles.toggleBtn}
                onPress={handleToggleStatus}
                disabled={updatingStatus}
                activeOpacity={0.8}
              >
                {updatingStatus ? (
                  <ActivityIndicator size="small" color={Colors.text} />
                ) : (
                  <Text style={styles.toggleBtnText}>
                    Make {team.status === 'active' ? 'Inactive' : 'Active'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {!isCaptain && (
            <TouchableOpacity style={styles.messageBtn} onPress={handleStartConversation} activeOpacity={0.85}>
              <Ionicons name="chatbubbles-outline" size={18} color={Colors.primaryText} />
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
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Search by Name or Phone</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="e.g. Rahul or 555-0199"
                placeholderTextColor={Colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchUsers}
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleSearchUsers} activeOpacity={0.8}>
                {searching ? (
                  <ActivityIndicator size="small" color={Colors.primaryText} />
                ) : (
                  <Ionicons name="search" size={18} color={Colors.primaryText} />
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
                    activeOpacity={0.8}
                  >
                    {addingUserId === item.id ? (
                      <ActivityIndicator size="small" color={Colors.primaryText} />
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
    backgroundColor: Colors.background,
  },
  container: {
    padding: 16,
  },
  notFound: {
    padding: 40,
    alignItems: 'center',
  },
  notFoundText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  headerCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shieldIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.tealLight,
    borderWidth: 1.5,
    borderColor: '#C7E5DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  captainSub: {
    color: Colors.amber,
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
    borderTopColor: '#EDEBE6',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusActive: {
    backgroundColor: Colors.tealLight,
  },
  statusInactive: {
    backgroundColor: Colors.errorLight,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusActiveText: {
    color: Colors.tealText,
  },
  statusInactiveText: {
    color: Colors.error,
  },
  toggleBtn: {
    backgroundColor: Colors.secondary,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  toggleBtnText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  messageBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingVertical: 14,
    marginTop: 16,
    gap: 8,
  },
  messageBtnText: {
    color: Colors.primaryText,
    fontWeight: '700',
    fontSize: 15,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
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
    color: Colors.text,
  },
  editLink: {
    color: Colors.primary,
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dayChipActive: {
    backgroundColor: Colors.tealLight,
    borderColor: Colors.primary,
  },
  dayChipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  dayChipTextActive: {
    color: Colors.tealText,
  },
  saveDaysBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveDaysBtnText: {
    color: Colors.primaryText,
    fontWeight: '700',
    fontSize: 14,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayTag: {
    backgroundColor: Colors.tealLight,
    borderWidth: 1,
    borderColor: '#C7E5DC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dayTagText: {
    color: Colors.tealText,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addMemberBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDEBE6',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.tealLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C7E5DC',
  },
  avatarLetter: {
    color: Colors.tealText,
    fontSize: 15,
    fontWeight: '700',
  },
  memberName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  memberSkill: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  captainTag: {
    backgroundColor: Colors.amberLight,
    borderWidth: 1,
    borderColor: '#F3DFC1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  captainTagText: {
    color: Colors.amber,
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 34, 53, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.text,
  },
  inputLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: Colors.primary,
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
    borderBottomColor: '#EDEBE6',
  },
  resultName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  resultPhone: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: {
    color: Colors.primaryText,
    fontSize: 13,
    fontWeight: '700',
  },
});
