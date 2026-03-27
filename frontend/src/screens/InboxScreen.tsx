import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { LoadingDots } from '../components/LoadingDots';
import { useRole } from '../context/RoleContext';
import { mainNavItems } from '../navigation/mainNavItems';
import type { InboxScreenProps, MainRouteName } from '../navigation/types';
import { fetchConversations, type ConversationItem } from '../services/api';
import { theme } from '../styles/theme';

export function InboxScreen({ navigation }: InboxScreenProps) {
  const { selectedRole } = useRole();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchConversations(selectedRole);
      setConversations(data.conversations);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadConversations);
    return unsubscribe;
  }, [navigation, loadConversations]);

  const handleNewChat = () => {
    navigation.navigate('ChatScreen', {});
  };

  const handleOpenConversation = (conversationId: string) => {
    navigation.navigate('ChatScreen', { conversationId });
  };

  const handleNavigate = (route: MainRouteName) => {
    navigation.navigate(route);
  };

  const renderConversation = ({ item }: { item: ConversationItem }) => {
    const preview = item.last_message || 'No messages yet';
    const truncatedPreview = preview.length > 60 ? preview.slice(0, 60) + '...' : preview;
    const timeAgo = formatRelativeTime(item.updated_at);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handleOpenConversation(item.conversation_id)}
      >
        <Card style={styles.conversationCard}>
          <View style={styles.conversationRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>AI</Text>
            </View>
            <View style={styles.conversationContent}>
              <View style={styles.conversationHeader}>
                <Text style={styles.conversationTitle} numberOfLines={1}>
                  {item.title || 'Conversation'}
                </Text>
                <Text style={styles.timeText}>{timeAgo}</Text>
              </View>
              <Text style={styles.previewText} numberOfLines={1}>
                {truncatedPreview}
              </Text>
            </View>
            {item.message_count ? (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{item.message_count}</Text>
              </View>
            ) : null}
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <Header
        title="Inbox"
        subtitle="Messages & AI Assistant"
        rightLabel="+ New"
        onRightPress={handleNewChat}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <LoadingDots />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.conversation_id}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <TouchableOpacity activeOpacity={0.85} onPress={handleNewChat}>
              <Card style={styles.aiCard}>
                <View style={styles.conversationRow}>
                  <View style={[styles.avatar, styles.aiAvatar]}>
                    <Text style={[styles.avatarText, styles.aiAvatarText]}>AI</Text>
                  </View>
                  <View style={styles.conversationContent}>
                    <Text style={styles.aiTitle}>FamWell AI Assistant</Text>
                    <Text style={styles.aiSubtitle}>
                      Ask about health, reports, or wellness
                    </Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>
                Start a chat with the AI assistant above
              </Text>
            </View>
          }
        />
      )}

      <BottomNav activeRoute="InboxScreen" items={mainNavItems} onNavigate={handleNavigate} />
    </View>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.neutrals.background,
  },
  listContent: {
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[20] + theme.spacing[4],
    gap: theme.spacing[3],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationCard: {
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.neutrals.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...theme.typography.caption,
    color: theme.colors.neutrals.textMuted,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationTitle: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textPrimary,
    flex: 1,
  },
  timeText: {
    ...theme.typography.caption,
    color: theme.colors.neutrals.textSubtle,
    marginLeft: theme.spacing[2],
  },
  previewText: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
    marginTop: theme.spacing[1],
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.brand.teal500,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing[2],
  },
  countText: {
    ...theme.typography.caption,
    color: theme.colors.white,
  },
  aiCard: {
    paddingVertical: theme.spacing[4],
    paddingHorizontal: theme.spacing[4],
    backgroundColor: theme.colors.brand.teal50,
    borderColor: theme.colors.brand.teal100,
  },
  aiAvatar: {
    backgroundColor: theme.colors.brand.teal500,
  },
  aiAvatarText: {
    color: theme.colors.white,
  },
  aiTitle: {
    ...theme.typography.subheading,
    color: theme.colors.brand.teal700,
  },
  aiSubtitle: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
    marginTop: theme.spacing[1],
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: theme.spacing[8],
  },
  emptyText: {
    ...theme.typography.subheading,
    color: theme.colors.neutrals.textMuted,
  },
  emptySubtext: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textSubtle,
    marginTop: theme.spacing[2],
  },
});
