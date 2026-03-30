import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScaffold } from '../components/Layout';
import { Button, Card, SectionTitle } from '../components/Primitives';
import { formatTime } from '../lib/format';
import { theme } from '../lib/theme';
import type { ConsultationChatProps } from '../navigation';
import { useApp } from '../state/AppContext';
import { sendChatMessage } from '../../services/api';

type Message = {
  id: string;
  author: 'user' | 'assistant';
  text: string;
  timestamp: string;
};

const welcomeMessages: Message[] = [
  {
    id: 'welcome-1',
    author: 'assistant',
    text: 'Hello, I can help you prepare for your next visit, organize your questions, or review the prescription summary together.',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'welcome-2',
    author: 'assistant',
    text: 'Tell me what you want to focus on today and I will keep the conversation organized.',
    timestamp: new Date().toISOString(),
  },
];

export function ConsultationChatScreen({ navigation, route }: ConsultationChatProps) {
  const scrollRef = useRef<ScrollView | null>(null);
  const { selectedRole } = useApp();
  const [messages, setMessages] = useState<Message[]>(welcomeMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const initialMessageSent = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || sending) return;

    const timestamp = new Date().toISOString();
    const userMessage: Message = {
      author: 'user',
      id: `${timestamp}-user`,
      text: text.trim(),
      timestamp,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setSending(true);

    try {
      const response = await sendChatMessage(selectedRole, text.trim(), conversationId);
      setConversationId(response.conversation_id);

      const assistantMessage: Message = {
        author: 'assistant',
        id: response.message.message_id,
        text: response.message.content,
        timestamp: response.message.created_at,
      };
      setMessages((current) => [...current, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        author: 'assistant',
        id: `${timestamp}-error`,
        text: 'Sorry, I was unable to process that. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((current) => [...current, errorMessage]);
    } finally {
      setSending(false);
    }
  }, [sending, selectedRole, conversationId]);

  // Auto-send initialMessage from navigation params (e.g. from StressAnalysis "Discuss in Chat")
  useEffect(() => {
    const initialMessage = route.params?.initialMessage;
    if (initialMessage && !initialMessageSent.current) {
      initialMessageSent.current = true;
      sendMessage(initialMessage);
    }
  }, [route.params?.initialMessage, sendMessage]);

  const handleSend = () => {
    sendMessage(draft);
  };

  return (
    <AppScaffold subtitle="A calm place to organize questions and next steps." title="Consultation Chat">
      <Card style={styles.chatShell}>
        <SectionTitle detail="Keep your questions, follow-ups, and reminders in one threaded conversation." eyebrow="Chat" title="Care conversation" />
        <ScrollView ref={scrollRef} contentContainerStyle={styles.messageList} showsVerticalScrollIndicator={false}>
          {messages.map((message) => {
            const mine = message.author === 'user';
            return (
              <View key={message.id} style={[styles.messageBubble, mine ? styles.messageBubbleMine : styles.messageBubbleAssistant]}>
                <Text style={[styles.messageText, mine && styles.messageTextMine]}>{message.text}</Text>
                <Text style={[styles.messageTime, mine && styles.messageTimeMine]}>{formatTime(message.timestamp)}</Text>
              </View>
            );
          })}
          {sending && (
            <View style={[styles.messageBubble, styles.messageBubbleAssistant, styles.typingBubble]}>
              <ActivityIndicator color={theme.colors.primary} size="small" />
              <Text style={styles.typingText}>Thinking…</Text>
            </View>
          )}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            editable={!sending}
            multiline
            onChangeText={setDraft}
            placeholder="Type your question or follow-up note"
            placeholderTextColor={theme.colors.textSoft}
            style={styles.input}
            value={draft}
          />
          <Button disabled={sending || !draft.trim()} label={sending ? 'Sending…' : 'Send'} onPress={handleSend} />
        </View>
      </Card>
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  chatShell: {
    gap: theme.spacing.md,
    minHeight: 540,
  },
  messageList: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    gap: 4,
  },
  messageBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primary,
  },
  messageBubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surfaceAccent,
  },
  messageText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  messageTextMine: {
    color: theme.colors.white,
  },
  messageTime: {
    ...theme.typography.caption,
    color: theme.colors.textSoft,
  },
  messageTimeMine: {
    color: 'rgba(255,255,255,0.7)',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    ...theme.typography.caption,
    color: theme.colors.textSoft,
    fontStyle: 'italic',
  },
  inputRow: {
    gap: theme.spacing.sm,
  },
  input: {
    minHeight: 90,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    color: theme.colors.text,
    ...theme.typography.body,
    textAlignVertical: 'top',
  },
});
