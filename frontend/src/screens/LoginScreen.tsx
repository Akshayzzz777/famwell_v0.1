import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppLogo } from '../components/AppLogo';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { useRole } from '../context/RoleContext';
import type { LoginScreenProps } from '../navigation/types';
import { theme } from '../styles/theme';

type Props = LoginScreenProps & {
  onAuthenticated: () => void;
};

export function LoginScreen({ navigation, onAuthenticated }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { clearSessionError, login, selectedRole, sessionBusy, sessionError, setSelectedRole } = useRole();

  const canContinue = Boolean(selectedRole && email.trim() && password.trim());

  const handleLogin = async () => {
    const ready = await login({ email, password });
    if (ready) {
      onAuthenticated();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.header}>
        <AppLogo variant="login" />
        <Text style={styles.title}>FamWell</Text>
        <Text style={styles.subtitle}>Connect and thrive with your family</Text>
      </View>

      <Card style={styles.formCard}>
        <View style={styles.form}>
          <InputField
            keyboardType="email-address"
            label="Email Address"
            onChangeText={setEmail}
            placeholder="name@example.com"
            value={email}
          />

          <View style={styles.passwordMeta}>
            <Text style={styles.passwordLabel}>Password</Text>
            <Text style={styles.metaAction}>Secure login</Text>
          </View>

          <InputField onChangeText={setPassword} placeholder="........" secureTextEntry value={password} />

          <View style={styles.roleSection}>
            <Text style={styles.roleLabel}>Role</Text>
            <View style={styles.roleRow}>
              {(['PATIENT', 'DOCTOR'] as const).map((role) => {
                const selected = selectedRole === role;
                return (
                  <TouchableOpacity
                    key={role}
                    activeOpacity={0.9}
                    onPress={() => {
                      clearSessionError();
                      setSelectedRole(role);
                    }}
                    style={[styles.roleButton, selected && styles.roleButtonSelected]}
                  >
                    <Text style={[styles.roleButtonLabel, selected && styles.roleButtonLabelSelected]}>
                      {role === 'PATIENT' ? 'Patient' : 'Doctor'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {sessionError ? <Text style={styles.inlineError}>{sessionError}</Text> : null}

          <PrimaryButton disabled={!canContinue} label="Login" loading={sessionBusy} onPress={handleLogin} />
        </View>
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account?</Text>
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('SignInScreen')}>
          <Text style={styles.footerLink}>Sign up</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.legalRow}>
        <Text style={styles.legalText}>Privacy Policy</Text>
        <Text style={styles.legalDot}>•</Text>
        <Text style={styles.legalText}>Terms of Service</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.neutrals.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[10],
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing[10],
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.neutrals.textPrimary,
    marginTop: theme.spacing[4],
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
    marginTop: theme.spacing[2],
    textAlign: 'center',
  },
  formCard: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing[6],
  },
  form: {
    gap: theme.spacing[5],
  },
  passwordMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: -theme.spacing[3],
  },
  passwordLabel: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textBody,
    marginLeft: theme.spacing[1],
  },
  metaAction: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textSubtle,
  },
  roleSection: {
    gap: theme.spacing[2],
  },
  roleLabel: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textBody,
    marginLeft: theme.spacing[1],
  },
  roleRow: {
    flexDirection: 'row',
    gap: theme.spacing[3],
  },
  roleButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.neutrals.border,
    backgroundColor: theme.colors.neutrals.surfaceSoft,
    paddingVertical: theme.spacing[3],
  },
  roleButtonSelected: {
    backgroundColor: theme.colors.brand.blue50,
    borderColor: theme.colors.brand.blue500,
  },
  roleButtonLabel: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textBody,
  },
  roleButtonLabelSelected: {
    color: theme.colors.brand.blue500,
  },
  inlineError: {
    ...theme.typography.label,
    color: theme.colors.accent.rose,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing[2],
    marginTop: theme.spacing[8],
  },
  footerText: {
    ...theme.typography.label,
    color: theme.colors.neutrals.textMuted,
  },
  footerLink: {
    ...theme.typography.bodyStrong,
    color: theme.colors.brand.blue500,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing[3],
    marginTop: theme.spacing[10],
  },
  legalText: {
    ...theme.typography.caption,
    color: theme.colors.neutrals.textSubtle,
  },
  legalDot: {
    ...theme.typography.caption,
    color: theme.colors.neutrals.textSubtle,
  },
});
