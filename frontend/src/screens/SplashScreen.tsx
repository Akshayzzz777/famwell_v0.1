import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppLogo } from '../components/AppLogo';
import { LoadingDots } from '../components/LoadingDots';
import { theme } from '../styles/theme';

type SplashScreenProps = {
  onFinished: () => void;
};

export function SplashScreen({ onFinished }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(onFinished, 1800);
    return () => clearTimeout(timer);
  }, [onFinished]);

  return (
    <View style={styles.screen}>
      <View style={styles.brandWrap}>
        <AppLogo variant="splash" />
        <Text style={styles.title}>FamWell</Text>
        <Text style={styles.subtitle}>Care when it matters most</Text>
      </View>

      <View style={styles.loaderWrap}>
        <LoadingDots />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EAF4FE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing[6],
  },
  brandWrap: {
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.neutrals.textPrimary,
    marginTop: theme.spacing[4],
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
  },
  loaderWrap: {
    position: 'absolute',
    bottom: theme.spacing[12],
    alignItems: 'center',
  },
});
