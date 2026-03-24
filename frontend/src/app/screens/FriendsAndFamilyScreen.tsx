import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppScaffold } from '../components/Layout';
import { Button, Card, SectionTitle } from '../components/Primitives';
import { theme } from '../lib/theme';
import type { FriendsAndFamilyProps } from '../navigation';

export function FriendsAndFamilyScreen({ navigation }: FriendsAndFamilyProps) {
  return (
    <AppScaffold onBack={navigation.goBack} subtitle="A shared space for trusted contacts and family care tools is coming soon." title="Friends & Family">
      <Card style={styles.card}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconLabel}>FF</Text>
        </View>
        <SectionTitle detail="This space will bring together household care coordination and close contacts." eyebrow="Coming soon" title="Friends & Family" />
        <Button label="Back to dashboard" onPress={() => navigation.navigate('HomeDashboard')} />
      </Card>
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.lg,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: {
    ...theme.typography.bodyStrong,
    color: theme.colors.primaryDark,
  },
});
