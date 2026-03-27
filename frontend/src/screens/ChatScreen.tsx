import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '../components/Header';
import { LoadingDots } from '../components/LoadingDots';
import { useRole } from '../context/RoleContext';
import type { ChatScreenProps } from '../navigation/types';
import { fetchChatHistory, sendChatMessage, type ChatMessage } from '../services/api';
import { theme } from '../styles/theme';

export function ChatScreen({ navigation, route }: ChatScreenProps) {
  const insets = useSafeAreaInsets();
  const { selectedRole } = useRole();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(
    route.params?.conversationId
  );
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (conversationId) {
      loadHistory();
    }
  }, [conversationId]);

  const loadHistory = useCallback(async () => {
    if (!conversationId) return;
    try {
      const data = await fetchChatHistory(selectedRole, conversationId);
      setMessages(data.messages);
    } catch {
      // Ignore - fresh conversation
    }
  }, [conversationId, selectedRole]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const optimisticMsg: ChatMessage = {
      message_id: `temp_${Date.now()}`,
      conversation_id: conversationId || '',
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInput('');
    setSending(true);

    try {
      const result = await sendChatMessage(selectedRole, text, conversationId);
      setConversationId(result.conversation_id);

      setMessages((prev) => {
        const filtered = prev.filter((m) => m.message_id !== optimisticMsg.message_id);
        return [
          ...filtered,
          { ...optimisticMsg, conversation_id: result.conversation_id, message_id: `user_${Date.now()}` },
          result.message,
        ];
      });
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          message_id: `err_${Date.now()}`,
          conversation_id: conversationId || '',
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, conversationId, selectedRole]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isUser = item.role === 'user';
      return (
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          {!isUser && <Text style={styles.roleLabel}>FamWell AI</Text>}
          <Text style={[styles.messageText, isUser && styles.userText]}>{item.content}</Text>
        </View>
      );
    },
    []
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <Header backLabel="<" onBack={navigation.goBack} title="AI Health Chat" />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.message_id}
        renderItem={renderMessage}
        contentContainerStyle={[styles.messageList, { paddingBottom: theme.spacing[4] }]}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Start a conversation</Text>
            <Text style={styles.emptyText}>
              Ask FamWell AI about your health, medical reports, wellness tips, or general health questions.
            </Text>
          </View>
        }
      />

      {sending && (
        <View style={styles.typingIndicator}>
          <LoadingDots />
          <Text style={styles.typingText}>FamWell AI is typing...</Text>
        </View>
      )}

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + theme.spacing[3] }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Type your message..."
          placeholderTextColor={theme.colors.neutrals.textSubtle}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={4000}
          editable={!sending}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
          activeOpacity={0.85}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.neutrals.background,
  },
  messageList: {
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[4],
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: theme.spacing[4],
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing[3],
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.brand.teal500,
    borderBottomRightRadius: theme.radius.sm,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.neutrals.surface,
    borderBottomLeftRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.neutrals.borderSoft,
  },
  roleLabel: {
    ...theme.typography.caption,
    color: theme.colors.brand.teal700,
    marginBottom: theme.spacing[1],
  },
  messageText: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textPrimary,
  },
  userText: {
    color: theme.colors.white,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[3],
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutrals.borderSoft,
    gap: theme.spacing[3],
  },
  textInput: {
    flex: 1,
    ...theme.typography.body,
    backgroundColor: theme.colors.neutrals.surfaceMuted,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    maxHeight: 100,
    color: theme.colors.neutrals.textPrimary,
  },
  sendButton: {
    backgroundColor: theme.colors.brand.teal500,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[3],
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    ...theme.typography.label,
    color: theme.colors.white,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[2],
    gap: theme.spacing[2],
  },
  typingText: {
    ...theme.typography.caption,
    color: theme.colors.neutrals.textMuted,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[8],
    paddingTop: theme.spacing[12],
  },
  emptyTitle: {
    ...theme.typography.heading,
    color: theme.colors.neutrals.textPrimary,
    marginBottom: theme.spacing[3],
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
    textAlign: 'center',
  },
});
