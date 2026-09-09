import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at?: string;
  profiles?: {
    name: string;
  };
}

interface ConversationInfo {
  id: string;
  team_id: string;
  initiator_id: string;
  teams?: {
    id: string;
    name: string;
    captain_id: string;
  };
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [canSend, setCanSend] = useState(false);

  // Match Request Modal
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [proposedDate, setProposedDate] = useState('');
  const [proposedGround, setProposedGround] = useState('');
  const [submittingMatch, setSubmittingMatch] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (id) {
      fetchConversationDetails();
      fetchMessages();
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    // Realtime subscription for new messages in this conversation
    const channel = supabase
      .channel(`conversation:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          // Fetch sender profile name
          const { data: prof } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', newMsg.sender_id)
            .single();

          setMessages((prev) => [
            ...prev,
            { ...newMsg, profiles: prof ? { name: prof.name } : undefined },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchConversationDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, teams (id, name, captain_id)')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setConversation(data);
        const isInitiator = data.initiator_id === user?.id;
        const isTargetCaptain = data.teams?.captain_id === user?.id;
        setCanSend(isInitiator || isTargetCaptain);
      }
    } catch (e: any) {
      console.warn('Error fetching conversation details:', e);
    }
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, profiles (name)')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data) {
        setMessages(data);
      }
    } catch (e: any) {
      console.warn('Error fetching messages:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user?.id || !canSend) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: id,
        sender_id: user.id,
        body: textToSend,
      });

      if (error) throw error;
    } catch (e: any) {
      Alert.alert('Send Error', e.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const handleCreateMatchRequest = async () => {
    if (!proposedDate.trim() || !proposedGround.trim()) {
      Alert.alert('Validation Error', 'Please specify a proposed match date and ground.');
      return;
    }
    if (!conversation || !user?.id) return;

    setSubmittingMatch(true);
    try {
      // Determine requesting team and target team
      const requestingTeamId = conversation.teams?.captain_id === user.id ? conversation.teams.id : user.id;
      const targetTeamId = conversation.teams?.id;

      const { error } = await supabase.from('match_requests').insert({
        conversation_id: conversation.id,
        requesting_team_id: requestingTeamId,
        target_team_id: targetTeamId,
        proposed_date: proposedDate.trim(),
        proposed_ground: proposedGround.trim(),
        status: 'pending',
      });

      if (error) throw error;

      Alert.alert('Match Requested ⚡', `Match request sent to ${conversation.teams?.name}!`);
      setMatchModalVisible(false);
      setProposedDate('');
      setProposedGround('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send match request.');
    } finally {
      setSubmittingMatch(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          title: conversation?.teams?.name ? `Chat with ${conversation.teams.name}` : 'Team Chat',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
          headerRight: () => (
            <TouchableOpacity
              style={styles.headerReqBtn}
              onPress={() => setMatchModalVisible(true)}
            >
              <Ionicons name="trophy-outline" size={16} color="#0F172A" />
              <Text style={styles.headerReqText}>Request Match</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <View style={styles.container}>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#10B981" size="large" />
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messageList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyEmoji}>💬</Text>
                  <Text style={styles.emptyText}>No messages in this chat yet.</Text>
                  <Text style={styles.emptySub}>Start the inquiry or challenge the team!</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isMe = item.sender_id === user?.id;
                return (
                  <View
                    style={[
                      styles.messageBubble,
                      isMe ? styles.myMessage : styles.otherMessage,
                    ]}
                  >
                    {!isMe && (
                      <Text style={styles.senderName}>
                        {item.profiles?.name || 'Team Captain'}
                      </Text>
                    )}
                    <Text style={[styles.messageText, isMe && styles.myMessageText]}>
                      {item.body}
                    </Text>
                  </View>
                );
              }}
            />
          )}

          {/* Input Footer Section */}
          {canSend ? (
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor="#64748B"
                value={inputText}
                onChangeText={setInputText}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendDisabled]}
                onPress={handleSendMessage}
                disabled={!inputText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#0F172A" />
                ) : (
                  <Ionicons name="send" size={18} color="#0F172A" />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.readOnlyBanner}>
              <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" />
              <Text style={styles.readOnlyText}>
                Only the team captain or inquiry initiator can reply.
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Match Request Modal */}
      <Modal visible={matchModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Match</Text>
              <TouchableOpacity onPress={() => setMatchModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Proposed Date & Time *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Next Saturday, 10:00 AM"
              placeholderTextColor="#64748B"
              value={proposedDate}
              onChangeText={setProposedDate}
            />

            <Text style={styles.inputLabel}>Proposed Ground / Location *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Oval Cricket Ground, Pitch 2"
              placeholderTextColor="#64748B"
              value={proposedGround}
              onChangeText={setProposedGround}
            />

            <TouchableOpacity
              style={[styles.submitMatchBtn, submittingMatch && styles.sendDisabled]}
              onPress={handleCreateMatchRequest}
              disabled={submittingMatch}
            >
              {submittingMatch ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.submitMatchText}>Send Match Challenge ⚡</Text>
              )}
            </TouchableOpacity>
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
    flex: 1,
  },
  headerReqBtn: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  headerReqText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 12,
  },
  messageList: {
    padding: 16,
    gap: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  emptyText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#10B981',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#F8FAFC',
  },
  myMessageText: {
    color: '#0F172A',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#10B981',
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.6,
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 8,
  },
  readOnlyText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
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
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 14,
  },
  submitMatchBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitMatchText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 16,
  },
});
