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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

interface UserTeamRole {
  team_id: string;
  team_name: string;
  role: 'Captain' | 'Member';
}

export default function ProfileScreen() {
  const { user, profile, refreshProfile, signOut } = useAuth();

  const [name, setName] = useState(profile?.name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [skillLevel, setSkillLevel] = useState(profile?.skill_level || 'Intermediate');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');

  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [userTeams, setUserTeams] = useState<UserTeamRole[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
      setSkillLevel(profile.skill_level || 'Intermediate');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  useEffect(() => {
    if (user?.id) {
      fetchUserTeams();
    }
  }, [user]);

  const fetchUserTeams = async () => {
    if (!user?.id) return;
    setLoadingTeams(true);
    try {
      // Query team_members for user
      const { data: memberRows, error } = await supabase
        .from('team_members')
        .select('team_id, teams (id, name, captain_id)')
        .eq('user_id', user.id);

      if (error) throw error;

      if (memberRows) {
        const teamsList: UserTeamRole[] = memberRows.map((item: any) => {
          const t = item.teams;
          const isCaptain = t?.captain_id === user.id;
          return {
            team_id: t?.id || item.team_id,
            team_name: t?.name || 'Unnamed Team',
            role: isCaptain ? 'Captain' : 'Member',
          };
        });
        setUserTeams(teamsList);
      }
    } catch (e) {
      console.warn('Error fetching user teams:', e);
    } finally {
      setLoadingTeams(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        phone: phone.trim() || null,
        skill_level: skillLevel,
        avatar_url: avatarUrl.trim() || null,
      };

      // 1. Check if profile row exists for this user
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      let errorToReport: any = null;

      if (existingProfile) {
        // 2. Perform direct UPDATE on existing profile
        const { error } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', user.id);

        errorToReport = error;
      } else {
        // 3. Perform direct INSERT if profile row doesn't exist
        const { error } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            ...payload,
          });

        errorToReport = error;
      }

      if (errorToReport) {
        console.error('Profile save error:', errorToReport);
        Alert.alert('Profile Error', errorToReport.message || 'Could not save profile changes.');
      } else {
        await refreshProfile();
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully!');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  const skillLevels = ['Beginner', 'Intermediate', 'Semi-Pro', 'Professional'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {profile?.name ? profile.name.charAt(0).toUpperCase() : '🏏'}
            </Text>
          </View>
          <Text style={styles.profileName}>{profile?.name || 'Cricket Player'}</Text>
          <Text style={styles.emailText}>{user?.email}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Player Details</Text>
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
              <Text style={styles.editLink}>{isEditing ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>

          {isEditing ? (
            <View>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Name"
                placeholderTextColor="#64748B"
              />

              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone"
                placeholderTextColor="#64748B"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Skill Level</Text>
              <View style={styles.skillChips}>
                {skillLevels.map((lvl) => (
                  <TouchableOpacity
                    key={lvl}
                    style={[
                      styles.skillChip,
                      skillLevel === lvl && styles.skillChipActive,
                    ]}
                    onPress={() => setSkillLevel(lvl)}
                  >
                    <Text
                      style={[
                        styles.skillChipText,
                        skillLevel === lvl && styles.skillChipTextActive,
                      ]}
                    >
                      {lvl}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.buttonDisabled]}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#0F172A" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.infoList}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{profile?.phone || 'Not set'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Skill Level</Text>
                <View style={styles.badgeSkill}>
                  <Text style={styles.badgeSkillText}>{profile?.skill_level || 'Intermediate'}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>My Team Affiliations</Text>
          {loadingTeams ? (
            <ActivityIndicator style={{ marginVertical: 12 }} color="#10B981" />
          ) : userTeams.length > 0 ? (
            userTeams.map((item) => (
              <View key={item.team_id} style={styles.teamRow}>
                <Text style={styles.teamName}>🏏 {item.team_name}</Text>
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
            ))
          ) : (
            <Text style={styles.emptyText}>You haven't joined or created any teams yet.</Text>
          )}
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  container: {
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 12,
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#064E3B',
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 36,
    color: '#34D399',
    fontWeight: '700',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  emailText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  editLink: {
    color: '#34D399',
    fontWeight: '600',
    fontSize: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 14,
  },
  skillChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 16,
  },
  skillChip: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  skillChipActive: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  skillChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  skillChipTextActive: {
    color: '#34D399',
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 15,
  },
  infoList: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  infoLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  infoValue: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  badgeSkill: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeSkillText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  teamName: {
    color: '#F8FAFC',
    fontSize: 15,
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
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  captainText: {
    color: '#FBBF24',
  },
  memberText: {
    color: '#CBD5E1',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
  },
  signOutButton: {
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  signOutText: {
    color: '#FCA5A5',
    fontWeight: '700',
    fontSize: 15,
  },
});
