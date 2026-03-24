import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScaffold } from '../components/Layout';
import { Button, Card, SectionTitle } from '../components/Primitives';
import { formatTime } from '../lib/format';
import { theme } from '../lib/theme';
import type { ConsultationChatProps } from '../navigation';

type Message = {
  id: string;
  author: 'user' | 'assistant';
  text: string;
  timestamp: string;
};

const seedMessages: Message[] = [
  {
    id: '1',
    author: 'assistant',
    text: 'Hello, I can help you prepare for your next visit, organize your questions, or review the prescription summary together.',
    timestamp: new Date().toISOString(),
  },
  {
    id: '2',
    author: 'assistant',
    text: 'Tell me what you want to focus on today and I will keep the conversation organized.',
    timestamp: new Date().toISOString(),
  },
];

const cannedReplies = [
  'You may want to ask about dosage timing, refill duration, and any interactions with current medications.',
  'A useful next step is to compare this summary with the latest lab results and confirm whether the treatment plan changed.',
  'For a follow-up visit, bring the prescription, your symptoms timeline, and any questions about side effects or monitoring.',
];

export function ConsultationChatScreen({ navigation }: ConsultationChatProps) {
  const scrollRef = useRef<ScrollView | null>(null);
  const [messages, setMessages] = useState<Message[]>(seedMessages);
  const [draft, setDraft] = useState('');
  const [replyIndex, setReplyIndex] = useState(0);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }

    const timestamp = new Date().toISOString();
    const userMessage: Message = {
      author: 'user',
      id: `${timestamp}-user`,
      text,
      timestamp,
    };

    const assistantMessage: Message = {
      author: 'assistant',
      id: `${timestamp}-assistant`,
      text: cannedReplies[replyIndex % cannedReplies.length],
      timestamp: new Date(Date.now() + 500).toISOString(),
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setDraft('');
    setReplyIndex((value) => value + 1);
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
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            multiline
            onChangeText={setDraft}
            placeholder="Type your question or follow-up note"
            placeholderTextColor={theme.colors.textSoft}
            style={styles.input}
            value={draft}
          />
          <Button label="Send" onPress={handleSend} />
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
