import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../styles/theme';

type HeaderProps = {
  title: string;
  subtitle?: string;
  backLabel?: string;
  onBack?: () => void;
  rightLabel?: string;
  onRightPress?: () => void;
};

export function Header({
  title,
  subtitle,
  backLabel,
  onBack,
  rightLabel,
  onRightPress,
}: HeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + theme.spacing[4] }]}>
      <View style={styles.row}>
        {backLabel ? (
          <TouchableOpacity activeOpacity={0.85} onPress={onBack} style={styles.sideButton}>
            <Text style={styles.sideLabel}>{backLabel}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.sideSpacer} />
        )}

        <View style={styles.titleWrap}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        {rightLabel ? (
          <TouchableOpacity activeOpacity={0.85} onPress={onRightPress} style={styles.sideButton}>
            <Text style={styles.sideLabel}>{rightLabel}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.sideSpacer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing[6],
    paddingBottom: theme.spacing[4],
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutrals.borderSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing[2],
  },
  title: {
    ...theme.typography.subheading,
    color: theme.colors.neutrals.textPrimary,
  },
  subtitle: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textMuted,
    marginTop: theme.spacing[1],
  },
  sideButton: {
    minWidth: 60,
  },
  sideSpacer: {
    minWidth: 60,
  },
  sideLabel: {
    ...theme.typography.label,
    color: theme.colors.brand.sky700,
  },
});
