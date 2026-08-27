import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

interface TeamItem {
  id: string;
  name: string;
  captain_id: string;
  status: 'active' | 'inactive';
  available_days: string[];
  role: 'Captain' | 'Member';
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function MyTeamsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Team Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Sat', 'Sun']);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchMyTeams();
  }, [user]);

  const fetchMyTeams = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: memberRows, error } = await supabase
        .from('team_members')
        .select('team_id, teams (id, name, captain_id, status, available_days)')
        .eq('user_id', user.id);

      if (error) throw error;

      if (memberRows) {
        const formatted: TeamItem[] = memberRows
          .filter((item: any) => item.teams)
          .map((item: any) => {
            const t = item.teams;
            return {
              id: t.id,
              name: t.name,
              captain_id: t.captain_id,
              status: t.status || 'active',
              available_days: Array.isArray(t.available_days) ? t.available_days : [],
              role: t.captain_id === user.id ? 'Captain' : 'Member',
            };
          });
        setTeams(formatted);
      }
    } catch (e: any) {
      console.warn('Error fetching my teams:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleGetCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied');
        setLocating(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
      Alert.alert('Location Set', `Coordinates acquired: ${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
    } catch (e: any) {
      Alert.alert('Error', 'Could not obtain location: ' + e.message);
    } finally {
      setLocating(false);
    }
  };

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      Alert.alert('Validation Error', 'Please enter a team name.');
      return;
    }
    if (!user?.id) return;

    setCreating(true);
    try {
      // Default location if location permission wasn't triggered (e.g. London 51.5074, -0.1278)
      const lat = userLocation?.lat || 51.5074;
      const lng = userLocation?.lng || -0.1278;
      const pointEWKT = `POINT(${lng} ${lat})`;

      // 1. Insert team
      const { data: newTeam, error: teamErr } = await supabase
        .from('teams')
        .insert({
          name: teamName.trim(),
          captain_id: user.id,
          location: pointEWKT,
          status: 'active',
          available_days: selectedDays,
        })
        .select('*')
        .single();

      if (teamErr) throw teamErr;

      // 2. Insert into team_members as captain
      if (newTeam) {
        const { error: memberErr } = await supabase
          .from('team_members')
          .insert({
            team_id: newTeam.id,
            user_id: user.id,
          });

        if (memberErr) console.warn('Member insert note:', memberErr);
      }

      Alert.alert('Success 🎉', `Team "${teamName}" created!`);
      setModalVisible(false);
      setTeamName('');
      setSelectedDays(['Sat', 'Sun']);
      fetchMyTeams();
    } catch (e: any) {
      Alert.alert('Create Team Error', e.message || 'Failed to create team.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topHeader}>
          <Text style={styles.headerTitle}>My Teams</Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => setModalVisible(true)}>
            <Ionicons name="add" size={18} color="#0F172A" />
            <Text style={styles.createBtnText}>Create Team</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#10B981" size="large" />
        ) : (
          <FlatList
            data={teams}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            refreshing={loading}
            onRefresh={fetchMyTeams}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🏏</Text>
                <Text style={styles.emptyTitle}>No Teams Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Create your own team as a Captain or get added to an existing team.
                </Text>
                <TouchableOpacity style={styles.emptyCreateBtn} onPress={() => setModalVisible(true)}>
                  <Text style={styles.emptyCreateBtnText}>Create Your Team Now</Text>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.teamCard}
                activeOpacity={0.8}
                onPress={() => router.push(`/team/${item.id}` as any)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.teamIconBox}>
                    <Text style={styles.teamIconText}>🛡️</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.teamNameText}>{item.name}</Text>
                    <View style={styles.daysRow}>
                      {item.available_days.map((day) => (
                        <View key={day} style={styles.dayTag}>
                          <Text style={styles.dayTagText}>{day}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#64748B" />
                </View>

                <View style={styles.cardFooter}>
                  <View
                    style={[
                      styles.statusPill,
                      item.status === 'active' ? styles.statusActive : styles.statusInactive,
                    ]}
                  >
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: item.status === 'active' ? '#10B981' : '#64748B' },
                      ]}
                    />
                    <Text style={styles.statusText}>
                      {item.status === 'active' ? 'Active' : 'Inactive'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.roleBadge,
                      item.role === 'Captain' ? styles.captainBadge : styles.memberBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        item.role === 'Captain' ? styles.captainText : styles.memberText,
                      ]}
                    >
                      {item.role === 'Captain' ? '👑 Captain' : '👤 Member'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        {/* Create Team Modal */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create New Team</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Team Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Thunder XI"
                placeholderTextColor="#64748B"
                value={teamName}
                onChangeText={setTeamName}
              />

              <Text style={styles.inputLabel}>Home Location</Text>
              <TouchableOpacity
                style={styles.locButton}
                onPress={handleGetCurrentLocation}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator size="small" color="#34D399" />
                ) : (
                  <>
                    <Ionicons name="navigate-outline" size={18} color="#34D399" />
                    <Text style={styles.locButtonText}>
                      {userLocation
                        ? `Lat: ${userLocation.lat.toFixed(3)}, Lng: ${userLocation.lng.toFixed(3)}`
                        : 'Use My Current GPS Location'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Available Match Days</Text>
              <View style={styles.daysPickerRow}>
                {DAYS_OF_WEEK.map((day) => {
                  const isSelected = selectedDays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayPickBtn, isSelected && styles.dayPickBtnActive]}
                      onPress={() => toggleDay(day)}
                    >
                      <Text style={[styles.dayPickText, isSelected && styles.dayPickTextActive]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, creating && styles.btnDisabled]}
                onPress={handleCreateTeam}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#0F172A" />
                ) : (
                  <Text style={styles.submitBtnText}>Create Team</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  createBtn: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  createBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 13,
  },
  listContainer: {
    paddingBottom: 20,
    gap: 12,
  },
  teamCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  teamIconText: {
    fontSize: 20,
  },
  teamNameText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  dayTag: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dayTagText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusActive: {
    backgroundColor: '#064E3B',
  },
  statusInactive: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  captainBadge: {
    backgroundColor: '#78350F',
  },
  memberBadge: {
    backgroundColor: '#0F172A',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  captainText: {
    color: '#FBBF24',
  },
  memberText: {
    color: '#94A3B8',
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
  emptyCreateBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyCreateBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  inputLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
  },
  locButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#064E3B',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  locButtonText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '600',
  },
  daysPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 20,
  },
  dayPickBtn: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dayPickBtnActive: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  dayPickText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  dayPickTextActive: {
    color: '#34D399',
  },
  submitBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 16,
  },
});
