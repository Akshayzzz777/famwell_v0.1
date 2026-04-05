import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '../components/Layout';
import { initialLetters } from '../lib/format';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation';

type ProfileScreenProps = NativeStackScreenProps<MainStackParamList, 'Profile'>;

type MenuItem = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress?: () => void;
};

export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { currentUser, logout } = useApp();
  const insets = useSafeAreaInsets();

  const accountItems: MenuItem[] = [
    { icon: 'person-outline', label: 'Personal Information' },
    { icon: 'people-outline', label: 'Family Members', onPress: () => navigation.navigate('FamilyProfiles') },
    { icon: 'description', label: 'Medical History Summary', onPress: () => navigation.navigate('PatientRecords') },
    { icon: 'notifications-none', label: 'Notifications & Alerts', onPress: () => navigation.navigate('Notifications') },
    { icon: 'lock-outline', label: 'Security & Privacy' },
  ];

  const supportItems: MenuItem[] = [
    { icon: 'help-outline', label: 'Help Center' },
    { icon: 'article', label: 'Terms of Service' },
  ];

  const renderMenuItem = (item: MenuItem, index: number, isLast: boolean) => (
    <Pressable
      key={index}
      onPress={item.onPress}
      style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }, !isLast && styles.menuItemBorder]}
    >
      <MaterialIcons name={item.icon} size={22} color={theme.colors.textMuted} />
      <Text style={styles.menuItemLabel}>{item.label}</Text>
      <MaterialIcons name="chevron-right" size={22} color={theme.colors.textSoft} />
    </Pressable>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable style={styles.headerBtn}>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {initialLetters(currentUser?.fullName || currentUser?.email)}
              </Text>
            </View>
            <View style={styles.editBadge}>
              <MaterialIcons name="edit" size={14} color="#fff" />
            </View>
          </View>
          <Text style={styles.userName}>{currentUser?.fullName || 'FamWell User'}</Text>
          <Text style={styles.healthId}>
            Health ID: {currentUser?.healthId || 'Not assigned'}
          </Text>
        </View>

        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account Settings</Text>
          <View style={styles.menuCard}>
            {accountItems.map((item, i) => renderMenuItem(item, i, i === accountItems.length - 1))}
          </View>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Support</Text>
          <View style={styles.menuCard}>
            {supportItems.map((item, i) => renderMenuItem(item, i, i === supportItems.length - 1))}
          </View>
        </View>

        {/* Log Out */}
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <MaterialIcons name="logout" size={20} color={theme.colors.danger} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        {/* Version */}
        <Text style={styles.version}>FamWell Version 1.0.0</Text>
      </ScrollView>

      <BottomNav
        activeRoute="Profile"
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 24,
  },
  avatarSection: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.primaryDark,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
  },
  healthId: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingLeft: 4,
  },
  menuCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuItemLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: theme.colors.dangerSoft,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.danger,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: theme.colors.textSoft,
  },
});
