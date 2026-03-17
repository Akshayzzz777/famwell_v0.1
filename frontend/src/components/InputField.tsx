import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { theme } from '../styles/theme';

type InputFieldProps = {
  label?: string;
  value: string;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  onChangeText: (value: string) => void;
};

export function InputField({
  label,
  value,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  onChangeText,
}: InputFieldProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        autoCapitalize="none"
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.neutrals.textSubtle}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing[2],
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textBody,
    marginLeft: theme.spacing[1],
  },
  input: {
    ...theme.typography.body,
    backgroundColor: theme.componentTokens.input.backgroundColor,
    borderColor: theme.componentTokens.input.borderColor,
    borderRadius: theme.componentTokens.input.borderRadius,
    borderWidth: 1,
    color: theme.colors.neutrals.textPrimary,
    minHeight: theme.componentTokens.input.minHeight,
    paddingHorizontal: theme.componentTokens.input.paddingHorizontal,
    paddingVertical: theme.componentTokens.input.paddingVertical,
  },
});
