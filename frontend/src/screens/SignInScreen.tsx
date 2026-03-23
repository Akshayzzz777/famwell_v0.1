import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppLogo } from '../components/AppLogo';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { useRole } from '../context/RoleContext';
import type { SignInScreenProps } from '../navigation/types';
import { theme } from '../styles/theme';

type Props = SignInScreenProps & {
  onAuthenticated: () => void;
};

export function SignInScreen({ navigation, onAuthenticated }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const { register, sessionBusy, sessionError } = useRole();

  const canContinue = Boolean(name.trim() && email.trim() && phone.trim() && password.trim());

  const handleRegister = async () => {
    const created = await register({
      fullName: name,
      email,
      phoneNumber: phone,
      password,
    });

    if (created) {
      onAuthenticated();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Card style={styles.shell}>
        <View style={styles.header}>
          <AppLogo variant="signup" />
          <Text style={styles.title}>FamWell</Text>
          <Text style={styles.subtitle}>Create your health-focused account</Text>
        </View>

        <View style={styles.form}>
          <InputField label="Full Name" onChangeText={setName} placeholder="Jane Doe" value={name} />
          <InputField
            keyboardType="email-address"
            label="Email Address"
            onChangeText={setEmail}
            placeholder="jane@example.com"
            value={email}
          />
          <InputField
            keyboardType="phone-pad"
            label="Phone Number"
            onChangeText={setPhone}
            placeholder="(555) 000-0000"
            value={phone}
          />
          <InputField
            label="Password"
            onChangeText={setPassword}
            placeholder="........"
            secureTextEntry
            value={password}
          />

          {sessionError ? <Text style={styles.inlineNotice}>{sessionError}</Text> : null}
          <PrimaryButton disabled={!canContinue} label="Create account" loading={sessionBusy} onPress={handleRegister} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('LoginScreen')}>
            <Text style={styles.footerLink}>Log in</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.brand.sage50,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[10],
  },
  shell: {
    borderRadius: theme.radius.lg,
    padding: theme.spacing[6],
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing[8],
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.neutrals.textBody,
    marginTop: theme.spacing[4],
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
    marginTop: theme.spacing[2],
    textAlign: 'center',
  },
  form: {
    gap: theme.spacing[4],
  },
  inlineNotice: {
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
    color: theme.colors.brand.sage500,
  },
});
