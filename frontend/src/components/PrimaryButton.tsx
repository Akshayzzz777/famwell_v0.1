import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { theme } from '../styles/theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
};

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
}: PrimaryButtonProps) {
  const isSecondary = variant === 'secondary';

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        isSecondary ? styles.secondaryButton : styles.primaryButton,
        (disabled || loading) && styles.disabledButton,
      ]}
    >
      <Text style={[styles.label, isSecondary ? styles.secondaryLabel : styles.primaryLabel]}>
        {loading ? `${label}...` : label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: theme.componentTokens.button.borderRadius,
    justifyContent: 'center',
    minHeight: theme.componentTokens.button.minHeight,
    paddingHorizontal: theme.componentTokens.button.paddingHorizontal,
    paddingVertical: theme.componentTokens.button.paddingVertical,
  },
  primaryButton: {
    backgroundColor: theme.colors.semantic.primary,
    ...theme.shadows.button,
  },
  secondaryButton: {
    backgroundColor: theme.colors.neutrals.textPrimary,
  },
  disabledButton: {
    opacity: 0.55,
  },
  label: {
    ...theme.typography.bodyStrong,
  },
  primaryLabel: {
    color: theme.colors.white,
  },
  secondaryLabel: {
    color: theme.colors.white,
  },
});
