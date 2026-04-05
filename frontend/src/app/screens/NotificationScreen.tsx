import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '../components/Layout';
import { theme } from '../lib/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation';

type NotificationsProps = NativeStackScreenProps<MainStackParamList, 'Notifications'>;

type NotificationItem = {
  id: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  message: string;
  time: string;
  section: string;
};

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    icon: 'medication',
    iconColor: theme.colors.primary,
    iconBg: theme.colors.primarySoft,
    title: 'Medication Reminder',
    message: 'Time to take your prescribed Metformin 500mg',
    time: '2 hours ago',
    section: 'Today',
  },
  {
    id: '2',
    icon: 'calendar-today',
    iconColor: theme.colors.secondary,
    iconBg: theme.colors.secondarySoft,
    title: 'Doctor Appointment',
    message: 'Upcoming appointment with Dr. Smith tomorrow at 10:00 AM',
    time: '5 hours ago',
    section: 'Today',
  },
  {
    id: '3',
    icon: 'favorite',
    iconColor: theme.colors.danger,
    iconBg: theme.colors.dangerSoft,
    title: 'Weekly Health Pulse',
    message: 'Your weekly health summary is ready to review',
    time: 'Yesterday',
    section: 'Yesterday',
  },
  {
    id: '4',
    icon: 'people',
    iconColor: theme.colors.accent,
    iconBg: theme.colors.accentSoft,
    title: 'Family Update',
    message: 'New health record shared by a family member',
    time: '2 days ago',
    section: 'Earlier this week',
  },
  {
    id: '5',
    icon: 'security',
    iconColor: theme.colors.textMuted,
    iconBg: theme.colors.surfaceAccent,
    title: 'Security Alert',
    message: 'New device signed into your account',
    time: '3 days ago',
    section: 'Earlier this week',
  },
];

export function NotificationScreen({ navigation }: NotificationsProps) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const sections = notifications.reduce<Record<string, NotificationItem[]>>((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  const sectionOrder = ['Today', 'Yesterday', 'Earlier this week'];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Pressable onPress={clearAll} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>Clear All</Text>
        </Pressable>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialIcons name="notifications-off" size={48} color={theme.colors.textSoft} />
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptyBody}>No new notifications at the moment.</Text>
        </View>
      ) : (
        <FlatList
          data={sectionOrder.filter((s) => sections[s])}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: sectionKey }) => (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{sectionKey}</Text>
              {sections[sectionKey].map((notif) => (
                <View key={notif.id} style={styles.notifCard}>
                  <View style={[styles.notifIcon, { backgroundColor: notif.iconBg }]}>  
                    <MaterialIcons name={notif.icon} size={22} color={notif.iconColor} />
                  </View>
                  <View style={styles.notifBody}>
                    <View style={styles.notifTopRow}>
                      <Text style={styles.notifTitle}>{notif.title}</Text>
                      <Text style={styles.notifTime}>{notif.time}</Text>
                    </View>
                    <Text style={styles.notifMessage}>{notif.message}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          ListFooterComponent={
            <Text style={styles.footer}>End of updates</Text>
          }
        />
      )}

      <BottomNav
        activeRoute="Notifications"
        insetsBottom={insets.bottom}
        onNavigate={(route) => navigation.navigate(route)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 20,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingLeft: 4,
    marginBottom: 2,
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  notifIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBody: {
    flex: 1,
    gap: 4,
  },
  notifTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  notifTime: {
    fontSize: 12,
    color: theme.colors.textSoft,
    marginLeft: 8,
  },
  notifMessage: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: theme.colors.textSoft,
    paddingVertical: 16,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  emptyBody: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
});
