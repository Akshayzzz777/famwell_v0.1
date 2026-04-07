import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';

import { useApp } from '../state/AppContext';
import { theme } from '../lib/theme';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID =
  (Constants.expoConfig as { extra?: { googleWebClientId?: string } } | null)
    ?.extra?.googleWebClientId ?? '';

type AuthMode = 'signin' | 'signup';

export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const {
    clearSessionError,
    selectedRole,
    sessionBusy,
    sessionError,
    setSelectedRole,
    signIn,
    signInWithGoogle,
    signUp,
  } = useApp();

  const handleGoogleSignIn = async () => {
    clearSessionError();
    setGoogleLoading(true);
    try {
      const redirectUri = Linking.createURL('auth');
      const nonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        String(Date.now()),
      );

      const params = new URLSearchParams({
        client_id: GOOGLE_WEB_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'id_token',
        scope: 'openid email profile',
        nonce,
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === 'success' && result.url) {
        const fragment = result.url.split('#')[1];
        if (fragment) {
          const resultParams = new URLSearchParams(fragment);
          const idToken = resultParams.get('id_token');
          if (idToken) {
            const success = await signInWithGoogle(idToken);
            if (success) {
              onAuthenticated();
            }
          }
        }
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
    } finally {
      setGoogleLoading(false);
    }
  };

  const canSubmit = useMemo(() => {
    if (mode === 'signin') {
      return Boolean(selectedRole && email.trim() && password.trim());
    }
    return Boolean(selectedRole && email.trim() && password.trim() && fullName.trim() && phoneNumber.trim().length >= 7);
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
        {/* Logo */}
        <View style={styles.logoRow}>
          <MaterialIcons name="spa" size={28} color={theme.colors.primary} />
          <Text style={styles.logoText}>FamWell</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {mode === 'signin' ? 'Welcome back' : 'Create Account'}
        </Text>

        {/* Role Toggle */}
        <View style={styles.roleToggle}>
          {(['PATIENT', 'DOCTOR'] as const).map((role) => {
            const active = selectedRole === role;
            return (
              <Pressable
                key={role}
                onPress={() => {
                  clearSessionError();
                  setSelectedRole(role);
                }}
                style={[styles.roleTab, active && styles.roleTabActive]}
              >
                <Text style={[styles.roleTabText, active && styles.roleTabTextActive]}>
                  {role === 'PATIENT' ? 'Patient' : 'Doctor'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === 'signup' && (
            <>
              <View style={styles.inputWrap}>
                <MaterialIcons name="person" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={theme.colors.textSoft}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.inputWrap}>
                <MaterialIcons name="phone" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Phone Number"
                  placeholderTextColor={theme.colors.textSoft}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                />
              </View>
            </>
          )}

          <View style={styles.inputWrap}>
            <MaterialIcons name="mail-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor={theme.colors.textSoft}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputWrap}>
            <MaterialIcons name="lock-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor={theme.colors.textSoft}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.visibilityBtn}>
              <MaterialIcons
                name={showPassword ? 'visibility' : 'visibility-off'}
                size={20}
                color={theme.colors.textMuted}
              />
            </Pressable>
          </View>

          {mode === 'signin' && (
            <Pressable style={styles.forgotRow}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </Pressable>
          )}

          {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit || sessionBusy}
            style={[styles.submitBtn, (!canSubmit || sessionBusy) && styles.submitBtnDisabled]}
          >
            {sessionBusy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{mode === 'signin' ? 'Or sign in with' : 'Or sign up with'}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google */}
        <Pressable
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
          style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.8 }]}
        >
          {googleLoading ? (
            <ActivityIndicator size="small" color={theme.colors.text} />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleBtnText}>Google</Text>
            </>
          )}
        </Pressable>

        {/* Toggle mode */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          </Text>
          <Pressable onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); clearSessionError(); }}>
            <Text style={styles.toggleLink}>
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </Text>
          </Pressable>
        </View>
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
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 20,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    marginBottom: 4,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceAccent,
    borderRadius: 999,
    padding: 4,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  roleTabActive: {
    backgroundColor: theme.colors.primary,
  },
  roleTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  roleTabTextActive: {
    color: '#fff',
  },
  form: {
    gap: 14,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
    height: '100%',
  },
  visibilityBtn: {
    padding: 4,
    marginLeft: 4,
  },
  forgotRow: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.danger,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  toggleLink: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});
