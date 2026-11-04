import React from 'react';
import { View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { AppText, Button } from '.';
import { colors } from '../../theme/tokens';

/** Route-level crash screen used by Expo Router. Shows what happened and a way back. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg, gap: 12 }}>
      <AppText variant="h2">This screen stopped working</AppText>
      <AppText variant="small" style={{ textAlign: 'center', maxWidth: 420 }}>{error.message}</AppText>
      <Button label="Try again" onPress={() => void retry()} />
    </View>
  );
}
