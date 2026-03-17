import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { theme } from '../styles/theme';

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.componentTokens.card.backgroundColor,
    borderColor: theme.componentTokens.card.borderColor,
    borderWidth: 1,
    borderRadius: theme.componentTokens.card.borderRadius,
    padding: theme.componentTokens.card.padding,
    ...theme.shadows.card,
  },
});
