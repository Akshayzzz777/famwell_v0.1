import React, { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { theme } from '../styles/theme';

type SectionContainerProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  children: ReactNode;
};

export function SectionContainer({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  children,
}: SectionContainerProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {actionLabel ? (
          <TouchableOpacity activeOpacity={0.85} onPress={onActionPress}>
            <Text style={styles.action}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: theme.spacing[4],
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  titleWrap: {
    gap: theme.spacing[1],
  },
  title: {
    ...theme.typography.subheading,
    color: theme.colors.neutrals.textSecondary,
  },
  subtitle: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textMuted,
  },
  action: {
    ...theme.typography.label,
    color: theme.colors.brand.teal500,
  },
});
