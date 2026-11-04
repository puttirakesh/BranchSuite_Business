import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../../theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';

/** APK `.flow-empty`: what is empty and what to do next. */
export function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <View style={stateStyles.box}>
      <View style={stateStyles.icon}><Icon name="check" size={20} color={colors.primary} /></View>
      <AppText variant="h3" style={stateStyles.center}>{title}</AppText>
      <AppText variant="small" style={stateStyles.center}>{text}</AppText>
      {action}
    </View>
  );
}

export const stateStyles = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.card, padding: 28, alignItems: 'center', gap: 8, marginBottom: 14 },
  compact: { padding: 18 },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  errorIcon: { backgroundColor: '#FBE7EC' },
  center: { textAlign: 'center', maxWidth: 460 },
});
