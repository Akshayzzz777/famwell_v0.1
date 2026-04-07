import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ScrollViewProps,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { doctorNavItems, mainNavItems, type MainRouteName } from '../navigation';
import { theme } from '../lib/theme';
import { useApp } from '../state/AppContext';

const NAV_HEIGHT = 78;

export function AppScaffold({
  children,
  title,
  subtitle,
  onBack,
  rightAction,
  activeRoute,
  onNavigate,
  scrollProps,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  activeRoute?: MainRouteName;
  onNavigate?: (route: MainRouteName) => void;
  scrollProps?: ScrollViewProps;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const showNav = Boolean(activeRoute && onNavigate);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + theme.spacing.lg,
            paddingBottom: insets.bottom + (showNav ? NAV_HEIGHT + theme.spacing.xl : theme.spacing.xxl),
            paddingHorizontal: isWide ? 48 : theme.spacing.lg,
          },
        ]}
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        <View style={styles.topBar}>
          <View style={styles.topBarContent}>
            {onBack ? (
              <Pressable onPress={onBack} style={styles.backButton}>
                <MaterialIcons color={theme.colors.text} name="arrow-back" size={18} />
                <Text style={styles.backButtonLabel}>Back</Text>
              </Pressable>
            ) : null}
            <View style={styles.titleWrap}>
              <Text style={styles.pageTitle}>{title}</Text>
              {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
            </View>
          </View>
          {rightAction}
        </View>

        <View style={[styles.body, isWide && styles.bodyWide]}>{children}</View>
      </ScrollView>

      {showNav ? <BottomNav activeRoute={activeRoute!} insetsBottom={insets.bottom} onNavigate={onNavigate!} /> : null}
    </View>
  );
}

export function BottomNav({
  activeRoute,
  insetsBottom,
  onNavigate,
}: {
  activeRoute: MainRouteName;
  insetsBottom: number;
  onNavigate: (route: MainRouteName) => void;
}) {
  const { currentUser } = useApp();
  const isDoctor = currentUser?.role === 'DOCTOR';
  const navItems = isDoctor ? doctorNavItems : mainNavItems;

  return (
    <View style={[styles.navWrap, { paddingBottom: Math.max(insetsBottom, 10) }]}> 
      <View style={styles.navShell}>
        {navItems.map((item) => {
          const active = item.route === activeRoute;
          const color = active ? theme.colors.primary : '#98A2A0';
          const weight = active ? '700' : '500';

          return (
            <Pressable
              accessibilityLabel={item.label}
              key={item.route}
              onPress={() => onNavigate(item.route)}
              style={styles.navItem}
            >
              {item.iconFamily === 'MaterialCommunityIcons' ? (
                <MaterialCommunityIcons color={color} name={item.iconName as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={24} />
              ) : (
                <MaterialIcons color={color} name={item.iconName as React.ComponentProps<typeof MaterialIcons>['name']} size={24} />
              )}
              <Text style={[styles.navLabel, { color, fontWeight: weight }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F8F6',
  },
  scrollContent: {
    flexGrow: 1,
    gap: theme.spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  topBarContent: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  backButton: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: '#EEF2EE',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backButtonLabel: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  titleWrap: {
    gap: theme.spacing.xs,
  },
  pageTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  pageSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  body: {
    gap: theme.spacing.lg,
  },
  bodyWide: {
    maxWidth: 1040,
    width: '100%',
    alignSelf: 'center',
  },
  navWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#EEF2EE',
    zIndex: 20,
  },
  navShell: {
    minHeight: NAV_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navLabel: {
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
  },
});
