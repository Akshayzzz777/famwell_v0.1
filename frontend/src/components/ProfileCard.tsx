import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { theme } from '../styles/theme';

type ProfileCardProps = {
  imageUri?: string;
  fallbackLabel: string;
  name: string;
  subtitle: string;
  accentColor?: string;
};

export function ProfileCard({
  imageUri,
  fallbackLabel,
  name,
  subtitle,
  accentColor = theme.colors.semantic.success,
}: ProfileCardProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatarOuter}>
          {imageUri ? (
            <Image resizeMode="cover" source={{ uri: imageUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{fallbackLabel}</Text>
            </View>
          )}
        </View>
        <View style={[styles.statusDot, { backgroundColor: accentColor }]} />
      </View>

      <Text style={styles.name}>{name}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  avatarWrap: {
    marginBottom: theme.spacing[4],
    position: 'relative',
  },
  avatarOuter: {
    width: 128,
    height: 128,
    borderRadius: theme.radius.full,
    borderWidth: 4,
    borderColor: theme.colors.white,
    overflow: 'hidden',
    backgroundColor: theme.colors.brand.blue100,
    ...theme.shadows.card,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.blue100,
  },
  avatarFallbackText: {
    ...theme.typography.heading,
    color: theme.colors.brand.sky700,
  },
  statusDot: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 16,
    height: 16,
    borderRadius: theme.radius.full,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  name: {
    ...theme.typography.heading,
    color: theme.colors.neutrals.textPrimary,
  },
  subtitle: {
    ...theme.typography.label,
    color: theme.colors.brand.sky700,
    marginTop: theme.spacing[1],
  },
});
