import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { PrimaryButton } from '../components/PrimaryButton';
import { useRole } from '../context/RoleContext';
import { mainNavItems } from '../navigation/mainNavItems';
import type { UploadScreenProps } from '../navigation/types';
import { theme } from '../styles/theme';

export function UploadScreen({ navigation }: UploadScreenProps) {
  const { hasStoredToken, selectedRole } = useRole();

  return (
    <View style={styles.screen}>
      <Header backLabel="<" onBack={navigation.goBack} title="Upload Documents" />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.heroCard}>
          <Text style={styles.heroTitle}>Send a document to FamWell</Text>
          <Text style={styles.heroText}>Upload is wired to the live backend endpoint, but the current frontend has no document picker dependency to supply a PDF file.</Text>
          {/* TODO: awaiting file picker integration */}
          <PrimaryButton disabled label="Upload PDF" onPress={() => undefined} />
        </Card>

        <Card>
          <Text style={styles.sectionLabel}>Endpoint</Text>
          <Text style={styles.endpointValue}>upload</Text>
          <Text style={styles.helperText}>Role selected: {selectedRole ?? 'None'}</Text>
          <Text style={styles.helperText}>Stored token: {hasStoredToken ? 'Present' : 'Missing'}</Text>
        </Card>

        <Card>
          <Text style={styles.sectionLabel}>Status</Text>
          <Text style={styles.helperText}>Upload is disabled until a file picker is added to the frontend runtime.</Text>
        </Card>
      </ScrollView>

      <BottomNav activeRoute="UploadScreen" items={mainNavItems} onNavigate={(route) => navigation.navigate(route)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.neutrals.background,
  },
  content: {
    paddingHorizontal: theme.spacing[6],
    paddingTop: theme.spacing[6],
    paddingBottom: theme.layout.bottomNavHeight + theme.spacing[6],
    gap: theme.spacing[5],
  },
  heroCard: {
    gap: theme.spacing[4],
    backgroundColor: theme.colors.brand.blue50,
    borderColor: theme.colors.brand.blue100,
  },
  heroTitle: {
    ...theme.typography.heading,
    color: theme.colors.neutrals.textPrimary,
  },
  heroText: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
  },
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.neutrals.textMuted,
  },
  endpointValue: {
    ...theme.typography.subheading,
    color: theme.colors.brand.blue500,
    marginTop: theme.spacing[2],
  },
  helperText: {
    ...theme.typography.body,
    color: theme.colors.neutrals.textMuted,
    marginTop: theme.spacing[2],
  },
});

