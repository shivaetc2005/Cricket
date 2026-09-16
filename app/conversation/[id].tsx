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
import { Colors } from '../../theme/colors';

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
          headerStyle: { backgroundColor: Colors.navy },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
          headerRight: () => (
            <TouchableOpacity
              style={styles.headerReqBtn}
              onPress={() => setMatchModalVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="trophy-outline" size={15} color={Colors.primaryText} />
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
            <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} size="large" />
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
                placeholderTextColor={Colors.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendDisabled]}
                onPress={handleSendMessage}
                disabled={!inputText.trim() || sending}
                activeOpacity={0.85}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={Colors.primaryText} />
                ) : (
                  <Ionicons name="send" size={17} color={Colors.primaryText} />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.readOnlyBanner}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textSecondary} />
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
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Proposed Date & Time *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Next Saturday, 10:00 AM"
              placeholderTextColor={Colors.textSecondary}
              value={proposedDate}
              onChangeText={setProposedDate}
            />

            <Text style={styles.inputLabel}>Proposed Ground / Location *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Oval Cricket Ground, Pitch 2"
              placeholderTextColor={Colors.textSecondary}
              value={proposedGround}
              onChangeText={setProposedGround}
            />

            <TouchableOpacity
              style={[styles.submitMatchBtn, submittingMatch && styles.sendDisabled]}
              onPress={handleCreateMatchRequest}
              disabled={submittingMatch}
              activeOpacity={0.85}
            >
              {submittingMatch ? (
                <ActivityIndicator color={Colors.primaryText} />
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
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  headerReqBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  headerReqText: {
    color: Colors.primaryText,
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
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: Colors.textSecondary,
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
    backgroundColor: Colors.primary,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: Colors.text,
  },
  myMessageText: {
    color: Colors.primaryText,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.5,
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  readOnlyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
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
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
  },
  submitMatchBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 11,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitMatchText: {
    color: Colors.primaryText,
    fontWeight: '700',
    fontSize: 15,
  },
});
