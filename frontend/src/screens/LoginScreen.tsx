import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppLogo } from '../components/AppLogo';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import type { LoginScreenProps } from '../navigation/types';
import { theme } from '../styles/theme';

type Props = LoginScreenProps & {
  onAuthenticated: () => void;
};

export function LoginScreen({ navigation, onAuthenticated }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
            <TouchableOpacity activeOpacity={0.85}>
              <Text style={styles.metaAction}>Forgot?</Text>
            </TouchableOpacity>
          </View>

          <InputField
            onChangeText={setPassword}
            placeholder="........"
            secureTextEntry
            value={password}
          />

          <PrimaryButton label="Login" onPress={onAuthenticated} />
        </View>
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don&apos;t have an account?</Text>
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
    color: theme.colors.brand.blue500,
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
