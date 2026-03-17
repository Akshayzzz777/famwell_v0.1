import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../styles/theme';

type AppLogoVariant = 'splash' | 'login' | 'signup';

type AppLogoProps = {
  variant: AppLogoVariant;
};

export function AppLogo({ variant }: AppLogoProps) {
  const isSplash = variant === 'splash';
  const isLogin = variant === 'login';

  return (
    <View
      style={[
        styles.container,
        isSplash && styles.splashContainer,
        isLogin && styles.loginContainer,
        variant === 'signup' && styles.signupContainer,
      ]}
    >
      <Text style={[styles.mark, isLogin && styles.loginMark]}>{isLogin ? 'H' : '♥'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashContainer: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.white,
    ...theme.shadows.floating,
  },
  loginContainer: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brand.blue500,
    ...theme.shadows.button,
  },
  signupContainer: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brand.sage200,
  },
  mark: {
    ...theme.typography.heading,
    color: theme.colors.brand.blue500,
  },
  loginMark: {
    color: theme.colors.white,
  },
});
