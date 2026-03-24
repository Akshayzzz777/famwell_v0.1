import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type KeyboardTypeOptions,
  type TextInputProps,
  type ViewStyle,
  View,
} from 'react-native';

import { theme } from '../lib/theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function Button({ label, onPress, disabled, loading, variant = 'primary' }: ButtonProps) {
  const palette =
    variant === 'primary'
      ? {
          container: styles.primaryButton,
          label: styles.primaryButtonLabel,
        }
      : variant === 'secondary'
        ? {
            container: styles.secondaryButton,
            label: styles.secondaryButtonLabel,
          }
        : {
            container: styles.ghostButton,
            label: styles.ghostButtonLabel,
          };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonBase,
        palette.container,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && !loading && styles.buttonPressed,
      ]}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? theme.colors.white : theme.colors.primary} /> : null}
      <Text style={[styles.buttonLabelBase, palette.label]}>{label}</Text>
    </Pressable>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  helperText?: string | null;
  error?: string | null;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
};

export function Field({ label, helperText, error, multiline, style, ...inputProps }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.colors.textSoft}
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline, style]}
        multiline={multiline}
        {...inputProps}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : helperText ? <Text style={styles.fieldHelper}>{helperText}</Text> : null}
    </View>
  );
}

export function Pill({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const toneStyle =
    tone === 'success'
      ? styles.pillSuccess
      : tone === 'warning'
        ? styles.pillWarning
        : tone === 'danger'
          ? styles.pillDanger
          : styles.pillDefault;

  return (
    <View style={[styles.pill, toneStyle]}>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ eyebrow, title, detail }: { eyebrow?: string; title: string; detail?: string }) {
  return (
    <View style={styles.sectionHeader}>
      {eyebrow ? <Text style={styles.sectionEyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    shadowColor: theme.colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  buttonBase: {
    minHeight: 52,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  ghostButton: {
    backgroundColor: theme.colors.surfaceAccent,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonLabelBase: {
    ...theme.typography.bodyStrong,
  },
  primaryButtonLabel: {
    color: theme.colors.white,
  },
  secondaryButtonLabel: {
    color: theme.colors.primary,
  },
  ghostButtonLabel: {
    color: theme.colors.text,
  },
  fieldWrap: {
    gap: theme.spacing.xs,
  },
  fieldLabel: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  fieldInput: {
    minHeight: 52,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    ...theme.typography.body,
  },
  fieldInputMultiline: {
    minHeight: 112,
    paddingTop: theme.spacing.md,
    textAlignVertical: 'top',
  },
  fieldHelper: {
    ...theme.typography.caption,
    color: theme.colors.textSoft,
  },
  fieldError: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  pillDefault: {
    backgroundColor: theme.colors.surfaceAccent,
  },
  pillSuccess: {
    backgroundColor: theme.colors.successSoft,
  },
  pillWarning: {
    backgroundColor: theme.colors.accentSoft,
  },
  pillDanger: {
    backgroundColor: theme.colors.dangerSoft,
  },
  pillLabel: {
    ...theme.typography.caption,
    color: theme.colors.text,
  },
  sectionHeader: {
    gap: 2,
  },
  sectionEyebrow: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    ...theme.typography.heading,
    color: theme.colors.text,
  },
  sectionDetail: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
});
