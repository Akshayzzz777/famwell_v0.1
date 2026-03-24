import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../state/AppContext';
import { theme } from '../lib/theme';
import { Button, Card, Field } from '../components/Primitives';

type AuthMode = 'signin' | 'signup';

export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const {
    clearSessionError,
    selectedRole,
    sessionBusy,
    sessionError,
    setSelectedRole,
    signIn,
    signUp,
  } = useApp();

  const canSubmit = useMemo(() => {
    if (mode === 'signin') {
      return Boolean(selectedRole && email.trim() && password.trim());
    }

    return Boolean(selectedRole && email.trim() && password.trim() && fullName.trim() && phoneNumber.trim());
  }, [email, fullName, mode, password, phoneNumber, selectedRole]);

  const handleSubmit = async () => {
    const success =
      mode === 'signin'
        ? await signIn({ email, password })
        : await signUp({ email, password, fullName, phoneNumber });

    if (success) {
      onAuthenticated();
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.title}>Health workflows with a lighter touch.</Text>
          <Text style={styles.subtitle}>Sign in to manage records, upload prescriptions, review extracted summaries, and keep family care in sync.</Text>
        </View>

        <Card style={styles.authCard}>
          <View style={styles.tabRow}>
            {(['signin', 'signup'] as const).map((value) => {
              const active = value === mode;
              return (
                <Pressable key={value} onPress={() => setMode(value)} style={[styles.tabButton, active && styles.tabButtonActive]}>
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{value === 'signin' ? 'Sign in' : 'Create account'}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.roleRow}>
            {(['PATIENT', 'DOCTOR'] as const).map((role) => {
              const active = selectedRole === role;
              return (
                <Pressable
                  key={role}
                  onPress={() => {
                    clearSessionError();
                    setSelectedRole(role);
                  }}
                  style={[styles.roleChip, active && styles.roleChipActive]}
                >
                  <Text style={[styles.roleChipLabel, active && styles.roleChipLabelActive]}>{role === 'PATIENT' ? 'Patient' : 'Doctor'}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.form}>
            {mode === 'signup' ? (
              <>
                <Field label="Full name" onChangeText={setFullName} placeholder="Aisha Patel" value={fullName} />
                <Field
                  keyboardType="phone-pad"
                  label="Phone number"
                  onChangeText={setPhoneNumber}
                  placeholder="+1 555 010 1100"
                  value={phoneNumber}
                />
              </>
            ) : null}

            <Field
              autoCapitalize="none"
              keyboardType="email-address"
              label="Email"
              onChangeText={setEmail}
              placeholder="name@example.com"
              value={email}
            />
            <Field label="Password" onChangeText={setPassword} placeholder="Minimum 8 characters" secureTextEntry value={password} />

            {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}

            <Button
              disabled={!canSubmit}
              label={mode === 'signin' ? 'Enter workspace' : 'Create workspace'}
              loading={sessionBusy}
              onPress={handleSubmit}
            />
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.xl,
  },
  hero: {
    gap: theme.spacing.sm,
  },
  eyebrow: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.text,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    maxWidth: 520,
  },
  authCard: {
    gap: theme.spacing.lg,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceAccent,
    borderRadius: theme.radius.pill,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: theme.colors.surface,
  },
  tabLabel: {
    ...theme.typography.label,
    color: theme.colors.textMuted,
  },
  tabLabelActive: {
    color: theme.colors.text,
  },
  roleRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  roleChip: {
    flex: 1,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
  roleChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  roleChipLabel: {
    ...theme.typography.label,
    color: theme.colors.textMuted,
  },
  roleChipLabelActive: {
    color: theme.colors.primaryDark,
  },
  form: {
    gap: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
});
