import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MainRouteName } from '../navigation/types';
import { theme } from '../styles/theme';

type BottomNavItem = {
  label: string;
  route: MainRouteName;
};

type BottomNavProps = {
  activeRoute: MainRouteName;
  items: BottomNavItem[];
  onNavigate: (route: MainRouteName) => void;
};

export function BottomNav({ activeRoute, items, onNavigate }: BottomNavProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + theme.spacing[3] }]}>
      {items.map((item) => {
        const isActive = item.route === activeRoute;

        return (
          <TouchableOpacity
            key={item.route}
            activeOpacity={0.85}
            onPress={() => onNavigate(item.route)}
            style={styles.item}
          >
            <Text style={[styles.badge, isActive && styles.badgeActive]}>
              {item.label.slice(0, 2).toUpperCase()}
            </Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[6],
    paddingTop: theme.spacing[4],
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutrals.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing[1],
  },
  badge: {
    ...theme.typography.caption,
    color: theme.colors.neutrals.textSubtle,
    textTransform: 'none',
    letterSpacing: 0,
  },
  badgeActive: {
    color: theme.colors.brand.teal500,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.neutrals.textSubtle,
  },
  labelActive: {
    color: theme.colors.brand.teal500,
  },
});
